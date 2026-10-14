#!/usr/bin/env node
/**
 * npm test -- o schema + as queries do app contra um Postgres de verdade.
 *
 * Os outros testes deste diretório são estáticos (leem arquivos). Este aqui
 * executa: aplica supabase/schema.sql e seed.sql num banco vazio e confere o
 * comportamento que o app depende -- constraint recusando valor errado, índice
 * realmente usado no plano, `distinct on` devolvendo uma medição por paciente,
 * cascade de FK e re-execução idempotente.
 *
 * É voluntário: sem TEST_DATABASE_URL ele se marca como "skip" e o `npm test`
 * continua passando em qualquer máquina/CI.
 *
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cardajuda_test npm test
 *
 * O banco usado é sempre um `<nome>_integ` criado do zero por esta suíte, para
 * que nem o seu banco de desenvolvimento nem o da outra suíte (que roda em
 * paralelo) apareçam nas contagens. O papel precisa de CREATEDB.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { APP_TABLES } from "../src/lib/db-diagnosis.mjs";
import { urlDeAdministrador, urlDoBancoDeTeste } from "./test-harness/url-de-teste.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_TESTE = process.env.TEST_DATABASE_URL;
const SEM_BANCO = URL_TESTE ? false : "defina TEST_DATABASE_URL para rodar os testes de banco";

const opcoes = { skip: SEM_BANCO, timeout: 120_000 };

/** Estado do banco, compartilhado entre os subtestes. */
let client;

test("schema + seed num Postgres real", opcoes, async (t) => {
  const urlDoBanco = urlDoBancoDeTeste(URL_TESTE, "_integ");
  const admin = new pg.Client({ connectionString: urlDeAdministrador(urlDoBanco), connectionTimeoutMillis: 15_000 });
  try {
    await admin.connect();
    const nome = new URL(urlDoBanco).pathname.slice(1);
    // Do zero: as contagens abaixo são exatas, e sobra de rodada anterior (ou da
    // suíte de actions, que roda em paralelo) transformaria teste em ruído.
    await admin.query(`drop database if exists "${nome}" with (force)`);
    await admin.query(`create database "${nome}"`);
  } catch (err) {
    await admin.end().catch(() => {});
    t.skip(`sem como criar o banco de teste (${err.message.split("\n")[0]})`);
    return;
  }
  await admin.end();

  client = new pg.Client({ connectionString: urlDoBanco, connectionTimeoutMillis: 15_000 });
  await client.connect();

  await t.test("schema.sql aplica num banco vazio e é idempotente", async () => {
    await roda("supabase/schema.sql");
    const primeira = await tabelasDoPublic();
    assert.deepEqual([...primeira].sort(), [...APP_TABLES].sort(), "as 13 tabelas do app");

    await roda("supabase/schema.sql"); // segunda vez: sem erro, sem perder nada
    assert.deepEqual((await tabelasDoPublic()).sort(), [...APP_TABLES].sort());
  });

  await t.test("seed.sql pode rodar duas vezes sem duplicar", async () => {
    await roda("supabase/seed.sql");
    const depoisDeUm = await contagens();
    await roda("supabase/seed.sql");
    const depoisDeDois = await contagens();

    assert.deepEqual(depoisDeUm, depoisDeDois, "rodar o seed de novo não duplica linha nenhuma");
    assert.deepEqual(depoisDeUm, {
      profiles: 4,
      medicos: 2,
      pacientes: 2,
      consultas: 5,
      triagens: 3,
      medicoes: 6,
      alertas: 3,
      pendencias: 3,
      lembretes: 3,
      cardapio_semanal: 28,
      planos: 2,
      assinaturas: 1,
      sessions: 0,
    });
  });

  await t.test("as 13 tabelas ficam com RLS desligado (senão todo SELECT volta vazio)", async () => {
    const rls = await client.query(
      `select relname from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
          and c.relname = any($1::text[])`,
      [APP_TABLES],
    );
    assert.deepEqual(rls.rows, [], "nenhuma tabela do app com row level security ativa");
  });

  await t.test("as queries das telas rodam e casam com o seed", async () => {
    const maria = (
      await client.query(`select id from pacientes where cpf = '52998224725'`)
    ).rows[0];
    assert.ok(maria, "o seed criou a paciente com CPF 52998224725");

    // listPacientesComUltimaMedicao(): o distinct on tem que devolver UMA linha
    // por paciente (a medição mais recente), que e o que a tela de pacientes assume.
    const ultimas = await client.query(`
      select distinct on (m.paciente_id) m.paciente_id, m.sistolica, m.created_at
        from medicoes m
       where m.paciente_id = any($1::uuid[])
       order by m.paciente_id, m.created_at desc`,
      [[maria.id, (await client.query(`select id from pacientes where cpf='11144477735'`)).rows[0].id]],
    );
    assert.equal(ultimas.rowCount, 2, "uma medição por paciente");
    assert.equal(ultimas.rows.find((r) => r.paciente_id === maria.id).sistolica, 148, "a mais recente");

    // getCardapioDoDia() compara por igualdade exata, com acento.
    const sabado = await client.query(
      `select count(*)::int as n from cardapio_semanal where dia_semana = 'Sábado'`,
    );
    assert.equal(sabado.rows[0].n, 4, "Sábado (com acento) tem 4 refeições");
  });

  await t.test("os índices que as telas precisam existem e são utilizáveis", async () => {
    // Com 6 linhas no seed o planejador ESCOLHE seq scan (é mais barato mesmo),
    // entao nao da para exigir "Index Scan" no plano. O truque abaixo desliga o
    // seq scan da sessao: se o indice cobrir a query, ele passa a ser usado -- o
    // que prova que ele existe E que tem as colunas/ordem certas para a listagem.
    await client.query("set enable_seqscan = off");
    try {
      const casos = [
        ["medicoes_paciente_id_created_idx", `select * from medicoes where paciente_id = (select id from pacientes where cpf = '52998224725') order by created_at desc limit 10`],
        ["consultas_paciente_id_data_idx", `select * from consultas where paciente_id = (select id from pacientes where cpf = '52998224725') order by data desc, created_at desc`],
        ["triagens_medico_id_data_idx", `select * from triagens where medico_id = (select id from medicos where crm = 'CRM-PE-12345') order by data desc, created_at desc`],
        ["pendencias_medico_id_created_idx", `select * from pendencias where medico_id = (select id from medicos where crm = 'CRM-PE-12345') order by created_at desc`],
        ["assinaturas_paciente_id_status_idx", `select * from assinaturas where paciente_id = (select id from pacientes where cpf = '52998224725') and status = 'ativa' order by created_at desc limit 1`],
      ];
      for (const [indice, query] of casos) {
        const plano = await client.query(`explain (format json) ${query}`);
        const texto = JSON.stringify(plano.rows[0]["QUERY PLAN"]);
        // EXPLAIN (FORMAT JSON) nao imprime "Index Scan using x": o indice aparece
        // no campo "Index Name" (em "Bitmap Index Scan" tambem), entao e ele que
        // se procura.
        const usaIndice = new RegExp(`"Index Name":\\s*"${indice}"`).test(texto);
        assert.ok(
          usaIndice,
          `${indice}: a listagem do app não consegue usá-lo (colunas ou ordem diferentes das do ORDER BY) -- ${texto.slice(0, 160)}`,
        );
      }
    } finally {
      await client.query("reset enable_seqscan");
    }
  });

  await t.test("CHECK/unique/FK recusam o que o app também recusa", async () => {
    const paciente = (await client.query(`select id from pacientes limit 1`)).rows[0].id;
    const medico = (await client.query(`select id from medicos limit 1`)).rows[0].id;

    await assert.rejects(
      client.query(`insert into consultas (paciente_id,nome_paciente,data,horario,profissional,especialidade,motivo,status)
                    values ($1,'x','2026-01-01','09:00','a','b','c','concluida')`, [paciente]),
      /check constraint "consultas_status_check"/,
    );
    await assert.rejects(
      client.query(
        `insert into assinaturas (paciente_id,plano_id,status) values ($1,(select id from planos limit 1),'ATIVO')`,
        [paciente],
      ),
      /check constraint "assinaturas_status_check"/,
      "status maiúsculo não pode virar assinatura invisível na tela",
    );
    await assert.rejects(
      client.query(
        `insert into pacientes (id,cpf,data_nascimento,idade,tipo_sanguineo,altura,genero)
         values (gen_random_uuid(),'38572409023','1990-01-01',35,'O+',170.00,'M')`,
      ),
      /check constraint "pacientes_altura_check"/,
      "altura em centímetros (numeric(5,2) aceitava 170,00) agora é recusada pelo banco também",
    );
    await assert.rejects(
      client.query(
        `insert into triagens (paciente_id,medico_id,nome_paciente,data,horario,profissional,queixa_principal,classificacao)
         values ($1,$2,'x','2026-01-01','09:00','a','b','roxa')`,
        [paciente, medico],
      ),
      /check constraint "triagens_classificacao_check"/,
    );
    await assert.rejects(
      client.query(
        `insert into consultas (paciente_id,nome_paciente,data,horario,profissional,especialidade,motivo,status)
         values (gen_random_uuid(),'x','2026-01-01','09:00','a','b','c','agendada')`,
      ),
      /foreign key constraint "consultas_paciente_id_pacientes_id_fk"/,
      "consulta de paciente inexistente (o caso do cadastro salvo pela metade)",
    );
    await assert.rejects(
      client.query(
        `insert into cardapio_semanal (dia_semana,refeicao,descricao) values ('Sábado','Almoço','duplicado')`,
      ),
      /cardapio_semanal_dia_refeicao_unique/,
    );
  });

  await t.test("apagar o perfil derruba paciente, sessões e consultas (cascade)", async () => {
    await client.query("begin");
    const alvo = (await client.query(`select id from pacientes where cpf = '11144477735'`)).rows[0].id;
    const antes = await client.query(
      `select (select count(*) from consultas where paciente_id = $1)::int as consultas,
              (select count(*) from medicoes where paciente_id = $1)::int as medicoes`,
      [alvo],
    );
    assert.ok(antes.rows[0].consultas > 0, "o seed deixou consultas para este paciente");

    await client.query("delete from profiles where id = $1", [alvo]);
    const depois = await client.query(
      `select (select count(*) from pacientes where id = $1)::int as paciente,
              (select count(*) from consultas where paciente_id = $1)::int as consultas,
              (select count(*) from medicoes where paciente_id = $1)::int as medicoes`,
      [alvo],
    );
    assert.deepEqual(depois.rows[0], { paciente: 0, consultas: 0, medicoes: 0 });
    await client.query("rollback");
  });

  await t.test("sessão expirada pode ser limpa sem quebrar login dos outros", async () => {
    const usuario = (await client.query(`select id from profiles where role = 'paciente' limit 1`)).rows[0].id;
    await client.query(
      `insert into sessions (id, user_id, expires_at) values
         ('token-vencido', $1, now() - interval '1 hour'),
         ('token-valido',  $1, now() + interval '1 hour')`,
      [usuario],
    );
    await client.query(`delete from sessions where user_id = $1 and expires_at < now()`, [usuario]);
    const restantes = await client.query(`select id from sessions where user_id = $1`, [usuario]);
    assert.deepEqual(
      restantes.rows.map((r) => r.id),
      ["token-valido"],
      "a limpeza por usuário (createSession) remove só o que venceu",
    );
    await client.query(`delete from sessions where id = 'token-valido'`);
  });

  await t.after(() => client?.end());
});

async function roda(arquivo) {
  const sql = fs.readFileSync(path.join(ROOT, arquivo), "utf8");
  await client.query(sql);
}

async function tabelasDoPublic() {
  const result = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
  );
  return result.rows.map((row) => row.table_name);
}

async function contagens() {
  const nomes = [
    "profiles",
    "medicos",
    "pacientes",
    "consultas",
    "triagens",
    "medicoes",
    "alertas",
    "pendencias",
    "lembretes",
    "cardapio_semanal",
    "planos",
    "assinaturas",
    "sessions",
  ];
  const result = await client.query(
    `select ${nomes.map((n) => `(select count(*)::int from "${n}") as "${n}"`).join(", ")}`,
  );
  return result.rows[0];
}
