# cardajuda2026

App de telemedicina com foco em cuidado cardíaco: pacientes acompanham medições, consultas e
alertas; médicos fazem triagem, atendem e acompanham o histórico. Next.js 16 (App Router,
Server Actions) + PostgreSQL via Drizzle ORM + Tailwind, empacotável como APK com Capacitor.

## Rodando o projeto

```bash
npm install
```

Crie o arquivo **`.env.local`** na raiz (não versionado) com a connection string do seu banco:

```dotenv
DATABASE_URL=postgresql://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres?sslmode=require
```

Depois:

```bash
npm run db:check     # confere se dá para conectar e se as 13 tabelas existem
npm run db:setup     # cria as tabelas (supabase/schema.sql) no banco da DATABASE_URL
npm run db:seed      # opcional: contas de demonstração (senha 123456)
npm run dev          # http://localhost:3000
```

Contas de demonstração criadas pelo `db:seed`: `maria@email.com` (paciente) e
`ana@cardiajuda.com` (médica), senha `123456`. Detalhes dos scripts SQL e da connection string
do Supabase em [supabase/README.md](supabase/README.md).

## Erro ao cadastrar ou entrar: "Failed query: select ... from profiles"

Esse é o erro mais comum deste projeto e ele **não diz qual é o problema**: o Drizzle embrulha
qualquer falha do banco numa mensagem genérica

```
Failed query: select "id", "role", "nome", "email", "telefone", "password_hash", "avatar_url",
"created_at" from "profiles" where "profiles"."email" = $1 limit $2
params: alguem@email.com,1
```

e guarda a causa real em `error.cause` (tabela inexistente, senha errada, DNS, TLS, projeto
pausado...). Todas essas causas produzem exatamente a mesma tela — por isso a primeira coisa a
fazer é descobrir qual delas é a sua:

```bash
npm run db:check
```

O comando acima fala com o MESMO banco que o app usa e mostra host, porta, banco, usuário,
status do DNS, conexão, quais das 13 tabelas existem e se a query do cadastro roda. Depois ele
diz o que fazer. As causas mais frequentes:

| Sintoma no `db:check` | Causa | Solução |
|---|---|---|
| `relation "profiles" does not exist` (42P01) | o banco que a `DATABASE_URL` aponta não tem o schema (por exemplo: as tabelas foram criadas noutro banco, ou num Postgres local via `drizzle-kit push`) | `npm run db:setup` — ou cole `supabase/schema.sql` no SQL Editor do Supabase |
| `password authentication failed` (28P01) | senha errada ou caractere especial (`@ # / : ?`) não codificado na URL | confira a senha no painel do Supabase; codifique `@`→`%40`, `#`→`%23`, `/`→`%2F`, `:`→`%3A` |
| `Tenant or user not found` | usuário do pooler sem o ref do projeto | use `postgres.<ref>` (copie a string de "Session pooler" do painel) |
| `ENOTFOUND` / `ETIMEDOUT` / `ENETUNREACH` | host `db.<ref>.supabase.co` é **somente IPv6**; muitas redes não têm IPv6; ou o projeto está pausado | troque pelo Session pooler (`aws-0-<região>.pooler.supabase.com`), reative o projeto no painel e confira firewall/VPN |
| `self-signed certificate` / erro de certificado | no `pg` 8.16+ o `sslmode=require` passou a exigir verificação completa do certificado | use `?sslmode=require&uselibpqcompat=true` na `DATABASE_URL` |
| `Failed query` só depois de conectar | faltando tabela específica (`sessions`, `pacientes`...) | rode `npm run db:setup` de novo e confira `missingTables` em `/api/health` |

O app foi ajustado para não esconder mais isso:

- as actions de login/cadastro não deixam mais a exceção derrubar a página — a falha volta como
  mensagem na tela, junto com o código e o "o que fazer" (em desenvolvimento, ou com
  `DB_DEBUG_ERRORS=1` em produção);
- o terminal do `npm run dev` mostra as linhas `[auth]` / `[db]` com a causa raiz e a trilha
  completa (`Failed query ... <- error 42P01: relation "profiles" does not exist`);
- `GET /api/health` responde se o banco responde **e** se as 13 tabelas existem:
  `{"ok":false,"missingTables":["profiles",...],"fix":"npm run db:setup"}`;
- o drizzle-kit (`npm run db:push`, `db:studio`) agora lê o mesmo `DATABASE_URL` do app
  (`drizzle.config.ts`), em vez de apontar para um Postgres local.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | build e execução em produção |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint, TypeScript e testes do diagnóstico de banco (runner nativo do Node) |
| `npm run db:check` | diagnóstico completo da conexão (host, DNS, tabelas, a query do cadastro) |
| `npm run db:setup` | aplica `supabase/schema.sql` no banco da `DATABASE_URL` |
| `npm run db:seed` | schema + contas e dados de demonstração |
| `npm run db:push` / `npm run db:studio` | drizzle-kit (usa a mesma `DATABASE_URL`) |
| `npm run android:build` | build do APK (ver [ANDROID.md](ANDROID.md)) |

## Estrutura

- `src/app` — rotas (App Router). `api/health` é o health check do banco.
- `src/lib/actions` — Server Actions (cadastro, login, consultas, triagens, medições).
- `src/lib/session.ts` — sessão por cookie + tabela `sessions` (sem Supabase Auth).
- `src/lib/db-diagnosis.mjs` — desembrulha o erro do Drizzle e traduz cada código do Postgres
  para uma explicação e um próximo passo. Usado pelo app e pelos scripts.
- `src/db/schema.ts` — schema Drizzle (13 tabelas). `supabase/schema.sql` é o mesmo schema em SQL.
- `scripts/` — `db-check`, `db-setup` e os testes.

> Segurança: `DATABASE_URL` é secreta e só é usada no servidor (as telas só recebem dados já
> mapeados; `src/lib/session.ts` e os módulos de dados importam `server-only`). Nunca use o
> prefixo `NEXT_PUBLIC_` nela e não versione o `.env.local`.
