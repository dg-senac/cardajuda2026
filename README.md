# cardajuda2026

App de telemedicina com foco em cuidado cardíaco: pacientes acompanham medições, consultas e
alertas; médicos fazem triagem, atendem e acompanham o histórico. Next.js 16 (App Router,
Server Actions) + PostgreSQL via Drizzle ORM + Tailwind, empacotável como APK com Capacitor.

## Começando do zero (do Supabase ao celular)

Quatro passos, na ordem. Cada um tem uma forma de conferir que deu certo — e o app **diz na tela**
quando algum deles está faltando (página `/diagnostico`).

1. **Banco no Supabase.** Crie um projeto em [supabase.com](https://supabase.com). Em
   `Project Settings → Database → Connection string → Session pooler`, copie a string inteira e
   troque apenas `[YOUR-PASSWORD]` pela senha do banco.
2. **Criar as tabelas.** No painel, `SQL Editor → New query`: cole o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run** (é idempotente: não apaga nada).
   Opcional: rode também [`supabase/seed.sql`](supabase/seed.sql) para ter contas de teste
   (`maria@email.com` / `123456`).
   *Alternativa por linha de comando:* `cp .env.example .env.local`, cole a `DATABASE_URL` e rode
   `npm run db:setup`. Os mesmos comandos servem para conferir: `npm run db:check`.
3. **Publicar o servidor web** (o app precisa dele: é ele que fala com o banco). Veja
   [Publicar](#publicar-vercel-render-railway) abaixo.
4. **Gerar o APK.** `Actions → Build Android APK` no GitHub, com a variável `APP_SERVER_URL`
   apontando para o endereço do passo 3. Detalhes em [`ANDROID.md`](ANDROID.md).

> **Login ou cadastro dando erro?** Abra `https://SEU-ENDERECO/diagnostico` (ou `/api/health`). A
> página mostra se a `DATABASE_URL` chegou ao servidor, se o banco responde e quais das 13 tabelas
> estão faltando — com o comando exato para resolver. As telas de login e cadastro mostram o mesmo
> aviso no topo quando o banco não está pronto, em vez de uma tela de erro.

## Banco de dados

O app fala com **um PostgreSQL** (Supabase na configuração atual) pela variável `DATABASE_URL`,
usando `pg` + Drizzle ORM. Não há Supabase Auth: login, hash bcrypt e sessões vivem nas próprias
tabelas `profiles` e `sessions`.

```bash
cp .env.example .env.local     # cole a connection string do SEU projeto (nunca no README!)
npm install
npm run db:check               # host, DNS, conexão, tabelas, índices, integridade dos dados
npm run db:setup               # aplica supabase/schema.sql (13 tabelas + FKs + índices)
npm run db:seed                # opcional: contas de demonstração (senha 123456)
npm run dev
```

| Comando | O que faz |
| --- | --- |
| `npm run db:check` | Diagnóstico completo do banco apontado pela `DATABASE_URL`: origem do valor, formato da URL, DNS, conexão, TLS, quais das 13 tabelas existem, se os **índices/constraints** estão lá e se há **dados que quebram tela** (perfil órfão, sessão vencida, status fora do CHECK). |
| `npm run db:setup` | Aplica `supabase/schema.sql`. Idempotente: cria o que falta, **não apaga nada** e não dropa constraint existente. |
| `npm run db:seed` | `schema.sql` + `seed.sql` (contas e dados de demonstração). |
| `npm run db:push` | Aplica o `src/db/schema.ts` direto no banco (drizzle-kit). |
| `npm run db:generate` / `db:migrate` | Gera/executa as migrações de `drizzle/`. Os dois caminhos terminam no **mesmo schema** — há teste que garante isso. |
| `npm run db:studio` | Drizzle Studio no banco da `DATABASE_URL`. |

Detalhes (pooler vs. conexão direta, RLS, reset destrutivo, contas de teste): [`supabase/README.md`](supabase/README.md).

### Onde está a verdade do schema

`src/db/schema.ts` e `supabase/schema.sql` descrevem o mesmo banco e **precisam** bater — os nomes
de índices e constraints são iguais nos dois. `scripts/db-schema-parity.test.mjs` (`npm test`)
confere tabela por tabela, coluna por coluna, índice por índice, sem precisar de banco.

Foi exatamente a ausência dessa checagem que quebrava as coisas antes: o `schema.ts` não declarava
os índices, então um `npm run db:push` derrubava os 14 índices criados pelo `schema.sql`, e toda
listagem virava varredura completa.

### Testes com banco de verdade (opcional)

A suíte padrão não precisa de banco: `npm test` lê arquivos e confere o catálogo de diagnóstico,
a paridade `schema.ts` ↔ `schema.sql` e o que não pode existir no repositório (senha em commit).
As duas suítes abaixo **executam** SQL e só rodam quando você aponta um servidor:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cardajuda_dev npm test
```

Cada suíte cria para si um banco derivado (`<nome>_integ` e `<nome>_actions`) e o recria do zero:
o banco escrito na variável **nunca** é apagado, então um typo não derruba produção. O papel
precisa de `CREATEDB` (padrão no Postgres local e no Supabase). O que cada uma garante:

- `scripts/db-integration.test.mjs` — o `schema.sql` aplica num banco vazio e é idempotente, o
  `seed.sql` roda duas vezes sem duplicar linha, os CHECK/FK/índices funcionam no plano de
  execução e as queries das telas casam com o seed.
- `scripts/db-actions.test.mjs` — chama as **actions reais** (as mesmas que o navegador chama) e
  confere o que sobra no banco quando a gravação falha no meio: se o perfil é desfeito junto com
  o paciente que falhou, se uma medição sem alerta não deixa medição órfã, se um médico consegue
  mexer na consulta do outro, e se `%` digitado na busca vira curinga.

### Segurança

- `DATABASE_URL` **só** existe em `.env.local` (gitignored) e nos secrets do host
  (Vercel/Render/GitHub Actions). Não cole a string em README, issue, print ou commit: o repositório
  é público, e uma connection string com senha vale mais que qualquer dado do app.
- Se uma connection string vazou (como a que esteve no README até hoje), **troque a senha do
  `postgres` no painel do Supabase** — apagar o arquivo do commit não invalida a cópia de quem já
  leu o histórico. Depois atualize `.env.local` e o secret do host.
- O banco é acessado apenas pelo servidor; nada de `NEXT_PUBLIC_DATABASE_URL`.

## Publicar (Vercel, Render, Railway)

O app tem Server Actions e usa o Postgres no servidor: precisa de um host que rode Node — **não**
funciona como site estático (GitHub Pages, Netlify static...).

| O que fazer | Onde |
| --- | --- |
| Conectar o repositório | Vercel → New Project → importe o repositório |
| `DATABASE_URL` | Settings → Environment Variables → adicione a connection string (Production **e** Preview) |
| `DB_DEBUG_ERRORS=1` (opcional) | mostra o detalhe técnico do erro de banco na tela — útil enquanto está configurando, remova depois |
| Deploy | cada push na `main` publica sozinho |

Depois do primeiro deploy, confirme em `https://SEU-ENDERECO/api/health`: deve responder
`{"ok":true}`. Se responder `{"ok":false,...}`, o próprio JSON diz o que falta.

O celular (APK) aponta para esse endereço — veja [`ANDROID.md`](ANDROID.md). O APK **não** leva
`DATABASE_URL`: o banco é acessado só pelo servidor.

## Scripts úteis

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # sem banco: diagnóstico + paridade + checagens do APK (+ SQL e actions com TEST_DATABASE_URL)
npm run build       # build de produção (não precisa de DATABASE_URL)
npm run android:build   # gera o APK (JDK 21 + Android SDK)
```
