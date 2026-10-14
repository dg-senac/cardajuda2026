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
 *   6. se os índices e constraints que o app espera estão no banco (drift de
 *      schema: `drizzle-kit push` num schema.ts incompleto derruba índice);
 *   7. se a query exata do cadastro roda;
 *   8. integridade dos dados: contas órfãs (profiles sem pacientes/medicos),
 *      sessões vencidas e valores fora dos CHECK.
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


/**
 * Índices e constraints que src/db/schema.ts + supabase/schema.sql prometem ao
 * app. Ficam duplicados aqui DE PROPÓSITO: este script é a checagem independente
 * -- se o schema.sql e o schema.ts divergirem, ele aponta o que falta no banco.
 */
const EXPECTED_INDEXES = [
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
];

const EXPECTED_CONSTRAINTS = [
  "profiles_email_unique",
  "profiles_role_check",
  "pacientes_cpf_unique",
  "pacientes_id_profiles_id_fk",
  "medicos_crm_unique",
  "medicos_id_profiles_id_fk",
  "sessions_user_id_profiles_id_fk",
  "consultas_status_check",
  "consultas_paciente_id_pacientes_id_fk",
  "consultas_medico_id_medicos_id_fk",
  "triagens_classificacao_check",
  "triagens_paciente_id_pacientes_id_fk",
  "triagens_medico_id_medicos_id_fk",
  "medicoes_status_check",
  "medicoes_paciente_id_pacientes_id_fk",
  "alertas_status_check",
  "alertas_paciente_id_pacientes_id_fk",
  "alertas_medico_id_medicos_id_fk",
  "pendencias_medico_id_medicos_id_fk",
  "pendencias_paciente_id_pacientes_id_fk",
  "lembretes_paciente_id_pacientes_id_fk",
  "assinaturas_paciente_id_pacientes_id_fk",
  "assinaturas_plano_id_planos_id_fk",
  "assinaturas_status_check",
  "pacientes_altura_check",
  "pacientes_idade_check",
];

async function checkSchemaObjects(client) {
  const idx = await client.query(
    "select indexname as name from pg_indexes where schemaname = 'public'",
  );
  const con = await client.query(
    "select conname as name from pg_constraint where connamespace = 'public'::regnamespace",
  );
  const presentes = new Set([
    ...idx.rows.map((row) => row.name),
    ...con.rows.map((row) => row.name),
  ]);
  const faltando = [];
  for (const name of EXPECTED_INDEXES) {
    if (!presentes.has(name)) faltando.push(`índice ${name}`);
  }
  for (const name of EXPECTED_CONSTRAINTS) {
    if (!presentes.has(name)) faltando.push(`constraint ${name}`);
  }
  return faltando;
}

/**
 * Dados que passam no SELECT mas quebram tela: cadastro salvo pela metade
 * (profiles sem pacientes/medicos), sessão vencida (login "não pega") e status
 * fora da lista do CHECK (linha antiga que impede o constraint de ser criado).
 */
async function checkIntegrity(client) {
  const problems = [];
  const has = async (table) => {
    const r = await client.query(
      "select 1 from information_schema.tables where table_schema='public' and table_name=$1",
      [table],
    );
    return r.rowCount > 0;
  };

  const queries = [];
  if ((await has("profiles")) && (await has("pacientes"))) {
    queries.push({
      label: "profiles de paciente sem linha em pacientes",
      sql: `select count(*)::int as n from "profiles" p where p.role = 'paciente' and not exists (select 1 from "pacientes" x where x.id = p.id)`,
      zero: (n) => n === 0,
      what: "contas de paciente salvas pela metade (só o profiles existe): login entra, toda tela de paciente vem vazia",
      fix: "delete do perfil órfão + cadastro de novo: select p.id, p.email from profiles p left join pacientes x on x.id = p.id where p.role = 'paciente' and x.id is null;",
    });
  }
  if ((await has("profiles")) && (await has("medicos"))) {
    queries.push({
      label: "profiles de médico sem linha em medicos",
      sql: `select count(*)::int as n from "profiles" p where p.role = 'medico' and not exists (select 1 from "medicos" x where x.id = p.id)`,
      zero: (n) => n === 0,
      what: "contas de médico sem a linha em medicos",
      fix: "o cadastro grava as duas tabelas numa transação; estas linhas são de antes. Delete-as pelo SQL Editor e cadastre de novo.",
    });
  }
  if ((await has("consultas")) && (await has("medicos"))) {
    queries.push({
      label: "consultas 'agendada' sem medico_id",
      sql: `select count(*)::int as n from "consultas" where "medico_id" is null and "status" = 'agendada'`,
      zero: (n) => n === 0,
      what:
        "consultas que nenhum médico vê na agenda: a listagem e o 'marcar como realizada' filtram por medico_id, " +
        "então uma linha sem esse vínculo fica presa em 'agendada' para sempre",
      fix:
        "o agendamento passou a vincular o profissional digitado ao cadastro; para as antigas, olhe uma por uma e " +
        "vincule sem palpote:  select id, data, profissional from consultas where medico_id is null and status = 'agendada';  " +
        " ->  update consultas set medico_id = '<id do médico certo>' where id = '<id da consulta>';  " +
        "(quem agenda pelo app nunca mais precisa disso)",
    });
  }
  if (await has("sessions")) {
    queries.push({
      label: "sessões já vencidas na tabela sessions",
      sql: `select count(*)::int as n from "sessions" where expires_at < now()`,
      zero: (n) => n === 0,
      what: "linhas de sessão vencidas (o login de quem tem esse cookie cai no /login para sempre)",
      fix: "delete from sessions where expires_at < now(); -- o createSession já faz a limpeza por usuário a cada login",
    });
  }
  for (const table of ["consultas", "medicoes", "alertas", "triagens"]) {
    if (!(await has(table))) continue;
    const lista =
      table === "consultas"
        ? "'agendada','realizada','cancelada'"
        : table === "medicoes"
          ? "'normal','atencao','alerta'"
          : table === "alertas"
            ? "'alerta','pendente','em_dia'"
            : "'verde','amarela','vermelha'";
    queries.push({
      label: `${table}.status/classificacao fora da lista do CHECK`,
      sql: `select count(*)::int as n from "${table}" where "${table === "triagens" ? "classificacao" : "status"}" not in (${lista})`,
      zero: (n) => n === 0,
      what: `linhas em ${table} com valor que o CHECK do schema.sql recusa`,
      fix: `update ${table} set ${table === "triagens" ? "classificacao" : "status"} = ... ;  -- valores aceitos: (${lista})`,
    });
  }

  for (const check of queries) {
    try {
      const result = await client.query(check.sql);
      const n = result.rows[0]?.n ?? 0;
      if (!check.zero(n)) {
        problems.push({ what: `${check.label}: ${n}`, fix: check.fix });
      }
    } catch (error) {
      problems.push({ what: `não foi possível conferir ${check.label} (${error.message})`, fix: null });
    }
  }
  return problems;
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

  section("6. Índices e constraints que o app espera");
  let drift = [];
  try {
    drift = await checkSchemaObjects(client);
    if (drift.length === 0) {
      console.log(`  [ok] os ${EXPECTED_INDEXES.length} índices e os ${EXPECTED_CONSTRAINTS.length} constraints do schema estão aqui.`);
    } else {
      for (const item of drift) console.log(`  [faltando] ${item}`);
      console.log("  Por que importa: sem os índices, cada listagem do app varre a tabela inteira (seq scan + sort) e o");
      console.log("  primeiro `drizzle-kit push` num schema.ts sem eles REMOVE os que existiam. O fix é o mesmo:");
      console.log("    npm run db:setup   # cria o que falta, sem apagar seus dados");
    }
  } catch (error) {
    console.log(`  [aviso] não foi possível conferir índices/constraints: ${error.message}`);
  }

  section("7. A query do cadastro (a mesma do erro)");
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

  section("8. Integridade dos dados (o que quebra tela, não a conexão)");
  const integrity = await checkIntegrity(client);
  if (integrity.length === 0) {
    console.log("  [ok] nenhuma conta órfã, sessão vencida ou status fora do CHECK.");
  } else {
    for (const problem of integrity) {
      console.log(`  [atenção] ${problem.what}`);
      if (problem.fix) console.log(`            -> ${problem.fix}`);
    }
  }

  await client.end();

  section("Resultado");
  if (missing.length === 0 && queryOk && drift.length === 0 && integrity.length === 0) {
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

  if (drift.length > 0) {
    console.log(`  [erro] Faltam ${drift.length} objeto(s) de schema (índices/constraints) neste banco.`);
    console.log("         As telas funcionam, mas cada listagem vira varredura completa -- e o proximo");
    console.log("         `npm run db:push` passa a propor DROP dos índices de quem criou via schema.sql.");
    console.log("         Rode `npm run db:setup`: ele adiciona o que falta sem tocar nos dados.");
    process.exitCode = 1;
    return;
  }

  if (integrity.length > 0) {
    console.log(`  [aviso] O banco responde e o schema está ok, mas há ${integrity.length} problema(s) de dados.`);
    console.log("         Cada um deles é tela vazia/erro de permissão aparente na tela errada -- o SQL de");
    console.log("         correção está impresso na seção 8.");
    process.exitCode = 1;
    return;
  }

  console.log("  [aviso] As tabelas existem, mas a query do cadastro falhou -- veja o erro da seção 6.");
  console.log("         Erros de permissão/RLS são os suspeitos: o app usa um único usuário, então confira");
  console.log("         se DATABASE_URL aponta para o usuário 'postgres' do projeto.");
  process.exitCode = 1;
}

await main();
