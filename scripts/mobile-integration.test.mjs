import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { build } from "esbuild";
import {
  urlDeAdministrador,
  urlDoBancoDeTeste,
} from "./test-harness/url-de-teste.mjs";

// Explicitly opt-in, disposable LOCAL database only. NEVER use production DATABASE_URL.
test(
  "Edge API: contas reais, transações, isolamento, revogação e RLS",
  { skip: !process.env.TEST_DATABASE_URL, timeout: 120000 },
  async (t) => {
    const url = urlDoBancoDeTeste(process.env.TEST_DATABASE_URL, "_mobile");
    assert.ok(
      ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
      "Use PostgreSQL local descartável",
    );
    const admin = new pg.Client({ connectionString: urlDeAdministrador(url) });
    await admin.connect();
    const name = new URL(url).pathname.slice(1);
    await admin.query(`create database "${name}"`);
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const output = ".mobile-test-bundle.mjs";
    try {
      await client.query(readFileSync("supabase/schema.sql", "utf8"));
      await client.query(readFileSync("supabase/seed.sql", "utf8"));
      for (const role of ["anon", "authenticated"])
        await client.query(
          `do $$ begin if not exists (select from pg_roles where rolname='${role}') then create role ${role}; end if; end $$`,
        );
      // Simulate Supabase default grants, including a column grant and a permissive old policy.
      await client.query(
        "grant select on all tables in schema public to anon, authenticated; grant select (password_hash) on profiles to anon; create policy old_policy on profiles for select to anon using (true)",
      );
      const migration = readFileSync(
        "supabase/migrations/20261015_mobile_boundary.sql",
        "utf8",
      );
      await client.query("create view public.unsafe_test as select id from profiles; grant select on public.unsafe_test to anon");
      await assert.rejects(client.query(migration), /Views públicas/);
      await client.query("rollback");
      await client.query("drop view public.unsafe_test");
      await client.query("create function public.unsafe_test() returns int language sql security definer as 'select 1'");
      await assert.rejects(client.query(migration), /RPC SECURITY DEFINER/);
      await client.query("rollback");
      await client.query("drop function public.unsafe_test()");
      await client.query(migration);
      await client.query(migration);
      await t.test(
        "RLS e grants negam acesso direto mesmo com política antiga",
        async () => {
          for (const role of ["anon", "authenticated"]) {
            await client.query(`set role ${role}`);
            for (const table of [
              "profiles",
              "sessions",
              "pacientes",
              "medicos",
              "consultas",
              "triagens",
              "medicoes",
              "alertas",
              "pendencias",
              "lembretes",
              "planos",
              "assinaturas",
              "cardapio_semanal",
            ])
              await assert.rejects(client.query(`select * from ${table}`), {
                code: "42501",
              });
            await assert.rejects(
              client.query("select password_hash from profiles"),
              { code: "42501" },
            );
            await assert.rejects(
              client.query("insert into medicoes default values"),
              { code: "42501" },
            );
            await assert.rejects(
              client.query("update profiles set role=role"),
              { code: "42501" },
            );
            await assert.rejects(
              client.query("select * from mobile_private.approved_doctors"),
              { code: "42501" },
            );
            await client.query("reset role");
          }
        },
      );
      process.env.DATABASE_URL = url;
      await build({
        entryPoints: ["edge/api.ts"],
        outfile: output,
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        alias: {
          "next/headers": "./edge/runtime.ts",
          "next/navigation": "./edge/runtime.ts",
          "next/cache": "./edge/runtime.ts",
          "server-only": "./scripts/test-harness/empty.mjs",
        },
        define: {
          "process.env.NODE_ENV": '"production"',
          "process.env.DB_DEBUG_ERRORS": '"0"',
        },
      });
      const { handle } = await import(`../${output}?v=${Date.now()}`);
      const call = async (op, extra = {}, token) => {
        const res = await handle(
          new Request("https://test.supabase.co/functions/v1/mobile-api", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ op, ...extra }),
          }),
        );
        return { status: res.status, ...(await res.json()) };
      };
      const login = async (email) => {
        const r = await call("login", {
          fields: { email, password: "123456" },
        });
        assert.equal(r.result?.success, true);
        assert.ok(r.token);
        return r.token;
      };
      const paciente = await login("maria@email.com");
      const medicoEmail = (
        await client.query(
          "select email from profiles where id='aaaaaaaa-0000-0000-0000-000000000001'",
        )
      ).rows[0].email;
      const medico = await login(medicoEmail);
      const pid = "bbbbbbbb-0000-0000-0000-000000000001";
      const mid = "aaaaaaaa-0000-0000-0000-000000000001";
      await t.test("nega anônimo, IDOR e médico sem aprovação", async () => {
        assert.equal((await call("home")).status, 401);
        assert.equal(
          (
            await call(
              "patient",
              { id: "bbbbbbbb-0000-0000-0000-000000000002" },
              paciente,
            )
          ).status,
          403,
        );
        assert.equal((await call("home", {}, medico)).status, 403);
        assert.equal(
          (
            await call(
              "appointmentStatus",
              {
                id: "dddddddd-0000-0000-0000-000000000001",
                status: "realizada",
              },
              paciente,
            )
          ).status,
          403,
        );
      });
      await client.query(
        "insert into mobile_private.approved_doctors (medico_id) values ($1)",
        [mid],
      );
      await t.test(
        "contas antigas funcionam, dados são filtrados e hashes não saem",
        async () => {
          const home = await call("home", {}, paciente);
          assert.equal(home.status, 200);
          assert.equal(home.result.perfil.id, pid);
          assert.ok(home.result.consultas.every((c) => c.pacienteId === pid));
          assert.doesNotMatch(
            JSON.stringify(home),
            /passwordHash|password_hash|\$2[aby]\$/,
          );
          const dh = await call("home", {}, medico);
          assert.equal(dh.status, 200);
          assert.ok(dh.result.consultas.every((c) => c.medicoId === mid));
          assert.equal(
            (await call("patient", { id: pid }, medico)).status,
            200,
          );
        },
      );
      let newToken;
      await t.test(
        "cadastro atômico, medição persistida e médico sem vínculo negado",
        async () => {
          const r = await call("signupPaciente", {
            fields: {
              nome: "Teste APK",
              email: "apk@example.test",
              senha: "123456",
              telefone: "81999999999",
              genero: "Feminino",
              cpf: "12345678909",
              data_nascimento: "1990-01-01",
              tipo_sanguineo: "O+",
              altura: "1.70",
            },
          });
          assert.equal(r.result?.success, true);
          newToken = r.token;
          const me = await call("me", {}, newToken);
          const newId = me.result.profile.id;
          assert.equal(
            (await call("patient", { id: newId }, medico)).status,
            403,
          );
          assert.equal(
            (await call("triage", { fields: { paciente_id: newId } }, medico))
              .status,
            403,
          );
          assert.equal(
            (
              await call(
                "measurement",
                {
                  fields: {
                    sistolica: "180",
                    diastolica: "110",
                    glicemia: "180",
                  },
                },
                newToken,
              )
            ).result.success,
            true,
          );
          assert.equal(
            (
              await client.query(
                "select count(*)::int n from medicoes where paciente_id=$1",
                [newId],
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await client.query(
                "select count(*)::int n from alertas where paciente_id=$1",
                [newId],
              )
            ).rows[0].n,
            1,
          );
          const tomorrow = new Date(Date.now() + 86400000)
            .toISOString()
            .slice(0, 10);
          assert.equal(
            (
              await call(
                "appointment",
                {
                  fields: {
                    medico_id: mid,
                    data: tomorrow,
                    horario: "10:00",
                    motivo: "Teste",
                  },
                },
                newToken,
              )
            ).result.success,
            true,
          );
          assert.equal(
            (await call("patient", { id: newId }, medico)).status,
            200,
          );
          assert.equal(
            (
              await call(
                "triage",
                {
                  fields: {
                    paciente_id: newId,
                    data: tomorrow,
                    horario: "10:00",
                    queixa_principal: "Teste",
                    classificacao: "vermelha",
                  },
                },
                medico,
              )
            ).result.success,
            true,
          );
        },
      );
      await t.test(
        "cadastro médico não eleva acesso; perfil não pode promover papel",
        async () => {
          const r = await call("signupMedico", {
            fields: {
              nome: "Médico teste",
              email: "doctor@example.test",
              senha: "123456",
              telefone: "81999999999",
              genero: "Masculino",
              crm: "TEST12345",
              especialidade: "Cardiologia",
              formacao: "Teste",
            },
          });
          assert.equal(r.result?.success, true);
          const me = await call("me", {}, r.token);
          assert.equal(me.result.profile.role, "medico");
          assert.equal(me.result.approved, false);
          assert.equal((await call("home", {}, r.token)).status, 403);
          assert.equal(
            (
              await call(
                "profile",
                {
                  fields: {
                    nome: "Teste APK",
                    telefone: "81999999999",
                    role: "medico",
                  },
                },
                newToken,
              )
            ).result.success,
            true,
          );
          assert.equal(
            (await call("me", {}, newToken)).result.profile.role,
            "paciente",
          );
          const fresh = await login("maria@email.com");
          await client.query(
            "update sessions set expires_at=now()-interval '1 second' where id=$1",
            [fresh],
          );
          assert.equal((await call("me", {}, fresh)).status, 401);
        },
      );
      await t.test(
        "sessões concorrentes não se misturam, logout revoga",
        async () => {
          const replies = await Promise.all([
            call("me", {}, paciente),
            call("me", {}, medico),
          ]);
          assert.equal(replies[0].result.profile.id, pid);
          assert.equal(replies[1].result.profile.id, mid);
          assert.equal(
            (await call("logout", {}, newToken)).result.success,
            true,
          );
          assert.equal((await call("me", {}, newToken)).status, 401);
        },
      );
      await t.test("retries de medição não duplicam alerta; troca concorrente de plano serializa", async () => {
        const session = await login("maria@email.com");
        const key = crypto.randomUUID();
        const before = (await client.query("select count(*)::int n from medicoes where paciente_id=$1", [pid])).rows[0].n;
        const request = {fields:{sistolica:"180",diastolica:"100",glicemia:"180",request_id:key}};
        const replies = await Promise.all([call("measurement", request, session),call("measurement", request, session)]);
        assert.ok(replies.every(r => r.result.success));
        assert.equal((await client.query("select count(*)::int n from medicoes where paciente_id=$1", [pid])).rows[0].n, before+1);
        const plans = (await client.query("select id from planos limit 2")).rows;
        await Promise.all(plans.map(p => call("subscribe", {id:p.id}, session)));
        assert.equal((await client.query("select count(*)::int n from assinaturas where paciente_id=$1 and status='ativa'", [pid])).rows[0].n,1);
      });
      await t.test("limite de tentativas persiste no banco", async () => {
        for (let i = 0; i < 10; i++)
          assert.equal(
            (
              await call("login", {
                fields: { email: "missing@example.test", password: "bad" },
              })
            ).status,
            200,
          );
        assert.equal(
          (
            await call("login", {
              fields: { email: "missing@example.test", password: "bad" },
            })
          ).status,
          429,
        );
      });
    } finally {
      delete process.env.DATABASE_URL;
      rmSync(output, { force: true });
      await client.end();
      await admin.query(`drop database "${name}" with (force)`);
      await admin.end();
    }
  },
);
