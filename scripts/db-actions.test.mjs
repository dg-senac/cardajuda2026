#!/usr/bin/env node
/**
 * npm test -- as Server Actions REAIS contra um Postgres de verdade.
 *
 * O resto da suíte lê arquivos e executa SQL. Este arquivo chama as funções que
 * o navegador chama (`signupPacienteAction`, `createMedicaoAction`,
 * `updateConsultaStatusAction`...), com os stubs mínimos de `next/headers`,
 * `next/cache` e `next/navigation` (scripts/test-harness). O `@/db` é o do app:
 * mesma configuração de pool, mesmos `transaction()`, mesmos constraints.
 *
 * É assim que se verifica o que importa num app de saúde: se um INSERT do meio
 * falhar, o que fica no banco? Cada teste abaixo força uma falha no meio de uma
 * action e confere as linhas que sobrariam.
 *
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cardajuda_test npm test
 *
 * Sem TEST_DATABASE_URL o arquivo é pulado (o `npm test` continua passando em
 * qualquer máquina).
 *
 * A URL aponta para o SERVIDOR e para o papel a usar; o banco em si é sempre um
 * `<nome>_actions` criado e recriado por esta suíte (e `<nome>_integ` pela de
 * schema). drop/create direto no banco informado seria um `drop database` em
 * produção por um errinho de digitação. O papel precisa de CREATEDB (padrão no
 * `postgres` local e no Supabase).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { instalarLoader } from "./test-harness/loader.mjs";
import { urlDeAdministrador, urlDoBancoDeTeste } from "./test-harness/url-de-teste.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_TESTE = process.env.TEST_DATABASE_URL;
const SEM_BANCO = URL_TESTE ? false : "defina TEST_DATABASE_URL para rodar os testes de actions";

const COOKIE = "cardiajuda_session";

test("nome do banco de teste é derivado e nunca é o banco informado", () => {
  const casos = [
    ["postgresql://u:p@h:5432/app_db", "postgresql://u:p@h:5432/app_db_actions"],
    // sufixo de teste já existente é TROCADO, não acumulado (reexecução idempotente)
    ["postgresql://u:p@h:5432/cardajuda_test", "postgresql://u:p@h:5432/cardajuda_actions"],
    ["postgresql://u:p@h:5432/cardajuda_actions", "postgresql://u:p@h:5432/cardajuda_actions"],
    ["postgresql://u:p@h:5432/app_db?sslmode=require", "postgresql://u:p@h:5432/app_db_actions?sslmode=require"],
  ];
  for (const [entrada, saida] of casos) {
    const obtido = urlDoBancoDeTeste(entrada, "_actions");
    assert.equal(obtido, saida);
    // A garantia de segurança: um nome que NÃO é de teste nunca sai igual.
    if (entrada !== saida) assert.notEqual(obtido, entrada, "nunca grava no banco de origem");
  }
});

test(
  "Server Actions com transação, escopo e validação (Postgres real)",
  { skip: SEM_BANCO, timeout: 180_000 },
  async (t) => {
    // ---- banco limpo + schema + seed -------------------------------------
    const urlDoBanco = urlDoBancoDeTeste(URL_TESTE, "_actions");
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(urlDoBanco).hostname), "Somente PostgreSQL local descartável; produção proibida");
    const admin = new pg.Client({
      connectionString: urlDeAdministrador(urlDoBanco),
      connectionTimeoutMillis: 15_000,
    });
    try {
      await admin.connect();
      const nomeDoBanco = new URL(urlDoBanco).pathname.slice(1);
      await admin.query(`drop database if exists "${nomeDoBanco}" with (force)`);
      await admin.query(`create database "${nomeDoBanco}"`);
    } catch (err) {
      await admin.end().catch(() => {});
      t.skip(`sem como criar o banco de teste (${err.message.split("\n")[0]})`);
      return;
    }
    await admin.end();

    const setup = new pg.Client({ connectionString: urlDoBanco });
    await setup.connect();
    await setup.query(fs.readFileSync(path.join(ROOT, "supabase/schema.sql"), "utf8"));
    await setup.query(fs.readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));

    await setup.query(fs.readFileSync(path.join(ROOT, "supabase/migrations/20261015_mobile_boundary.sql"), "utf8"));
    // Explicit fixture approvals in this disposable database, never production.
    await setup.query("insert into mobile_private.approved_doctors (medico_id) select id from medicos");
    process.env.DATABASE_URL = urlDoBanco;
    process.env.NODE_ENV = "test";
    instalarLoader();

    const { __resetCookies, __setCookie } = await import("./test-harness/next-headers.mjs");
    const auth = await import("../src/lib/actions/auth.ts");
    const medicoes = await import("../src/lib/actions/medicoes.ts");
    const consultas = await import("../src/lib/actions/consultas.ts");
    const triagens = await import("../src/lib/actions/triagens.ts");
    const misc = await import("../src/lib/actions/misc.ts");
    const queries = await import("../src/lib/queries.ts");
    const { closePool } = await import("../src/db/index.ts");

    const conta = async (sql, params) => (await setup.query(sql, params)).rows;

    // Carimbo da rodada: as contagens abaixo são SEMPRE relativas, porque o seed
    // já traz linhas para os mesmos pacientes (um total absoluto mudaria a cada
    // ajuste de seed e o teste viraria ruído).
    const inicioDaRodada = (await conta("select now() as t"))[0].t;

    async function logar(email) {
      const [perfil] = await conta("select id from profiles where email = $1", [email]);
      const token = crypto.randomUUID();
      await setup.query("insert into sessions (id, user_id, expires_at) values ($1,$2, now() + interval '1 day')", [
        token,
        perfil.id,
      ]);
      __resetCookies();
      __setCookie(COOKIE, token);
      return { token, id: perfil.id };
    }

    t.after(async () => {
      await closePool().catch(() => {});
      await setup.end().catch(() => {});
    });

    // ---------------------------------------------------------------- auth
    await t.test("cadastro grava profiles + pacientes juntos e loga", async () => {
      const form = new FormData();
      for (const [k, v] of Object.entries({
        nome: "Ana Teste E2E",
        cpf: "095.024.101-65", // com máscara: o normalizeCpf tem que aceitar
        telefone: "(81) 99999-1234",
        email: "ana-e2e@test.local",
        senha: "segredo123",
        data_nascimento: "1988-04-12",
        tipo_sanguineo: "B+",
        altura: "1.74",
        genero: "Feminino",
      })) form.append(k, v);

      const resultado = await auth.signupPacienteAction(form);
      assert.deepEqual(resultado, { success: true });

      const [perfil] = await conta("select id, role from profiles where email = 'ana-e2e@test.local'");
      assert.equal(perfil.role, "paciente");
      const [paciente] = await conta("select cpf, idade, altura from pacientes where id = $1", [perfil.id]);
      assert.equal(paciente.cpf, "09502410165", "CPF gravado sem máscara");
      assert.equal(Number(paciente.altura), 1.74);

      const sessao = await conta("select count(*)::int as n from sessions where user_id = $1", [perfil.id]);
      assert.equal(sessao[0].n, 1, "a sessão do cadastro foi criada");
    });

    await t.test("falha no 2o INSERT não deixa perfil órfão (a transação desfaz o 1o)", async () => {
      const antes = (await conta("select count(*)::int as n from profiles"))[0].n;

      const form = new FormData();
      for (const [k, v] of Object.entries({
        nome: "Altura Em Centimetros",
        cpf: "945.994.840-59",
        telefone: "(81) 97777-6666",
        email: "altura-cm@test.local",
        senha: "segredo123",
        data_nascimento: "1970-01-01",
        tipo_sanguineo: "A-",
        altura: "170", // <- o clássico: cm em vez de m
        genero: "Masculino",
      })) form.append(k, v);

      const resultado = await auth.signupPacienteAction(form);
      assert.equal(resultado.success, false);
      assert.match(resultado.error, /Altura inválida/, "mensagem útil em vez de 'Failed query'");

      const depois = (await conta("select count(*)::int as n from profiles"))[0].n;
      assert.equal(depois, antes, "NENHUM profile novo: nada de conta órfã");
      const [emailRepetido] = await conta("select count(*)::int as n from profiles where email='altura-cm@test.local'");
      assert.equal(emailRepetido.n, 0, "tentar de novo não esbarra em 'email já existe'");
    });

    await t.test("erro no banco no meio do cadastro também faz rollback completo", async () => {
      // Força a falha no INSERT de `pacientes` (a segunda perna da transação)
      // escondendo a tabela, como faria um banco com schema incompleto.
      await setup.query("alter table pacientes rename to pacientes_escondida");
      try {
        const form = new FormData();
        for (const [k, v] of Object.entries({
          nome: "Rollback Teste",
          cpf: "112.495.750-28",
          telefone: "(81) 96666-5555",
          email: "rollback@test.local",
          senha: "segredo123",
          data_nascimento: "1990-01-01",
          tipo_sanguineo: "O-",
          altura: "1.80",
          genero: "Masculino",
        })) form.append(k, v);

        const antes = (await conta("select count(*)::int as n from profiles"))[0].n;
        const resultado = await auth.signupPacienteAction(form);
        assert.equal(resultado.success, false);
        const depois = (await conta("select count(*)::int as n from profiles"))[0].n;
        assert.equal(depois, antes, "o profiles do meio da transação foi desfeito junto");
      } finally {
        await setup.query("alter table pacientes_escondida rename to pacientes");
      }
    });

    await t.test("CPF duplicado é detectado mesmo digitado com máscara", async () => {
      const form = new FormData();
      for (const [k, v] of Object.entries({
        nome: "Mesmo CPF",
        cpf: "529.982.247-25", // CPF da Maria do seed, formatado
        telefone: "(81) 95555-4444",
        email: "outro-email@test.local",
        senha: "segredo123",
        data_nascimento: "1985-02-02",
        tipo_sanguineo: "AB+",
        altura: "1.60",
        genero: "Feminino",
      })) form.append(k, v);

      const resultado = await auth.signupPacienteAction(form);
      assert.equal(resultado.success, false);
      assert.match(resultado.error, /CPF/);
    });

    await t.test("login: senha errada não cria sessão, certa cria", async () => {
      const errado = new FormData();
      errado.append("email", "maria@email.com");
      errado.append("password", "nao-e-essa");
      const r1 = await auth.loginAction(errado);
      assert.equal(r1.success, false);
      assert.match(r1.error, /inválidos/);

      const certo = new FormData();
      certo.append("email", "MARIA@email.com"); // email com maiúscula: tem que normalizar
      certo.append("password", "123456");
      const r2 = await auth.loginAction(certo);
      assert.deepEqual(r2, { success: true });
    });

    // ------------------------------------------------------------ medições
    await t.test("medição + alerta são atômicos (alerta quebrado = medição não fica)", async () => {
      await logar("maria@email.com");
      const antes = (await conta("select count(*)::int as n from medicoes"))[0].n;

      const form = new FormData();
      form.append("sistolica", "180");
      form.append("diastolica", "110");
      form.append("glicemia", "200");
      const criado = await medicoes.createMedicaoAction(form);
      assert.deepEqual(criado, { success: true });
      const depois = (await conta("select count(*)::int as n from medicoes"))[0].n;
      assert.equal(depois, antes + 1);
      const alerta = await conta(
        "select status from alertas where tipo='medicao' order by created_at desc limit 1",
      );
      assert.equal(alerta[0].status, "alerta", "medição crítica gerou alerta com status certo");

      // agora com a tabela de alertas fora do lugar: a medição NÃO pode sobrar
      await setup.query("alter table alertas rename to alertas_escondida");
      try {
        const form2 = new FormData();
        form2.append("sistolica", "175");
        form2.append("diastolica", "105");
        form2.append("glicemia", "190");
        const falho = await medicoes.createMedicaoAction(form2);
        assert.equal(falho.success, false);
        const contagem = (await conta("select count(*)::int as n from medicoes"))[0].n;
        assert.equal(contagem, depois, "sem transação, a medição ficaria registrada sem alerta");
      } finally {
        await setup.query("alter table alertas_escondida rename to alertas");
      }
    });

    await t.test("valores impossíveis viram mensagem, não erro de coluna", async () => {
      await logar("maria@email.com");
      const casos = [
        [{ sistolica: "999999999999", diastolica: "80", glicemia: "90" }, /sistólica/],
        [{ sistolica: "120", diastolica: "130", glicemia: "90" }, /maior que a diastólica/],
        [{ sistolica: "abc", diastolica: "80", glicemia: "90" }, /sistólica deve ser um número inteiro/],
      ];
      for (const [valores, esperado] of casos) {
        const form = new FormData();
        for (const [k, v] of Object.entries(valores)) form.append(k, v);
        const r = await medicoes.createMedicaoAction(form);
        assert.equal(r.success, false);
        assert.match(r.error, esperado);
      }
      assert.equal(
        (await conta("select count(*)::int as n from medicoes where sistolica > 1000"))[0].n,
        0,
        "nada absurdo entrou no banco",
      );
    });

    // ----------------------------------------------------------- consultas
    await t.test("status de consulta só muda no banco do dono do atendimento", async () => {
      const ana = await logar("ana@cardiajuda.com");
      const [consultaDaMaria] = await conta(
        `select c.id from consultas c
           join pacientes p on p.id = c.paciente_id
          where c.status = 'agendada' and p.id = (select id from profiles where email='maria@email.com')
          limit 1`,
      );

      const antes = (await conta("select consultas_feitas as n from medicos where id = $1", [ana.id]))[0].n;
      const r1 = await consultas.updateConsultaStatusAction(consultaDaMaria.id, "realizada");
      assert.deepEqual(r1, { success: true });
      const depois = (await conta("select consultas_feitas as n from medicos where id = $1", [ana.id]))[0].n;
      assert.equal(depois, antes + 1, "contador somou 1");

      // clicar de novo em "realizada" não pode somar outra vez
      const r2 = await consultas.updateConsultaStatusAction(consultaDaMaria.id, "realizada");
      assert.deepEqual(r2, { success: true });
      const deNovo = (await conta("select consultas_feitas as n from medicos where id = $1", [ana.id]))[0].n;
      assert.equal(deNovo, depois, "idempotente: duas marcações, um incremento");

      // o outro médico não consegue mexer na consulta alheia
      await logar("carlos@cardiajuda.com");
      const [consultaDeAna] = await conta(
        `select id from consultas where medico_id = $1 and status = 'realizada' limit 1`,
        [ana.id],
      );
      const alheia = await consultas.updateConsultaStatusAction(consultaDeAna.id, "cancelada");
      assert.equal(alheia.success, false);
      assert.match(alheia.error, /não está no seu nome/);
      const statusAtual = await conta("select status from consultas where id = $1", [consultaDeAna.id]);
      assert.equal(statusAtual[0].status, "realizada", "a consulta de outro médico não foi tocada");

      // paciente não tem esse poder
      await logar("maria@email.com");
      const doPaciente = await consultas.updateConsultaStatusAction(consultaDeAna.id, "cancelada");
      assert.equal(doPaciente.success, false);
      assert.match(doPaciente.error, /não permitida/);
    });

    await t.test("agendar consulta exige paciente existente e data válida", async () => {
      await logar("maria@email.com");

      const atrasada = new FormData();
      for (const [k, v] of Object.entries({
        data: "2020-01-01",
        horario: "09:00",
        profissional: "Dr. Teste",
        especialidade: "Cardiologia",
        motivo: "Retorno",
      })) atrasada.append(k, v);
      const r1 = await consultas.createConsultaPacienteAction(atrasada);
      assert.equal(r1.success, false);
      assert.match(r1.error, /passado/);

      const dataRuim = new FormData();
      for (const [k, v] of Object.entries({
        data: "01/01/2030", // formato do dialeto local, aceito pelo <input> em alguns navegadores
        horario: "9h",
        profissional: "Dr. Teste",
        especialidade: "Cardiologia",
        motivo: "Retorno",
      })) dataRuim.append(k, v);
      const r2 = await consultas.createConsultaPacienteAction(dataRuim);
      assert.equal(r2.success, false);
      assert.match(r2.error, /Data inválida/);

      // O campo `paciente_id` enviado pelo cliente é IGNORADO: o vínculo é sempre
      // o perfil logado, senão qualquer paciente agendaria consulta para outro.
      const forjandoPaciente = new FormData();
      for (const [k, v] of Object.entries({
        paciente_id: "99999999-9999-4999-8999-999999999999",
        nome_paciente: "Invasor",
        data: "2030-01-01",
        horario: "09:00",
        profissional: "Dra. Ana",
        medico_id: "aaaaaaaa-0000-0000-0000-000000000001",
        especialidade: "Cardiologia",
        motivo: "Retorno",
      })) forjandoPaciente.append(k, v);
      const r3 = await consultas.createConsultaPacienteAction(forjandoPaciente);
      assert.equal(r3.success, true);
      const criada = await conta(
        "select paciente_id, medico_id, nome_paciente from consultas where data='2030-01-01' and motivo='Retorno'",
      );
      const [perfilLogado] = await conta(
        "select nome from profiles where email = 'maria@email.com' and role = 'paciente'",
      );
      assert.equal(criada[0].nome_paciente, perfilLogado.nome, "quem agenda é o perfil logado, não o form");
      assert.equal(
        criada[0].medico_id,
        "aaaaaaaa-0000-0000-0000-000000000001",
        "nome digitado casa com o cadastro -> agenda do médico recebe a consulta",
      );

      // Nome que não existe no cadastro: a consulta entra assim mesmo, sem vínculo.
      const semMatch = new FormData();
      for (const [k, v] of Object.entries({
        data: "2030-01-02",
        horario: "09:00",
        profissional: "Dr. Desconhecido",
        especialidade: "Cardiologia",
        motivo: "Retorno",
      })) semMatch.append(k, v);
      assert.equal((await consultas.createConsultaPacienteAction(semMatch)).success, false);
      const optativa = await conta("select medico_id from consultas where data='2030-01-02'");
      assert.equal(optativa.length, 0, "sem UUID não se cria consulta nem vínculo");

      const [consultaFantasma] = [crypto.randomUUID()];
      const medicoForm = new FormData();
      for (const [k, v] of Object.entries({
        paciente_id: consultaFantasma,
        nome_paciente: "Fantasma",
        data: "2030-01-01",
        horario: "09:00",
        profissional: "Dra. Ana",
        especialidade: "Cardiologia",
        motivo: "x",
      })) medicoForm.append(k, v);
      await logar("ana@cardiajuda.com");
      const r4 = await consultas.createConsultaMedicoAction(medicoForm);
      assert.equal(r4.success, false);
      assert.match(r4.error, /Paciente não encontrado|não foi possível|Não foi possível/, "UUID válido mas inexistente: mensagem, não FK crua");
      assert.equal(
        (await conta("select count(*)::int as n from consultas where nome_paciente='Fantasma'"))[0].n,
        0,
      );
    });

    // ------------------------------------------------------------- triagens
    await t.test("triagem crítica grava alerta junto; triagem normal não", async () => {
      await logar("ana@cardiajuda.com");
      const [paciente] = await conta("select p.id, pr.nome from pacientes p join profiles pr on pr.id = p.id limit 1");

      const antesAlertas = (await conta("select count(*)::int as n from alertas"))[0].n;
      const form = new FormData();
      for (const [k, v] of Object.entries({
        paciente_id: paciente.id,
        nome_paciente: paciente.nome,
        data: "2026-10-14",
        horario: "08:00",
        profissional: "Dra. Ana",
        queixa_principal: "Dor no peito aos esforços",
        classificacao: "vermelha",
      })) form.append(k, v);
      const r = await triagens.createTriagemAction(form);
      assert.deepEqual(r, { success: true });
      const depoisAlertas = (await conta("select count(*)::int as n from alertas"))[0].n;
      assert.equal(depoisAlertas, antesAlertas + 1, "triagem vermelha -> alerta");

      const formVerde = new FormData();
      for (const [k, v] of Object.entries({
        paciente_id: paciente.id,
        nome_paciente: paciente.nome,
        data: "2026-10-14",
        horario: "08:30",
        profissional: "Dra. Ana",
        queixa_principal: "Acompanhamento de rotina",
        classificacao: "verde",
      })) formVerde.append(k, v);
      await triagens.createTriagemAction(formVerde);
      const [triagensNovas] = await conta(
        "select count(*)::int as n from triagens where paciente_id = $1 and created_at >= $2",
        [paciente.id, inicioDaRodada],
      );
      assert.equal(triagensNovas.n, 2, "as duas triagens desta rodada entraram");
      assert.equal((await conta("select count(*)::int as n from alertas"))[0].n, depoisAlertas, "verde não gera alerta");

      const formRuim = new FormData();
      for (const [k, v] of Object.entries({
        paciente_id: paciente.id,
        nome_paciente: paciente.nome,
        data: "2026-10-14",
        horario: "08:45",
        profissional: "Dra. Ana",
        queixa_principal: "teste",
        classificacao: "roxa",
      })) formRuim.append(k, v);
      const rruim = await triagens.createTriagemAction(formRuim);
      assert.equal(rruim.success, false);
      assert.match(rruim.error, /Classificação inválida/);
    });

    // --------------------------------------------------- pendências e plano
    await t.test("pendência só é concluída pelo médico dela", async () => {
      await logar("carlos@cardiajuda.com");
      const [ajena] = await conta(
        `select p.id from pendencias p
           join profiles pr on pr.id = p.medico_id
          where pr.email = 'ana@cardiajuda.com' and p.concluida = false limit 1`,
      );
      const r = await misc.togglePendenciaAction(ajena.id, true);
      assert.equal(r.success, false);
      assert.match(r.error, /não é sua/);
      const [estado] = await conta("select concluida from pendencias where id = $1", [ajena.id]);
      assert.equal(estado.concluida, false);
    });

    await t.test("assinar plano: valida o plano e mantém ficha e assinatura iguais", async () => {
      await logar("joao@email.com");
      const [plano] = await conta("select id, nome from planos order by nome limit 1");

      const r = await misc.assinarPlanoAction(plano.id);
      assert.deepEqual(r, { success: true });
      const [assinatura] = await conta(
        `select a.status, p.plano from assinaturas a
           join pacientes p on p.id = a.paciente_id
          where a.paciente_id = (select id from profiles where email='joao@email.com')
            and a.status = 'ativa'`,
      );
      assert.equal(assinatura.status, "ativa");
      assert.equal(assinatura.plano, plano.nome, "pacientes.plano acompanhou a assinatura");

      const inexistente = await misc.assinarPlanoAction(crypto.randomUUID());
      assert.equal(inexistente.success, false);
      assert.match(inexistente.error, /não está mais disponível/);

      const invalido = await misc.assinarPlanoAction("");
      assert.equal(invalido.success, false);
      assert.match(invalido.error, /Plano inválido/);
    });

    await t.test("uma única assinatura ativa por paciente", async () => {
      await logar("joao@email.com");
      const [outro] = await conta("select id from planos order by nome desc limit 1");
      await misc.assinarPlanoAction(outro.id);
      const ativas = await conta(
        `select count(*)::int as n from assinaturas
          where paciente_id = (select id from profiles where email='joao@email.com') and status='ativa'`,
      );
      assert.equal(ativas[0].n, 1, "a anterior foi cancelada na mesma transação");
    });

    // -------------------------------------------------------------- queries
    await t.test("listPacientesComUltimaMedicao devolve uma medição por paciente", async () => {
      await logar("ana@cardiajuda.com");
      const lista = await queries.listPacientesComUltimaMedicao();
      assert.ok(lista.length >= 1);
      for (const paciente of lista) {
        assert.ok(paciente.ultima === null || typeof paciente.ultima.sistolica === "number");
      }
      for (const paciente of lista) {
        if (!paciente.ultima) continue;
        const [esperada] = await conta(
          "select sistolica from medicoes where paciente_id = $1 order by created_at desc limit 1",
          [paciente.id],
        );
        assert.equal(
          paciente.ultima.sistolica,
          esperada.sistolica,
          `distinta de ${paciente.nome}: a query tem que devolver a medição MAIS RECENTE`,
        );
      }
      assert.ok(lista.every((p) => Object.values(p.ultima ?? {}).every((v) => v !== undefined)));
    });

    await t.test("busca escapa % e _ (LIKE não vira curinga)", async () => {
      const tudo = await queries.listPacientes();
      const comCuringa = await queries.listPacientes("%");
      assert.equal(comCuringa.length, 0, "'%' sozinho não pode devolver a lista inteira");
      assert.ok(tudo.length >= 1);

      const porNome = await queries.listPacientes("Maria");
      assert.equal(porNome.length, 1);
      const porCpfDigitos = await queries.listPacientes("52998224725");
      assert.equal(porCpfDigitos.length, 1, "busca por CPF sem máscara acha o paciente");
    });

    await t.test("listPendenciasComPaciente traz o nome sem N+1", async () => {
      const [ana] = await conta("select id from profiles where email='ana@cardiajuda.com'");
      const lista = await queries.listPendenciasComPaciente(ana.id);
      assert.ok(lista.length >= 1);
      for (const p of lista) {
        assert.ok(p.pacienteNome && p.pacienteNome !== "Paciente", "nome veio do JOIN");
      }
    });

    await t.test("sessão expirada é limpa no login seguinte", async () => {
      const [maria] = await conta("select id from profiles where email='maria@email.com'");
      await setup.query(
        "insert into sessions (id, user_id, expires_at) values ('vencida-1',$1, now() - interval '1 day')",
        [maria.id],
      );
      const form = new FormData();
      form.append("email", "maria@email.com");
      form.append("password", "123456");
      await auth.loginAction(form);
      const restantes = await conta("select id from sessions where user_id = $1", [maria.id]);
      assert.ok(!restantes.some((r) => r.id === "vencida-1"), "a linha vencida saiu da tabela");
    });
  },
);
