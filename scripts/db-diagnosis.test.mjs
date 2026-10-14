#!/usr/bin/env node
/**
 * npm test -- valida o catálogo de diagnóstico.
 *
 * Os casos cobrem justamente as causas que produzem a MESMA tela de erro
 * ("Failed query: select ... from profiles") no cadastro. Se algum dia uma
 * regra mudar de ordem e capturar o erro errado, este teste avisa.
 *
 * Roda com o test runner nativo do Node (sem dependência nova):
 *   npm test
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  describeDatabaseTarget,
  diagnoseDbError,
  getDbRootCause,
  userFacingDbMessage,
} from "../src/lib/db-diagnosis.mjs";

/** Reproduz o formato do erro do Drizzle: causa real escondida em `cause`. */
function drizzleError(cause) {
  const error = new Error(
    'Failed query: select "id", "role", "nome", "email", "telefone", "password_hash", "avatar_url", "created_at" from "profiles" where "profiles"."email" = $1 limit $2\nparams: alguem@email.com,1',
  );
  error.name = "DrizzleQueryError";
  error.cause = cause;
  return error;
}

function pgError(code, message, extra = {}) {
  const error = new Error(message);
  error.name = "error";
  error.code = code;
  return Object.assign(error, extra);
}

function nodeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

test("desembrulha a causa real escondida pelo Drizzle", () => {
  const cause = getDbRootCause(drizzleError(pgError("42P01", 'relation "profiles" does not exist')));

  assert.equal(cause.code, "42P01");
  assert.equal(cause.message, 'relation "profiles" does not exist');
});

test("tabela ausente: explica que o schema não foi aplicado nesse banco", () => {
  const diagnosis = diagnoseDbError(drizzleError(pgError("42P01", 'relation "profiles" does not exist')));

  assert.equal(diagnosis.code, "42P01");
  assert.match(diagnosis.summary, /não existe no banco/i);
  assert.match(diagnosis.hint, /db:setup|schema\.sql/);
});

test("senha errada: aponta a senha e a codificação dos caracteres especiais", () => {
  const diagnosis = diagnoseDbError(
    drizzleError(pgError("28P01", 'password authentication failed for user "postgres"')),
  );

  assert.equal(diagnosis.code, "28P01");
  assert.match(diagnosis.summary, /senha/i);
  assert.match(diagnosis.hint, /%40/);
});

test("pooler com usuário errado: Tenant or user not found", () => {
  const diagnosis = diagnoseDbError(nodeError("28000", "Tenant or user not found"));

  assert.match(diagnosis.summary, /pooler/i);
  assert.match(diagnosis.hint, /postgres\.<ref/);
});

test("host direto do Supabase: DNS explica o problema de IPv6", () => {
  const diagnosis = diagnoseDbError(nodeError("ENOTFOUND", "getaddrinfo ENOTFOUND db.abcdefghijkl.supabase.co"));

  assert.equal(diagnosis.code, "ENOTFOUND");
  assert.match(diagnosis.hint, /IPv6|pooler/i);
});

test("URL malformada: o ENOTFOUND 'base' que o driver inventa não engana o diagnóstico", () => {
  const diagnosis = diagnoseDbError(nodeError("ENOTFOUND", "getaddrinfo ENOTFOUND base"));

  assert.match(diagnosis.hint, /malformada|pooler/i);
});

test("certificado TLS não validado (pg 8.16+ com sslmode=require)", () => {
  const diagnosis = diagnoseDbError(
    nodeError("DEPTH_ZERO_SELF_SIGNED_CERT", "self-signed certificate"),
  );

  assert.match(diagnosis.summary, /certificado/i);
  assert.match(diagnosis.hint, /uselibpqcompat=true/);
});

test("código desconhecido não quebra: cai no texto genérico", () => {
  const diagnosis = diagnoseDbError(pgError("XX000", "internal error"));

  assert.equal(diagnosis.code, "XX000");
  assert.equal(diagnosis.message, "internal error");
  assert.ok(diagnosis.hint.length > 0);
});

test("mensagem para a tela mostra o detalhe só quando habilitado", () => {
  const diagnosis = diagnoseDbError(drizzleError(pgError("42P01", 'relation "profiles" does not exist')));

  assert.doesNotMatch(userFacingDbMessage("cadastro", diagnosis, false), /42P01/);
  assert.match(userFacingDbMessage("cadastro", diagnosis, true), /42P01/);
});

test("descreve o alvo sem vazar a senha", () => {
  const target = describeDatabaseTarget(
    "postgresql://postgres.abcdefghijkl:segredo@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
  );

  assert.equal(target.user, "postgres.abcdefghijkl");
  assert.equal(target.host, "aws-0-sa-east-1.pooler.supabase.com");
  assert.equal(target.database, "postgres");
  assert.ok(target.isSupabasePooler);
  assert.ok(!target.redacted.includes("segredo"));
});

test("avisa sobre os defeitos silenciosos da URL", () => {
  assert.ok(
    describeDatabaseTarget("postgresql://postgres:postgres@127.0.0.1:5432/app_db ").warnings.some((w) =>
      /espaço/i.test(w),
    ),
    "espaço no fim",
  );
  assert.ok(
    describeDatabaseTarget('DATABASE_URL=postgresql://u:p@h:5432/db').warnings.some((w) =>
      /DATABASE_URL=\"/.test(w) || w.includes("DATABASE_URL="),
    ),
    "linha do .env colada como valor",
  );
  assert.ok(
    describeDatabaseTarget("postgresql://u:p#x@h:5432/db").warnings.some((w) => w.includes("%23")),
    "senha com # não codificado",
  );
  assert.ok(
    describeDatabaseTarget("postgresql://u:p@db.abcdefghijkl.supabase.co:5432/postgres").warnings.some((w) =>
      /sslmode/.test(w),
    ),
    "host remoto sem sslmode",
  );
  assert.ok(
    describeDatabaseTarget("postgresql://u:p@h:5432/db?sslmode=require").warnings.some((w) =>
      /uselibpqcompat/.test(w),
    ),
    "sslmode=require vira verify-full",
  );
});

test("URL de Postgres local sem sslmode não gera aviso de TLS", () => {
  const target = describeDatabaseTarget("postgresql://postgres:postgres@127.0.0.1:5432/app_db");

  assert.ok(target.isLocal);
  assert.deepEqual(target.warnings, []);
});
