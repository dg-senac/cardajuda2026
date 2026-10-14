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

  section("Resultado");
  if (missing.length > 0) {
    console.log(`[erro] ainda faltam ${missing.length} tabela(s): ${missing.join(", ")}`);
    console.log("      O usuário da DATABASE_URL provavelmente não tem permissão de criar tabelas.");
    console.log("      Use o usuário 'postgres' do projeto (dono do schema public).");
    process.exitCode = 1;
  } else {
    console.log("[ok] As 13 tabelas existem neste banco (schema aplicado).");
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

async function listMissingTables(client) {
  const result = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  const present = new Set(result.rows.map((row) => row.table_name));
  return APP_TABLES.filter((table) => !present.has(table));
}

await main();
