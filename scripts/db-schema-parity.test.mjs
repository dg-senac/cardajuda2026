#!/usr/bin/env node
/**
 * npm test -- paridade entre src/db/schema.ts e supabase/schema.sql.
 *
 * Por que este arquivo existe: o app tem DUAS descrições do mesmo banco (o
 * Drizzle TS, usado por `db:push`/`generate`/`studio`, e o SQL, aplicado pelo
 * `db:setup` e colado no SQL Editor do Supabase). Enquanto elas divergirem, um
 * comando "conserta" e o outro quebra. Já aconteceu de verdade aqui:
 *
 *   - schema.ts sem os índices -> um `npm run db:push` apagou os 14 índices que o
 *     schema.sql tinha criado (o drizzle-kit remove o que não está no schema TS);
 *   - schema.sql sem os CHECK/status -> banco "ok" no db:setup e erro 23514
 *     aparecendo só quando alguém gravava um status inesperado.
 *
 * O teste não precisa de banco: ele lê os dois arquivos. Rodar `npm test` em CI
 * ou antes do commit já pega a deriva.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { APP_TABLES } from "../src/lib/db-diagnosis.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaTs = fs.readFileSync(path.join(ROOT, "src/db/schema.ts"), "utf8");
const schemaSql = fs.readFileSync(path.join(ROOT, "supabase/schema.sql"), "utf8");

/** Blocos `export const X = pgTable(...)` com as chaves balanceadas. */
function tsTables(source) {
  const blocks = new Map();
  const marker = /export const (\w+) = pgTable\(/g;
  for (const match of source.matchAll(marker)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      const char = source[i];
      if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      i += 1;
    }
    blocks.set(match[1], source.slice(start, i - 1));
  }
  return blocks;
}

/** Divide o objeto de colunas em definições de nível topo (sem cair em `(...)`). */
function splitColumnDefs(region) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of region) {
    if (char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ")" || char === "}" || char === "]") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function parseTsTable(body) {
  const name = /^\s*"([a-z_]+)"/.exec(body)?.[1];

  // 2o argumento do pgTable: o objeto { col: type("col_name")... }
  const open = body.indexOf("{");
  let depth = 0;
  let close = -1;
  for (let i = open; i < body.length; i += 1) {
    if (body[i] === "{") depth += 1;
    else if (body[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  const columnsRegion = body.slice(open + 1, close === -1 ? body.length : close);
  const defs = splitColumnDefs(columnsRegion);

  const columns = [];
  const indexes = new Set();
  const checks = new Set();

  for (const def of defs) {
    const match = /^\s*(\w+):\s*\w+\(\s*"([a-z_]+)"/.exec(def);
    if (!match) continue;
    const [, , column] = match;
    columns.push(column);
    // `.unique()` sem nome => <tabela>_<coluna>_unique (convenção do Drizzle)
    if (/\.unique\(\s*\)/.test(def)) indexes.add(`${name}_${column}_unique`);
    // .references(() => medicos.id) => <tabela>_<coluna>_<tabela_ref>_<col_ref>_fk
    const fk = /\.references\(\s*\(\)\s*=>\s*(\w+)\.(\w+)/.exec(def);
    if (fk) checks.add(`${name}_${column}_${fk[1]}_${fk[2]}_fk`);
  }

  // 3o argumento: índices, CHECKs e uniques com nome próprio
  const extra = body.slice(close === -1 ? body.length : close);
  for (const m of extra.matchAll(/(?:index|uniqueIndex)\(\s*"([a-z_0-9]+)"/g)) indexes.add(m[1]);
  for (const m of extra.matchAll(/unique\(\s*"([a-z_0-9]+)"\s*\)/g)) indexes.add(m[1]);
  for (const m of extra.matchAll(/check\(\s*"([a-z_0-9]+)"/g)) checks.add(m[1]);

  return { name, columns, indexes, checks };
}

/** `create table if not exists "public"."x" (...)` do schema.sql. */
function parseSqlTable(source, table) {
  const marker = source.indexOf(`create table if not exists "public"."${table}" (`);
  if (marker === -1) return null;
  const start = marker + `create table if not exists "public"."${table}" (`.length;
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") depth -= 1;
    i += 1;
  }
  const body = source.slice(start, i - 1);

  const columns = [...body.matchAll(/^\s{2}"([a-z_]+)"\s+\w/gm)].map((m) => m[1]);
  const constraints = new Set(
    [...body.matchAll(/constraint "([a-z_0-9]+)"/g)].map((m) => m[1]),
  );
  return { columns, constraints, body };
}

const tsBlocks = tsTables(schemaTs);
const parsed = new Map();
for (const [exportName, body] of tsBlocks) {
  parsed.set(exportName, parseTsTable(body));
}

test("o schema.ts e o schema.sql declaram as mesmas 13 tabelas de APP_TABLES", () => {
  const tsTableNames = new Set([...parsed.values()].map((t) => t.name));
  const sqlTableNames = new Set(
    [...schemaSql.matchAll(/create table if not exists "public"\."([a-z_]+)"/g)].map((m) => m[1]),
  );

  assert.equal(tsTableNames.size, 13, "13 pgTable() em src/db/schema.ts");
  assert.deepEqual([...tsTableNames].sort(), [...APP_TABLES].sort());
  assert.deepEqual(
    [...sqlTableNames].sort(),
    [...APP_TABLES].sort(),
    "o schema.sql tem que criar exatamente as tabelas que o db:check procura",
  );
});

for (const table of APP_TABLES) {
  test(`${table}: colunas iguais em schema.ts e schema.sql`, () => {
    const entry = [...parsed.values()].find((t) => t.name === table);
    assert.ok(entry, `src/db/schema.ts precisa declarar a tabela ${table}`);

    const sql = parseSqlTable(schemaSql, table);
    assert.ok(sql, `supabase/schema.sql precisa ter "create table if not exists public.${table}"`);

    assert.deepEqual(
      [...entry.columns].sort(),
      [...sql.columns].sort(),
      `as colunas de ${table} divergem entre os dois arquivos`,
    );
  });
}

test("todo índice declarado no schema.ts também existe no schema.sql (e vice-versa)", () => {
  const tsIndexes = new Set();
  for (const entry of parsed.values()) {
    for (const name of entry.indexes) tsIndexes.add(name);
  }

  const sqlIndexes = new Set(
    [...schemaSql.matchAll(/create (?:unique )?index if not exists "([a-z_0-9]+)"/g)].map((m) => m[1]),
  );
  // unique declarada dentro do create table também vira índice no Postgres
  for (const table of APP_TABLES) {
    const sql = parseSqlTable(schemaSql, table);
    for (const name of sql?.constraints ?? []) {
      if (/unique$/.test(name)) sqlIndexes.add(name);
    }
  }

  const soNoTs = [...tsIndexes].filter((name) => !sqlIndexes.has(name));
  const soNoSql = [...sqlIndexes].filter((name) => !tsIndexes.has(name));

  assert.deepEqual(
    soNoTs,
    [],
    "índice no schema.ts sem par no schema.sql: rode `npm run db:generate` e espelhe em supabase/schema.sql",
  );
  assert.deepEqual(
    soNoSql,
    [],
    "índice no schema.sql que o schema.ts não conhece: um `drizzle-kit push` VAI DROPÁ-LO. Declare em src/db/schema.ts",
  );
});

test("todo CHECK/FK do schema.ts existe no schema.sql", () => {
  const tsConstraints = new Set();
  for (const entry of parsed.values()) {
    for (const name of entry.checks) tsConstraints.add(name);
  }

  const sqlConstraints = new Set(
    [...schemaSql.matchAll(/constraint "([a-z_0-9]+)"/g)].map((m) => m[1]),
  );
  // as FKs do schema.sql vivem num bloco "add constraint" (lista de DDL)
  for (const match of schemaSql.matchAll(/add constraint "([a-z_0-9]+)"/g)) {
    sqlConstraints.add(match[1]);
  }

  const faltando = [...tsConstraints].filter((name) => !sqlConstraints.has(name));
  assert.deepEqual(
    faltando,
    [],
    "constraint declarada só no schema.ts: o `db:setup` (SQL do Supabase) não a cria",
  );
});

test("as senhas/URLs de produção não voltaram para o repositório", () => {
  const files = ["README.md", "supabase/README.md", ".env.example", ".github/workflows/build-android-apk.yml"];
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(
      source,
      /postgres(ql)?:\/\/[^\s"']*[.@][^\s"']*:[^<\s"]+@/,
      `${file} tem uma connection string com senha embutida -- é segredo, não documentação`,
    );
    assert.doesNotMatch(source, /ousxaegyremkjlwkwzqh/, `${file} referencia o ref do projeto Supabase`);
  }
});
