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

test("FK violada: explica o cadastro salvo pela metade", () => {
  const diagnosis = diagnoseDbError(
    pgError(
      "23503",
      'insert or update on table "consultas" violates foreign key constraint "consultas_paciente_id_pacientes_id_fk"',
    ),
  );

  assert.match(diagnosis.summary, /linha dependente não existe/i);
  assert.match(diagnosis.hint, /db:check/);
});

test("numeric overflow (altura em cm) deixa de ser erro misterioso", () => {
  const overflow = diagnoseDbError(pgError("22003", "numeric field overflow"));
  assert.match(overflow.summary, /não cabe na coluna/i);
  assert.match(overflow.hint, /altura/i);

  const inteiro = diagnoseDbError(pgError("22003", "integer out of range"));
  assert.equal(inteiro.summary, overflow.summary);
});

test("violação de CHECK aponta a lista de valores do schema", () => {
  const diagnosis = diagnoseDbError(
    pgError("23514", 'new row for relation "medicoes" violates check constraint "medicoes_status_check"'),
  );

  assert.match(diagnosis.summary, /CHECK/i);
  assert.match(diagnosis.hint, /normal\/atencao\/alerta|atencao/);
});

test("coluna inexistente: é divergência de schema, não SQL errado", () => {
  const diagnosis = diagnoseDbError(pgError("42703", 'column "plano" of relation "pacientes" does not exist'));

  assert.match(diagnosis.summary, /coluna que não existe/i);
  assert.match(diagnosis.hint, /db:setup/);
});

test("uuid/data malformados viram mensagem legível", () => {
  const uuid = diagnoseDbError(pgError("22P02", 'invalid input syntax for type uuid: ""'));
  assert.match(uuid.hint, /hidden|AAAA-MM-DD/);

  const data = diagnoseDbError(pgError("22007", "invalid input syntax for type date: \"hoje\""));
  assert.match(data.summary, /formato que a coluna n[aã]o aceita|date/i);
});

test("erro em cascata dentro de transação não é o erro principal", () => {
  const diagnosis = diagnoseDbError(
    pgError("25P02", "current transaction is aborted, commands ignored until end of transaction block"),
  );

  assert.match(diagnosis.summary, /consequ/i);
  assert.match(diagnosis.hint, /ANTES/);
});

test("statement_timeout do app tem explicação própria", () => {
  const diagnosis = diagnoseDbError(pgError("57014", "canceling statement due to statement timeout"));

  assert.match(diagnosis.summary, /statement_timeout/);
  assert.match(diagnosis.hint, /DB_STATEMENT_TIMEOUT_MS/);
});

test("conexão cortada no meio do handshake (rede/proxy) sai do texto genérico", () => {
  // Foi exatamente o que este sandbox produziu: TCP abre, nada responde.
  const diagnosis = diagnoseDbError(new Error("Connection terminated unexpectedly"));

  assert.equal(diagnosis.code, null);
  assert.match(diagnosis.summary, /ENCERRADA antes do login/i);
  assert.match(diagnosis.hint, /firewall|proxy/i);
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
