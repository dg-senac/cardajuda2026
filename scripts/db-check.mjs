#!/usr/bin/env node
/**
 * npm run db:check -- descobre o que está errado na DATABASE_URL.
 *
 * O app esconde a causa dos erros de banco atrás de "Failed query: select ...
 * from profiles". Este script fala com o MESMO banco que o app usa (mesmos
 * arquivos .env.local/.env) e responde, em ordem:
 *
 *   1. qual host/banco/usuário o app está usando (senha nunca é mostrada);
 *   2. se a URL tem problema (espaço sobrando, senha não codificada, ...);
 *   3. se o nome do host resolve no DNS (host direto do Supabase é IPv6-only!);
 *   4. se dá para conectar e com qual versão do Postgres;
 *   5. quais das 13 tabelas do app existem nesse banco (o erro de cadastro
 *      costuma ser "a tabela profiles não existe AQUI");
 *   6. se a query exata do cadastro roda.
 *
 * Uso:
 *   npm run db:check
 *   npm run db:check -- "postgresql://usuario:senha@host:5432/postgres?sslmode=require"
 */

import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import {
  APP_TABLES,
  AUTH_TABLES,
  describeDatabaseTarget,
  diagnoseDbError,
  formatDbDiagnosis,
} from "../src/lib/db-diagnosis.mjs";

// A raiz do projeto é o diretório acima de scripts/ -- assim o script funciona
// mesmo se for chamado de outro diretório.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILES = [".env.local", ".env"];

function line(char = "-", size = 74) {
  return char.repeat(size);
}

function section(title) {
  console.log(`\n${line("=")}`);
  console.log(title);
  console.log(line("="));
}

/** Carrega .env.local e depois .env, igual ao Next, e diz de onde veio a URL. */
function loadEnvironment() {
  const platformValue = process.env.DATABASE_URL;
  let source = platformValue ? "variável de ambiente do processo (Vercel/CI/docker)" : null;
  const found = [];

  for (const file of ENV_FILES) {
    const absolute = path.join(ROOT, file);
    if (!fs.existsSync(absolute)) continue;
    const result = loadEnv({ path: absolute, quiet: true });
    found.push(file);
    if (!source && result.parsed && result.parsed.DATABASE_URL) source = file;
  }

  return { found, source, value: process.env.DATABASE_URL };
}

function printTarget(target) {
  if (!target.present) {
    console.log("[erro] DATABASE_URL não foi encontrada.");
    return;
  }

  console.log(`  URL (senha oculta): ${target.redacted}`);
  if (!target.parsed) {
    console.log("  [erro] a URL não pôde ser interpretada.");
    return;
  }

  console.log(`  host........: ${target.host}`);
  console.log(`  porta.......: ${target.port}`);
  console.log(`  banco.......: ${target.database}`);
  console.log(`  usuário.....: ${target.user}`);
  console.log(`  sslmode.....: ${target.sslmode ?? "(nenhum)"}`);
  console.log(`  senha.......: ${target.passwordIsSet ? "informada (oculta)" : "NÃO informada"}`);

  if (target.isSupabasePooler) {
    console.log("  tipo........: Supabase - Session/Transaction pooler (aceita IPv4)");
  } else if (target.isSupabaseDirect) {
    console.log("  tipo........: Supabase - conexão DIRETA (db.<ref>.supabase.co é somente IPv6)");
  } else if (target.isLocal) {
    console.log("  tipo........: Postgres local");
  } else {
    console.log("  tipo........: outro servidor");
  }
  if (target.user && target.isSupabasePooler && !target.user.includes(".")) {
    console.log(
      `  [aviso] no pooler o usuário precisa ter o ref do projeto: postgres.<ref> (recebido: "${target.user}").`,
    );
  }
}

async function checkDns(host) {
  try {
    const addresses = await dns.lookup(host, { all: true, verbatim: true });
    const v4 = addresses.filter((a) => a.family === 4);
    const v6 = addresses.filter((a) => a.family === 6);
    console.log(
      `  [ok] ${host} resolve: ${addresses.map((a) => `${a.address} (IPv${a.family})`).join(", ")}`,
    );
    if (v4.length === 0 && v6.length > 0) {
      console.log(
        "  [aviso] este host só tem IPv6. Redes sem IPv6 (comum em faculdade/empresa/4G) falham com ENETUNREACH/ETIMEDOUT.",
      );
      console.log(
        "          Solução: use a string do Session pooler (aws-0-<região>.pooler.supabase.com), que tem IPv4.",
      );
    }
    return { ok: true };
  } catch (error) {
    console.log(`  [erro] o nome "${host}" não resolve no DNS (${error.code ?? error.message}).`);
    const diagnosis = diagnoseDbError(error);
    console.log(`         ${diagnosis.summary}`);
    console.log(`         -> ${diagnosis.hint}`);
    return { ok: false, diagnosis };
  }
}

async function main() {
  console.log(line("="));
  console.log("db:check -- diagnóstico da conexão com o banco do Carda Ajuda");
  console.log(line("="));

  // Qualquer argumento posicional que "pareça" uma URL do Postgres -- inclusive
  // uma URL malformada, que é justamente um dos casos que vale diagnosticar.
  const cliUrl = process.argv
    .slice(2)
    .find((arg) => !arg.startsWith("-") && /^postgres/i.test(arg.trim()));
  const env = cliUrl ? { source: "argumento da linha de comando", found: [], value: cliUrl } : loadEnvironment();
  const rawUrl = cliUrl ?? env.value;

  section("1. De onde vem a DATABASE_URL");
  if (cliUrl) {
    console.log("  Fonte: argumento passado na linha de comando.");
  } else {
    console.log(`  Arquivos encontrados na raiz: ${env.found.length > 0 ? env.found.join(", ") : "(nenhum)"}`);
    console.log(`  Fonte da DATABASE_URL......: ${env.source ?? "não encontrada"}`);
    if (!env.found.includes(".env.local")) {
      console.log(
        "  [dica] o Next lê .env.local primeiro. Se existir .env com valor antigo, o .env.local é que manda.",
      );
    }
  }

  const target = describeDatabaseTarget(rawUrl);
  printTarget(target);

  if (target.warnings.length > 0) {
    section("2. Avisos sobre o formato da URL");
    for (const warning of target.warnings) console.log(`  [aviso] ${warning}`);
  } else {
    console.log("\n  [ok] formato da URL sem problemas aparentes.");
  }

  if (!rawUrl) {
    section("Resultado");
    console.log("  [erro] Sem DATABASE_URL não há o que testar.");
    console.log("  Crie o arquivo .env.local na raiz do projeto com:");
    console.log("    DATABASE_URL=postgresql://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres?sslmode=require");
    process.exitCode = 1;
    return;
  }

  if (target.parsed && target.host) {
    section("3. DNS");
    const dnsResult = await checkDns(target.host);
    if (!dnsResult.ok) {
      section("Resultado");
      console.log("  [erro] O problema é o endereço do banco: ele não existe/não resolve.");
      console.log(`  -> ${dnsResult.diagnosis.hint}`);
      process.exitCode = 1;
      return;
    }
  }

  section("4. Conexão");
  let client;
  try {
    client = new pg.Client({
      connectionString: rawUrl.trim(),
      connectionTimeoutMillis: 15_000,
    });
  } catch (error) {
    // A própria DATABASE_URL é inválida e o driver nem chegou a tentar
    // (ex.: senha com "#" ou "/" sem codificar).
    const diagnosis = diagnoseDbError(error);
    console.log("  [erro] o driver recusou a DATABASE_URL antes de tentar conectar:");
    console.log(formatDbDiagnosis(diagnosis));
    section("Resultado");
    console.log("  [erro] corrija a DATABASE_URL e rode `npm run db:check` de novo.");
    process.exitCode = 1;
    return;
  }

  const started = Date.now();
  try {
    await client.connect();
    console.log(`  [ok] conectou em ${Date.now() - started} ms`);
  } catch (error) {
    const diagnosis = diagnoseDbError(error);
    console.log(`  [erro] não foi possível conectar`);
    console.log("");
    console.log(formatDbDiagnosis(diagnosis));
    section("Resultado");
    console.log("  [erro] O app não consegue falar com o banco: cadastro e login vão falhar.");
    console.log("  Corrija a DATABASE_URL conforme o passo 'o que fazer' acima e rode de novo:");
    console.log("    npm run db:check");
    process.exitCode = 1;
    return;
  }

  try {
    const info = await client.query(
      "select current_database() as database, current_user as usuario, version() as versao, current_schema() as schema, current_setting('search_path') as search_path",
    );
    const row = info.rows[0];
    console.log(`  banco conectado: ${row.database}`);
    console.log(`  usuário........: ${row.usuario}`);
    console.log(`  schema atual...: ${row.schema}  (search_path: ${row.search_path})`);
    console.log(`  servidor.......: ${String(row.versao).split(" ").slice(0, 2).join(" ")}`);

    try {
      const ssl = await client.query("select ssl from pg_stat_ssl where pid = pg_backend_pid()");
      console.log(`  conexão cifrada: ${ssl.rows[0]?.ssl === true ? "sim (TLS)" : "não"}`);
    } catch {
      console.log("  conexão cifrada: não foi possível verificar");
    }
  } catch (error) {
    console.log(`  [aviso] conectou, mas não conseguiu ler os dados da sessão: ${error.message}`);
  }

  section("5. Tabelas do app neste banco");
  let presentTables;
  try {
    const result = await client.query(
      "select table_name from information_schema.tables where table_schema in ('public', current_schema())",
    );
    presentTables = new Set(result.rows.map((r) => r.table_name));
  } catch (error) {
    console.log(`  [erro] não foi possível listar as tabelas: ${error.message}`);
    await client.end();
    process.exitCode = 1;
    return;
  }

  const missing = [];
  for (const table of APP_TABLES) {
    if (!presentTables.has(table)) {
      missing.push(table);
      console.log(`  [X] ${table.padEnd(18)} não existe`);
      continue;
    }
    let count = "?";
    try {
      const counted = await client.query(`select count(*)::int as n from "${table}"`);
      count = String(counted.rows[0].n);
    } catch {
      count = "sem permissão para contar";
    }
    console.log(`  [ok] ${table.padEnd(18)} existe (${count} linha${count === "1" ? "" : "s"})`);
  }

  section("6. A query do cadastro (a mesma do erro)");
  let queryOk = false;
  if (!missing.includes("profiles")) {
    try {
      const result = await client.query(
        'select "id", "role", "nome", "email", "telefone", "password_hash", "avatar_url", "created_at" from "profiles" where "profiles"."email" = $1 limit $2',
        ["verificacao@db-check.local", 1],
      );
      console.log(`  [ok] a query rodou (${result.rows.length} linha(s) para esse email)`);
      queryOk = true;
    } catch (error) {
      const diagnosis = diagnoseDbError(error);
      console.log("  [erro] a query do cadastro falhou:");
      console.log(formatDbDiagnosis(diagnosis));
    }
  } else {
    console.log('  [X] impossível testar: a tabela "profiles" não existe neste banco.');
  }

  await client.end();

  section("Resultado");
  if (missing.length === 0 && queryOk) {
    console.log("  [ok] Tudo certo: o app consegue conectar e o schema está aplicado.");
    console.log("       Se o cadastro ainda falhar, rode `npm run dev` e olhe o terminal: o erro real");
    console.log("       agora aparece no log (linhas começando com [auth] / [db]).");
    return;
  }

  if (missing.length > 0) {
    console.log(`  [erro] Faltam ${missing.length} tabela(s) neste banco: ${missing.join(", ")}.`);
    console.log("         É por isso que o cadastro quebra: o app pede a tabela 'profiles' e ela não existe aqui.");
    console.log("         Este é o MESMO banco que o app usa (a URL acima), então basta criar o schema nele:");
    console.log("");
    console.log("           npm run db:setup        # aplica supabase/schema.sql");
    console.log("           npm run db:seed         # (opcional) contas de teste: maria@email.com / 123456");
    console.log("");
    console.log("         Pelo painel do Supabase, se preferir: SQL Editor -> New query -> cole o");
    console.log("         conteúdo de supabase/schema.sql -> Run.");
    console.log("         Depois rode `npm run db:check` de novo para confirmar.");
    if (AUTH_TABLES.some((table) => missing.includes(table))) {
      console.log("");
      console.log("         Atenção: sem as tabelas " + AUTH_TABLES.join("/") + " o login também não funciona.");
    }
    process.exitCode = 1;
    return;
  }

  console.log("  [aviso] As tabelas existem, mas a query do cadastro falhou -- veja o erro da seção 6.");
  console.log("         Erros de permissão/RLS são os suspeitos: o app usa um único usuário, então confira");
  console.log("         se DATABASE_URL aponta para o usuário 'postgres' do projeto.");
  process.exitCode = 1;
}

await main();
