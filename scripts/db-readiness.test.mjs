#!/usr/bin/env node
/**
 * npm test -- as telas de login/cadastro sobrevivem a um banco quebrado.
 *
 * O problema que este arquivo trava: `src/db/index.ts` lançava no `import` quando
 * faltava a DATABASE_URL. Como todas as páginas importam `@/db` (direta ou
 * indiretamente), o app inteiro virava a tela de erro 500 do Next -- inclusive
 * /login, que é justamente onde a pessoa precisa ler o que fazer. No APK o
 * sintoma vira "não foi possível carregar a página", sem nenhuma pista.
 *
 * Aqui a verificação é de verdade (sem banco): o módulo é importado SEM
 * DATABASE_URL e a checagem de prontidão é chamada nos cenários de configuração
 * ausente e de host inalcançável. Também confere que as páginas continuam
 * passando pela checagem em vez de consultar o banco direto.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { instalarLoader } from "./test-harness/loader.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (relativo) => fs.readFileSync(path.join(ROOT, relativo), "utf8");

const URL_BANCO = process.env.DATABASE_URL;

test("importar o módulo de banco não explode sem DATABASE_URL", async (t) => {
  t.after(() => {
    if (URL_BANCO === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = URL_BANCO;
  });

  delete process.env.DATABASE_URL;
  instalarLoader();

  const db = await import("../src/db/index.ts");
  assert.equal(db.hasPool(), false, "nenhum pool é aberto só por importar o módulo");

  // A URL só é exigida quando alguém realmente consulta/abre o pool.
  assert.throws(
    () => db.databaseUrl(),
    /DATABASE_URL não está definida/,
    "o erro precisa continuar reconhecível pelo catálogo de diagnóstico",
  );
  assert.throws(() => db.getPool(), /DATABASE_URL não está definida/);
  assert.equal(db.hasPool(), false);

  assert.equal(db.databaseTarget().present, false, "o alvo pode ser descrito sem conectar");

  const ready = await import("../src/lib/db-ready.ts");
  const status = await ready.checkDatabase(true);
  assert.equal(status.ok, false);
  assert.equal(status.kind, "config");
  assert.match(status.title, /Banco de dados não configurado/);
  assert.match(status.hint, /\.env\.local/, "o aviso diz onde criar a variável");
  assert.match(status.hint, /Vercel|Render|Railway/, "e diz o que fazer no servidor publicado");
  assert.equal(ready.targetSummary(status.target), status.target.redacted);
  assert.ok(!status.target.redacted.includes("@:"), "a senha nunca aparece no resumo");

  // A URL malformada tem aviso próprio (não vira "não configurado").
  process.env.DATABASE_URL = "localhost:5432/postgres";
  const malformada = await ready.checkDatabase(true);
  assert.equal(malformada.ok, false);
  assert.equal(malformada.kind, "config");
  assert.match(malformada.title, /inválida/i);
});

test("banco inalcançável vira diagnóstico de conexão, não exceção", async (t) => {
  t.after(() => {
    if (URL_BANCO === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = URL_BANCO;
  });

  instalarLoader();
  // Porta 9 (discard): ninguém escuta -- conexão recusada na hora, sem depender de rede.
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:9/postgres";
  process.env.DB_CONNECTION_TIMEOUT_MS = "3000";

  const { checkDatabase, targetSummary } = await import("../src/lib/db-ready.ts");
  const status = await checkDatabase(true);

  assert.equal(status.ok, false);
  assert.equal(status.kind, "conexao");
  assert.match(status.title, /conectar/i);
  assert.ok(status.hint.length > 20, "a dica precisa dizer o que fazer");
  assert.equal(targetSummary(status.target), "127.0.0.1:9/postgres", "mostra o alvo sem usuário/senha");
  assert.match(status.message, /recusada|escuta|conexão/i, status.message);
});

test("as telas de entrar/cadastrar passam pela checagem antes de consultar o banco", () => {
  for (const arquivo of [
    "src/app/login/page.tsx",
    "src/app/cadastro-paciente/page.tsx",
    "src/app/cadastro-medico/page.tsx",
  ]) {
    const pagina = ler(arquivo);
    assert.match(pagina, /checkDatabase/, `${arquivo} precisa checar o banco antes de renderizar`);
    assert.match(pagina, /AvisoBanco/, `${arquivo} precisa mostrar o aviso quando o banco não está pronto`);
    assert.match(pagina, /db\.ok \?/, `${arquivo} não pode consultar sessão com o banco quebrado`);
    assert.doesNotMatch(
      pagina,
      /await getCurrentProfile\(/,
      `${arquivo} deve usar lookupCurrentProfile (que não lança) quando precisar da sessão`,
    );
  }
});

test("sessão e layouts não derrubam a página quando o banco falha", () => {
  const sessao = ler("src/lib/session.ts");
  assert.match(sessao, /export async function lookupCurrentProfile/);
  assert.match(sessao, /export async function getCurrentProfile/);
  assert.match(sessao, /failure: diagnosis/, "a falha de banco é devolvida, não lançada");

  const auth = ler("src/lib/actions/auth.ts");
  assert.match(auth, /lookupCurrentProfile\(\)/, "requireProfile usa a versão que não lança");
  assert.doesNotMatch(auth, /const profile = await getCurrentProfile\(\)/);

  for (const layout of ["src/app/paciente/layout.tsx", "src/app/medico/layout.tsx"]) {
    assert.match(ler(layout), /lookupCurrentProfile/, `${layout} não pode estourar com o banco fora do ar`);
  }
});

test("/diagnostico e /api/health contam a mesma história", () => {
  const pagina = ler("src/app/diagnostico/page.tsx");
  assert.match(pagina, /checkDatabase\(true\)/, "a página confere na hora (ignora cache)");
  assert.match(pagina, /SETUP_COMMANDS/, "mostra os comandos que resolvem");
  assert.match(pagina, /APP_TABLES/, "lista as tabelas esperadas");
  // A página é pública: nada de hash, senha ou connection string crua nela.
  assert.doesNotMatch(pagina, /passwordHash/);
  assert.doesNotMatch(pagina, /process\.env\.DATABASE_URL/);
  assert.match(pagina, /status\.targetSummary/, "mostra só host:porta/banco, sem usuário nem senha");

  const health = ler("src/app/api/health/route.ts");
  assert.match(health, /checkDatabase\(true\)/, "o endpoint usa a mesma checagem (uma fonte só)");
  assert.match(health, /missingTables/);
});

test("a conferência de colunas usa o próprio schema.ts como verdade", async () => {
  const pronto = ler("src/lib/db-ready.ts");
  assert.match(pronto, /getTableColumns/, "as colunas esperadas vêm do schema.ts, não de uma lista paralela");
  assert.match(pronto, /getTableName/);
  assert.match(pronto, /columnDrift/);

  const { APP_TABLES } = await import("../src/lib/db-diagnosis.mjs");
  const schema = await import("../src/db/schema.ts");
  const tabelasNaLista = pronto.match(/^\s{2}\w+: schema\.\w+,$/gm) ?? [];
  assert.equal(
    tabelasNaLista.length,
    APP_TABLES.length,
    "TABELAS_DO_APP precisa listar exatamente as tabelas de APP_TABLES (senão a conferência de colunas fica cega)",
  );
  for (const tabela of APP_TABLES) {
    const chave = tabela.replace(/_(\w)/g, (_, letra) => letra.toUpperCase());
    assert.ok(schema[chave], `src/db/schema.ts deveria exportar ${chave} (tabela ${tabela})`);
    assert.ok(
      pronto.includes(`schema.${chave}`),
      `TABELAS_DO_APP está sem a tabela ${tabela} (${chave})`,
    );
  }
});

test("o comando db:check avisa quando falta a DATABASE_URL", () => {
  // O script roda em Node puro (sem build): importa o mesmo catálogo, não o app.
  const script = ler("scripts/db-check.mjs");
  assert.match(script, /DATABASE_URL/);
  assert.doesNotMatch(
    script,
    /from "@\/db"/,
    "os scripts de banco não podem depender do alias do Next (rodam sem build)",
  );
});
