# Carda Ajuda no Supabase

Arquivos SQL prontos para o **SQL Editor** do Supabase (Dashboard → SQL Editor → New query).
Foram gerados a partir de `src/db/schema.ts` com `drizzle-kit generate` e testados de ponta a
ponta: banco criado do zero só com estes arquivos e o app rodando contra ele (22/22 rotas OK).

## Ordem de execução

| # | Arquivo | Obrigatório? | O que faz |
|---|---|---|---|
| 1 | `00_diagnostico.sql` | **Sim, rode primeiro** | Só leitura. Compara as suas tabelas atuais com o que o app espera. |
| 2 | `01_schema.sql` | Sim | Cria as 13 tabelas, FKs, índices e desliga o RLS. Não apaga nada. |
| 3 | `00b_contagem.sql` | Opcional | Conta as linhas de cada tabela. |
| 4 | `02_seed.sql` | Recomendado | Dados de exemplo + contas para conseguir logar. |
| 5 | `99_reset_destrutivo.sql` | **Só se precisar** | Apaga as tabelas. Vem travado; exige trocar dois `false` por `true`. |

Os scripts 1, 2 e 4 são **idempotentes**: pode rodar de novo sem quebrar nem duplicar.

## Por que rodar o diagnóstico antes

`CREATE TABLE IF NOT EXISTS` **passa em silêncio** se a tabela já existe. Se as suas tabelas
têm nomes de coluna diferentes, o schema "aplica sem erro" e o app quebra depois com
`column "x" does not exist`. O `00_diagnostico.sql` mostra a divergência antes:

- `FALTA (o app precisa)` → bloqueante. Me mande a saída; a solução é renomear a coluna ou
  rodar o `99_reset_destrutivo.sql`.
- `SOBRA (inofensiva)` → coluna sua que o app não lê. Pode continuar lá.

## Conectando o app

`src/db/index.ts` lê `process.env.DATABASE_URL` e faz `new Pool({ connectionString })`.
Pegue a string em **Project Settings → Database → Connection string**.

```
# .env.local  (NUNCA commite este arquivo)
DATABASE_URL=postgresql://postgres.<ref-do-projeto>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=require
```

Três pontos que valem atenção:

1. **`?sslmode=require` não é opcional.** Testado no `pg@8.20.0` instalado: sem esse parâmetro
   o driver conecta **sem SSL** e o Supabase recusa com `no pg_hba.conf entry ... SSL off`.
   Com o parâmetro, `pg-connection-string` liga SSL e trata `require` como `verify-full`.
2. **Porta 5432 = session pooler** (recomendado para este app: conexões de longa duração,
   uma por processo). Porta **6543 = transaction pooler**, para serverless/Vercel com muitas
   instâncias. Conexão direta (`db.<ref>.supabase.co`) é **IPv6-only** em projetos novos e
   costuma falhar em hosts só-IPv4.
3. No pooler o usuário é **`postgres.<ref-do-projeto>`**, não só `postgres`.

Nas variáveis de ambiente da Vercel, coloque a mesma string em `DATABASE_URL` (marque
"Encrypt" / não exponha). O app só acessa o banco pelo servidor — `src/lib/*` importa
`server-only` — então a chave nunca vai para o navegador.

## Alternativa ao SQL Editor

Em vez de colar o `01_schema.sql`, dá para o Drizzle aplicar sozinho:

```bash
DATABASE_URL="postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=require" \
  npx drizzle-kit push
```

Faz o mesmo DDL a partir de `src/db/schema.ts`. A diferença: **não cria os índices** desta
pasta e **não popula dados** — para isso rode o `02_seed.sql` no SQL Editor de qualquer forma.

## Sobre o RLS

Este app **não usa Supabase Auth**. A autenticação é própria: bcrypt em `profiles.password_hash`
mais um cookie na tabela `sessions`, tudo no servidor. O `01_schema.sql` desliga o RLS nas 13
tabelas por isso.

Isso importa porque RLS ligado sem política faz todo `SELECT` voltar **vazio, sem erro nenhum**
— o sintoma é logar certinho e ver as telas sem dado nenhum, o que é horrível de diagnosticar.

Se um dia você expor estas tabelas pela chave `anon` via PostgREST, reative o RLS e escreva
políticas. Nunca coloque a senha do role `postgres` no cliente.

## Login de teste (após o `02_seed.sql`)

| Perfil | Email | Senha |
|---|---|---|
| Paciente | `maria@email.com` | `123456` |
| Paciente | `joao@email.com` | `123456` |
| Médica | `ana@cardiajuda.com` | `123456` |
| Médico | `carlos@cardiajuda.com` | `123456` |

O hash gravado é bcrypt custo 10, o mesmo formato que `signupPacienteAction` produz, então o
login funciona igual a uma conta criada pela tela de cadastro.

## Armadilha conhecida: acentos em `cardapio_semanal.dia_semana`

`getCardapioDoDia()` faz `WHERE dia_semana = <nome>` com comparação **exata** contra o array
`DIAS_SEMANA` de `src/lib/queries.ts`. Os nomes têm de ser byte-a-byte iguais, acentos
incluídos: `'Terça-feira'`, `'Sábado'`. Se o acento sumir, o cardápio desaparece da tela
`/paciente/inicio` sem nenhum erro no log. (Isso aconteceu na primeira versão deste seed e foi
corrigido — vale saber se alguém reescrever o arquivo.)

## Índices

O `drizzle-kit` não gera índice nenhum, e no Postgres uma foreign key **não** indexa a coluna
que referencia. Sem os 14 índices do `01_schema.sql`, cada listagem por paciente vira um seq
scan. As colunas seguem os `ORDER BY` de `src/lib/queries.ts`.

Se você usar `drizzle-kit push` depois, ele vai propor remover esses índices (não estão em
`src/db/schema.ts`). Recuse, ou adicione-os ao schema.

## O que estes arquivos não fazem

- Não criam nada em `auth.users`, `storage.objects` ou em qualquer outra tabela sua.
- Não configuram bucket de storage (o campo `profiles.avatar_url` existe, mas o app ainda não
  faz upload).
- Não criam trigger nem função. A regra de "medição fora da faixa gera alerta" vive em
  `src/lib/actions/medicoes.ts`, não no banco.
