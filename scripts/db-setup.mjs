#!/usr/bin/env node
/**
 * npm run db:setup [-- --seed]
 *
 * Aplica o supabase/schema.sql (as 13 tabelas, chaves estrangeiras, índices e o
 * RLS desligado) no banco apontado pela DATABASE_URL -- o MESMO banco que o
 * app usa. É a versão de terminal do "cole o schema.sql no SQL Editor do
 * Supabase" e existe para acabar com o erro de cadastro mais comum deste
 * projeto: a tabela "profiles" não existir no banco que a DATABASE_URL aponta.
 *
 * Os scripts são idempotentes: rodar de novo não apaga nem duplica nada.
 *
 * Uso:
 *   npm run db:setup            # só o schema
 *   npm run db:seed             # schema + contas de demonstração (senha 123456)
 *   npm run db:setup -- "postgresql://..."   # alvo avulso, sem ler o .env
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { APP_TABLES, describeDatabaseTarget, diagnoseDbError, formatDbDiagnosis } from "../src/lib/db-diagnosis.mjs";

// Raiz do projeto (diretório acima de scripts/) -- funciona de qualquer cwd.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_FILE = path.join(ROOT, "supabase", "schema.sql");
const SEED_FILE = path.join(ROOT, "supabase", "seed.sql");

function section(title) {
  console.log(`\n${"=".repeat(74)}\n${title}\n${"=".repeat(74)}`);
}

function loadDatabaseUrl() {
  // Qualquer argumento posicional que "pareça" uma URL do Postgres -- inclusive
  // uma URL malformada, que é justamente um dos casos que vale diagnosticar.
  const cliUrl = process.argv
    .slice(2)
    .find((arg) => !arg.startsWith("-") && /^postgres/i.test(arg.trim()));
  if (cliUrl) return { url: cliUrl, source: "argumento da linha de comando" };

  const platformValue = process.env.DATABASE_URL;
  if (platformValue) return { url: platformValue, source: "variável de ambiente do processo" };

  for (const file of [".env.local", ".env"]) {
    const absolute = path.join(ROOT, file);
    if (!fs.existsSync(absolute)) continue;
    const result = loadEnv({ path: absolute, quiet: true });
    if (result.parsed && result.parsed.DATABASE_URL) {
      return { url: process.env.DATABASE_URL, source: file };
    }
  }

  return { url: undefined, source: null };
}

async function main() {
  const withSeed = process.argv.includes("--seed") || process.argv.includes("--with-seed");

  section(withSeed ? "db:seed -- schema + dados de demonstração" : "db:setup -- schema do Carda Ajuda");

  const { url, source } = loadDatabaseUrl();
  const target = describeDatabaseTarget(url);

  if (!url) {
    console.log("[erro] DATABASE_URL não encontrada (nem no .env.local/.env, nem no ambiente).");
    console.log("       Crie .env.local na raiz do projeto com a connection string do Supabase:");
    console.log("         DATABASE_URL=postgresql://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres?sslmode=require");
    console.log("       Detalhes: supabase/README.md");
    process.exitCode = 1;
    return;
  }

  console.log(`Fonte da URL: ${source ?? "desconhecida"}`);
  console.log(`Alvo........: ${target.redacted}`);
  for (const warning of target.warnings) console.log(`[aviso] ${warning}`);

  if (target.isSupabaseDirect) {
    console.log(
      "[aviso] Você está na conexão direta (db.<ref>.supabase.co), que é somente IPv6. Se a rede não tiver IPv6, troque pelo Session pooler antes de continuar.",
    );
  }

  for (const file of [SCHEMA_FILE, SEED_FILE]) {
    if (!fs.existsSync(file)) {
      console.log(`[erro] arquivo não encontrado: ${path.relative(ROOT, file)}`);
      process.exitCode = 1;
      return;
    }
  }

  const client = new pg.Client({
    connectionString: url.trim(),
    connectionTimeoutMillis: 15_000,
  });

  // O schema.sql cria constraint por constraint e transforma conflito em NOTICE
  // ("não foi possível criar pacientes_altura_check: ..."), para um dado antigo
  // não abortar o script inteiro. Sem este listener o aviso nascia e morria no
  // servidor, e a pessoa descobria a ausência lá na frente, em produção.
  const avisos = [];
  client.on("notice", (notice) => {
    const message = String(notice.message ?? "").replace(/\s+/g, " ").trim();
    if (!message) return;
    // "create index if not exists" em banco já aplicado emite um NOTICE por
    // objeto; mostrar isso polui e ensina a ignorar o que importa.
    if (/already exists.*skipping$/i.test(message)) return;
    avisos.push(message);
    console.log(`[aviso] ${message}`);
  });

  try {
    await client.connect();
  } catch (error) {
    const diagnosis = diagnoseDbError(error);
    console.log("\n[erro] não foi possível conectar -- nada foi alterado.");
    console.log(formatDbDiagnosis(diagnosis));
    console.log("\nRode `npm run db:check` para um diagnóstico completo do endereço.");
    process.exitCode = 1;
    return;
  }

  const before = await countExistingTables(client);
  console.log(`\nTabelas do app já existentes antes: ${before}/13`);

  // O schema.sql é enviado inteiro numa única query (o protocolo simples do
  // Postgres aceita vários comandos de uma vez). Ele já é idempotente.
  try {
    const schemaSql = fs.readFileSync(SCHEMA_FILE, "utf8");
    process.stdout.write("Aplicando supabase/schema.sql... ");
    await client.query(schemaSql);
    console.log("ok");
  } catch (error) {
    const diagnosis = diagnoseDbError(error);
    console.log("falhou");
    console.log(formatDbDiagnosis(diagnosis));
    await client.end();
    process.exitCode = 1;
    return;
  }

  if (withSeed) {
    try {
      const seedSql = fs.readFileSync(SEED_FILE, "utf8");
      process.stdout.write("Aplicando supabase/seed.sql.... ");
      await client.query(seedSql);
      console.log("ok");
    } catch (error) {
      const diagnosis = diagnoseDbError(error);
      console.log("falhou");
      console.log(formatDbDiagnosis(diagnosis));
      await client.end();
      process.exitCode = 1;
      return;
    }
  }

  const missing = await listMissingTables(client);
  const drifted = await listMissingSchemaObjects(client);

  section("Resultado");
  if (missing.length > 0) {
    console.log(`[erro] ainda faltam ${missing.length} tabela(s): ${missing.join(", ")}`);
    console.log("      O usuário da DATABASE_URL provavelmente não tem permissão de criar tabelas.");
    console.log("      Use o usuário 'postgres' do projeto (dono do schema public).");
    process.exitCode = 1;
  } else {
    console.log("[ok] As 13 tabelas existem neste banco (schema aplicado).");
    if (drifted.length > 0) {
      console.log(`     [atenção] faltam ${drifted.length} objeto(s) de schema, veja a seção "Índices e constraints".`);
      for (const item of drifted) console.log(`       - ${item}`);
    }
    if (avisos.length > 0) {
      console.log(`     ${avisos.length} aviso(s) do Postgres acima: normalmente é dado antigo contradizendo a regra nova.`);
    }
    if (withSeed) {
      const counts = await client.query(
        "select (select count(*)::int from profiles) as perfis, (select count(*)::int from pacientes) as pacientes, (select count(*)::int from medicos) as medicos",
      );
      const row = counts.rows[0];
      console.log(`     Contas de demonstração: ${row.perfis} perfis (${row.pacientes} pacientes, ${row.medicos} médicos).`);
      console.log("     Entre com maria@email.com / 123456 (paciente) ou ana@cardiajuda.com / 123456 (médica).");
    } else {
      console.log("     Banco sem contas de demonstração. Rode `npm run db:seed` para criar as de teste.");
    }
    console.log("\nAgora reinicie o `npm run dev` (se estiver aberto) e tente o cadastro de novo.");
  }

  await client.end();
}

async function countExistingTables(client) {
  const missing = await listMissingTables(client);
  return APP_TABLES.length - missing.length;
}

/**
 * Índices/constraints que o app espera (mesma lista do `npm run db:check`).
 * Um banco criado por versao antiga do schema, ou por um `drizzle-kit push` com
 * schema.ts incompleto, chega aqui com as tabelas certas e os indices apagados.
 */
const EXPECTED_SCHEMA_OBJECTS = [
  "profiles_created_at_idx",
  "sessions_user_id_idx",
  "sessions_expires_at_idx",
  "consultas_paciente_id_data_idx",
  "consultas_medico_id_data_idx",
  "triagens_medico_id_data_idx",
  "triagens_paciente_id_idx",
  "medicoes_paciente_id_created_idx",
  "alertas_created_idx",
  "alertas_paciente_id_idx",
  "pendencias_medico_id_created_idx",
  "pendencias_paciente_id_idx",
  "lembretes_paciente_id_ativo_idx",
  "cardapio_semanal_dia_semana_idx",
  "cardapio_semanal_dia_refeicao_unique",
  "assinaturas_paciente_id_status_idx",
  "assinaturas_plano_id_idx",
  "pacientes_altura_check",
  "pacientes_idade_check",
  "assinaturas_status_check",
];

async function listMissingSchemaObjects(client) {
  const result = await client.query(
    "select indexname as name from pg_indexes where schemaname = 'public' union all select conname from pg_constraint where connamespace = 'public'::regnamespace",
  );
  const present = new Set(result.rows.map((row) => row.name));
  return EXPECTED_SCHEMA_OBJECTS.filter((name) => !present.has(name));
}

async function listMissingTables(client) {
  const result = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  const present = new Set(result.rows.map((row) => row.table_name));
  return APP_TABLES.filter((table) => !present.has(table));
}

await main();
