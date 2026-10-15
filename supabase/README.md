# Carda Ajuda no Supabase

Os scripts deste diretório são executados no **SQL Editor** do Supabase (Dashboard → SQL Editor → New query) e criam as tabelas do app no schema `public`.

## Instalação em um banco vazio

1. Execute `schema.sql` para criar as 13 tabelas, chaves estrangeiras e índices. O script desativa RLS nessas tabelas.
2. Execute `seed.sql` para inserir dados de demonstração e contas de teste.

`schema.sql` e `seed.sql` são idempotentes: podem ser executados novamente sem apagar dados ou duplicar o seed. O seed inclui quatro contas de teste e 28 refeições (7 dias × 4 refeições).

As tabelas criadas são `profiles`, `pacientes`, `medicos`, `sessions`, `consultas`, `triagens`, `medicoes`, `alertas`, `pendencias`, `lembretes`, `cardapio_semanal`, `planos` e `assinaturas`.

> **Banco já existente:** `CREATE TABLE IF NOT EXISTS` não altera colunas de uma tabela existente. Se o schema atual for incompatível com o app, não conte com `schema.sql` para migrá-lo. Faça backup e confirme o conteúdo antes de usar o reset destrutivo.

## Reset destrutivo

`reset.sql` apaga as 13 tabelas do app. Faça backup antes. Por segurança, o script vem bloqueado: só executa se **as duas** variáveis `confirmar_dados` e `confirmar_schema` forem alteradas de `false` para `true`.

O reset não usa `CASCADE`: se outra tabela ou objeto depender de uma tabela do app, o PostgreSQL interrompe o reset em vez de remover a dependência externa. Depois de um reset bem-sucedido, execute `schema.sql` e, se necessário, `seed.sql` novamente.

## Conectar o app com `DATABASE_URL`

O servidor lê `process.env.DATABASE_URL` em `src/db/index.ts` e conecta usando `pg` (Node.js). No Supabase, copie a connection string em **Project Settings → Database → Connection string**. Configure-a localmente em `.env.local` (não versione esse arquivo):

```dotenv
DATABASE_URL=postgresql://postgres.<ref-do-projeto>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=require
```

Use os valores fornecidos pelo seu projeto e mantenha `sslmode=require` na connection string. A porta `5432` é o session pooler; a `6543` é o transaction pooler, geralmente usado em ambientes serverless. O nome de usuário do pooler normalmente inclui o ref do projeto (`postgres.<ref>`).

Na Vercel ou em outro host, cadastre o mesmo valor como variável de ambiente **privada** `DATABASE_URL` — nunca como `NEXT_PUBLIC_DATABASE_URL`. O acesso ao banco ocorre somente no servidor.

## Erro "Failed query: select ... from profiles" no cadastro/login

O Drizzle embrulha toda falha do banco numa mensagem genérica (`Failed query: <sql>, params: ...`)
e esconde a causa em `error.cause`. Tabela inexistente, senha errada, DNS, TLS e projeto pausado
produzem **a mesma tela** — a diferença está só no código do Postgres. Para descobrir qual é a sua:

```bash
npm run db:check
```

Ele usa o mesmo `.env.local` do app e checa, em ordem: a origem e o formato da `DATABASE_URL`
(senha nunca é exibida), o DNS do host, a conexão, quais das 13 tabelas existem e se a query do
cadastro roda — terminando com o que fazer. Se o problema for schema ausente:

```bash
npm run db:setup   # aplica este schema.sql no banco da DATABASE_URL
npm run db:seed    # opcional: contas de demonstração
```

Os dois scripts usam a `DATABASE_URL` do `.env.local`, ou seja, o MESMO banco do app (diferente de
rodar o SQL "no projeto errado"). Também dá para ver o estado pelo navegador:

- `/diagnostico` — página com a conexão em uso (`host:porta/banco`, sem senha), as 13 tabelas
  (✓/✕), as **colunas** que faltam e o comando que resolve;
- `GET /api/health` — o mesmo em JSON: `{"ok":false,"missingTables":[...],"fix":"npm run db:setup"}`.

As telas de login e cadastro mostram esse aviso no topo quando o banco não está pronto, em vez de
falharem só no envio do formulário.

Causas frequentes, do mais comum ao menos comum:

1. **As tabelas foram criadas noutro banco.** Antes o `drizzle.config.json` versionado apontava para
   `postgresql://postgres:postgres@127.0.0.1:5432/app_db`, então `npx drizzle-kit push` criava as
   tabelas num Postgres local enquanto o app falava com o Supabase. Hoje o `drizzle.config.ts`
   lê a `DATABASE_URL`, mas vale conferir com `npm run db:check` para onde os comandos apontam.
2. **Host direto do Supabase (`db.<ref>.supabase.co`) é somente IPv6.** Em rede sem IPv6 o erro é
   `ENOTFOUND` / `ETIMEDOUT` / `ENETUNREACH`. Use a string do **Session pooler**
   (`aws-0-<região>.pooler.supabase.com:5432`), que tem IPv4, com o usuário `postgres.<ref>`.
3. **Projeto pausado** (plano gratuito) — reative no painel; a primeira conexão demora ~30s.
4. **Senha com caractere especial não codificado** (`@ # / : ?`): codifique como `%40 %23 %2F %3A %3F`
   ou troque por uma senha só de letras e números.
5. **Certificado TLS**: no `pg` 8.16+ o `sslmode=require` passou a significar verificação completa
   (`verify-full`). Se aparecer `self-signed certificate` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, use
   `?sslmode=require&uselibpqcompat=true` (semântica do libpq) na `DATABASE_URL`.
6. **Espaço sobrando no valor** do `.env.local` — o erro vira `database "postgres " does not exist`.
   O app já faz `trim()`, mas corrija o arquivo (e o valor cadastrado na Vercel/GitHub Actions).

## Contas e dados de demonstração

Após executar `seed.sql`, todas as contas abaixo usam a senha `123456`:

| Perfil | E-mail | Senha |
|---|---|---|
| Paciente | `maria@email.com` | `123456` |
| Paciente | `joao@email.com` | `123456` |
| Médica | `ana@cardiajuda.com` | `123456` |
| Médico | `carlos@cardiajuda.com` | `123456` |

As senhas são armazenadas como hashes bcrypt, compatíveis com o cadastro do app. Essas credenciais e os dados clínicos do seed são apenas para desenvolvimento e demonstração; não os use em produção.

## Segurança e RLS

O app não usa Supabase Auth: a autenticação própria guarda o hash bcrypt em `profiles.password_hash` e as sessões em `sessions`. Por isso, `schema.sql` desativa RLS nas 13 tabelas; sem políticas, RLS pode fazer consultas retornarem vazias. Como consequência, mantenha `DATABASE_URL` em segredo e não exponha essas tabelas diretamente pela chave `anon`/PostgREST. Se futuramente precisar desse acesso, reative RLS e crie políticas adequadas.

Os scripts não criam nem alteram `auth.users`, `storage.objects`, buckets ou funções do Supabase. O seed inclui os nomes dos dias da semana com acentos usados pelo app (`Terça-feira`, `Sábado`); não os remova, pois a consulta do cardápio compara esses valores exatamente.
