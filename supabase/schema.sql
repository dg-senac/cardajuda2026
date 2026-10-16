-- ============================================================================
-- schema.sql  --  Schema do Carda Ajuda para Supabase / PostgreSQL
-- ============================================================================
-- Baseado em src/db/schema.ts; inclui as chaves estrangeiras, os índices e os
-- CHECK usados pelo app. As 13 tabelas ficam no schema public.
--
-- * Idempotente: pode rodar de novo quantas vezes quiser.
-- * NÃO apaga tabelas nem linhas, e NÃO dropa constraint existente (veja o
--   bloco "CONSTRAINTS" -- só adiciona o que falta). Para reset destrutivo, leia reset.sql.
-- * Requer PostgreSQL 13+ (gen_random_uuid() nativo; Supabase atual = OK).
-- * Mantido em sincronia com src/db/schema.ts: os mesmos nomes de índice,
--   constraint e as mesmas colunas. `npm run db:check` confere os dois no banco.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TABELAS
-- ---------------------------------------------------------------------------

create table if not exists "public"."profiles" (
  "id"            uuid primary key default gen_random_uuid(),
  "role"          text not null,
  "nome"          text not null,
  "email"         text not null,
  "telefone"      text not null,
  "password_hash" text not null,
  "avatar_url"    text,
  "created_at"    timestamp with time zone default now() not null,
  constraint "profiles_email_unique" unique ("email"),
  constraint "profiles_role_check" check ("role" in ('paciente','medico'))
);

create table if not exists "public"."pacientes" (
  "id"               uuid primary key,
  "cpf"              text not null,
  "data_nascimento"  date not null,
  "idade"            integer not null,
  "tipo_sanguineo"   text not null,
  "altura"           numeric(5,2) not null,
  "genero"           text not null,
  "doencas_cronicas" text[] default '{}'::text[] not null,
  "plano"            text,
  constraint "pacientes_cpf_unique" unique ("cpf"),
  -- numeric(5,2) estoura com "170" (cm em vez de m) e devolve 22003 no meio do
  -- cadastro. O app valida antes; a constraint fecha a porta para os outros
  -- caminhos (seed, SQL Editor, importação).
  constraint "pacientes_altura_check" check ("altura" between 0.30 and 2.80),
  constraint "pacientes_idade_check" check ("idade" between 0 and 130)
);

create table if not exists "public"."medicos" (
  "id"               uuid primary key,
  "crm"              text not null,
  "especialidade"    text not null,
  "formacao"         text not null,
  "genero"           text not null,
  "avaliacao"        numeric(2,1) default '0.0' not null,
  "consultas_feitas" integer default 0 not null,
  constraint "medicos_crm_unique" unique ("crm")
);

create table if not exists "public"."sessions" (
  "id"         text primary key,
  "user_id"    uuid not null,
  "expires_at" timestamp with time zone not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "public"."planos" (
  "id"        uuid primary key default gen_random_uuid(),
  "nome"      text not null,
  "descricao" text not null,
  "preco"     numeric(10,2) not null
);

create table if not exists "public"."consultas" (
  "id"            uuid primary key default gen_random_uuid(),
  "paciente_id"   uuid not null,
  "medico_id"     uuid,
  "nome_paciente" text not null,
  "data"          date not null,
  "horario"       text not null,
  "profissional"  text not null,
  "especialidade" text not null,
  "motivo"        text not null,
  "status"        text not null,
  "created_at"    timestamp with time zone default now() not null,
  constraint "consultas_status_check" check ("status" in ('agendada','realizada','cancelada'))
);

create table if not exists "public"."triagens" (
  "id"               uuid primary key default gen_random_uuid(),
  "paciente_id"      uuid not null,
  "medico_id"        uuid not null,
  "nome_paciente"    text not null,
  "data"             date not null,
  "horario"          text not null,
  "profissional"     text not null,
  "queixa_principal" text not null,
  "classificacao"    text not null,
  "created_at"       timestamp with time zone default now() not null,
  constraint "triagens_classificacao_check" check ("classificacao" in ('verde','amarela','vermelha'))
);

create table if not exists "public"."medicoes" (
  "id"          uuid primary key default gen_random_uuid(),
  "paciente_id" uuid not null,
  "sistolica"   integer not null,
  "diastolica"  integer not null,
  "glicemia"    integer not null,
  "status"      text not null,
  "created_at"  timestamp with time zone default now() not null,
  constraint "medicoes_status_check" check ("status" in ('normal','atencao','alerta'))
);

create table if not exists "public"."alertas" (
  "id"          uuid primary key default gen_random_uuid(),
  "paciente_id" uuid not null,
  "medico_id"   uuid,
  "tipo"        text not null,
  "titulo"      text not null,
  "descricao"   text not null,
  "status"      text not null,
  "created_at"  timestamp with time zone default now() not null,
  constraint "alertas_status_check" check ("status" in ('alerta','pendente','em_dia'))
);

create table if not exists "public"."pendencias" (
  "id"          uuid primary key default gen_random_uuid(),
  "medico_id"   uuid not null,
  "paciente_id" uuid not null,
  "titulo"      text not null,
  "concluida"   boolean default false not null,
  "created_at"  timestamp with time zone default now() not null
);

create table if not exists "public"."lembretes" (
  "id"          uuid primary key default gen_random_uuid(),
  "paciente_id" uuid not null,
  "texto"       text not null,
  "horario"     text not null,
  "ativo"       boolean default true not null
);

create table if not exists "public"."cardapio_semanal" (
  "id"         uuid primary key default gen_random_uuid(),
  "dia_semana" text not null,
  "refeicao"   text not null,
  "descricao"  text not null
);

create table if not exists "public"."assinaturas" (
  "id"          uuid primary key default gen_random_uuid(),
  "paciente_id" uuid not null,
  "plano_id"    uuid not null,
  "status"      text not null,
  "created_at"  timestamp with time zone default now() not null,
  -- getAssinaturaAtual() filtra por status = 'ativa'. Sem CHECK, um 'ATIVO'
  -- gravado por qualquer caminho fica invisível na tela (assinatura "sumida").
  constraint "assinaturas_status_check" check ("status" in ('ativa','cancelada','pendente'))
);

-- ---------------------------------------------------------------------------
-- CONSTRAINTS (FK, UNIQUE e CHECK para tabelas que já existiam)
-- ---------------------------------------------------------------------------
-- O Postgres não tem "ADD CONSTRAINT IF NOT EXISTS", e o velho padrão
-- "DROP IF EXISTS + ADD" tinha dois problemas num banco com dados:
--   1. um único comando que falha (ex.: linha fora do CHECK novo) abortava o
--      arquivo inteiro, porque o schema.sql é enviado como uma só query;
--   2. se o ADD falha depois do DROP, a constraint que já existia ia junto.
-- Aqui cada constraint é adicionada em transação própria, só quando falta, e um
-- erro vira NOTICE -- o restante do schema continua sendo aplicado.
-- ---------------------------------------------------------------------------

do $$
declare
  t_rec record;
  v_found text;
begin
  for t_rec in
    select * from (values
      -- foreign keys
      ('pacientes',   'pacientes_id_profiles_id_fk',
        'alter table "public"."pacientes" add constraint "pacientes_id_profiles_id_fk" foreign key ("id") references "public"."profiles"("id") on delete cascade'),
      ('medicos',     'medicos_id_profiles_id_fk',
        'alter table "public"."medicos" add constraint "medicos_id_profiles_id_fk" foreign key ("id") references "public"."profiles"("id") on delete cascade'),
      ('sessions',    'sessions_user_id_profiles_id_fk',
        'alter table "public"."sessions" add constraint "sessions_user_id_profiles_id_fk" foreign key ("user_id") references "public"."profiles"("id") on delete cascade'),
      ('consultas',   'consultas_paciente_id_pacientes_id_fk',
        'alter table "public"."consultas" add constraint "consultas_paciente_id_pacientes_id_fk" foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade'),
      ('consultas',   'consultas_medico_id_medicos_id_fk',
        'alter table "public"."consultas" add constraint "consultas_medico_id_medicos_id_fk" foreign key ("medico_id") references "public"."medicos"("id") on delete set null'),
      ('triagens',    'triagens_paciente_id_pacientes_id_fk',
        'alter table "public"."triagens" add constraint "triagens_paciente_id_pacientes_id_fk" foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade'),
      ('triagens',    'triagens_medico_id_medicos_id_fk',
        'alter table "public"."triagens" add constraint "triagens_medico_id_medicos_id_fk" foreign key ("medico_id") references "public"."medicos"("id") on delete cascade'),
      ('medicoes',    'medicoes_paciente_id_pacientes_id_fk',
        'alter table "public"."medicoes" add constraint "medicoes_paciente_id_pacientes_id_fk" foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade'),
      ('alertas',     'alertas_paciente_id_pacientes_id_fk',
        'alter table "public"."alertas" add constraint "alertas_paciente_id_pacientes_id_fk" foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade'),
      ('alertas',     'alertas_medico_id_medicos_id_fk',
        'alter table "public"."alertas" add constraint "alertas_medico_id_medicos_id_fk" foreign key ("medico_id") references "public"."medicos"("id") on delete set null'),
      ('pendencias',  'pendencias_medico_id_medicos_id_fk',
        'alter table "public"."pendencias" add constraint "pendencias_medico_id_medicos_id_fk" foreign key ("medico_id") references "public"."medicos"("id") on delete cascade'),
      ('pendencias',  'pendencias_paciente_id_pacientes_id_fk',
        'alter table "public"."pendencias" add constraint "pendencias_paciente_id_pacientes_id_fk" foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade'),
      ('lembretes',   'lembretes_paciente_id_pacientes_id_fk',
        'alter table "public"."lembretes" add constraint "lembretes_paciente_id_pacientes_id_fk" foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade'),
      ('assinaturas', 'assinaturas_paciente_id_pacientes_id_fk',
        'alter table "public"."assinaturas" add constraint "assinaturas_paciente_id_pacientes_id_fk" foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade'),
      ('assinaturas', 'assinaturas_plano_id_planos_id_fk',
        'alter table "public"."assinaturas" add constraint "assinaturas_plano_id_planos_id_fk" foreign key ("plano_id") references "public"."planos"("id") on delete cascade'),
      -- unique (para tabelas criadas antes deste script)
      ('pacientes',       'pacientes_cpf_unique',
        'alter table "public"."pacientes" add constraint "pacientes_cpf_unique" unique ("cpf")'),
      ('medicos',         'medicos_crm_unique',
        'alter table "public"."medicos" add constraint "medicos_crm_unique" unique ("crm")'),
      ('profiles',        'profiles_email_unique',
        'alter table "public"."profiles" add constraint "profiles_email_unique" unique ("email")'),
      -- checks
      ('profiles',    'profiles_role_check',
        'alter table "public"."profiles" add constraint "profiles_role_check" check ("role" in (''paciente'',''medico''))'),
      ('pacientes',   'pacientes_altura_check',
        'alter table "public"."pacientes" add constraint "pacientes_altura_check" check ("altura" between 0.30 and 2.80)'),
      ('pacientes',   'pacientes_idade_check',
        'alter table "public"."pacientes" add constraint "pacientes_idade_check" check ("idade" between 0 and 130)'),
      ('consultas',   'consultas_status_check',
        'alter table "public"."consultas" add constraint "consultas_status_check" check ("status" in (''agendada'',''realizada'',''cancelada''))'),
      ('triagens',    'triagens_classificacao_check',
        'alter table "public"."triagens" add constraint "triagens_classificacao_check" check ("classificacao" in (''verde'',''amarela'',''vermelha''))'),
      ('medicoes',    'medicoes_status_check',
        'alter table "public"."medicoes" add constraint "medicoes_status_check" check ("status" in (''normal'',''atencao'',''alerta''))'),
      ('alertas',     'alertas_status_check',
        'alter table "public"."alertas" add constraint "alertas_status_check" check ("status" in (''alerta'',''pendente'',''em_dia''))'),
      ('assinaturas', 'assinaturas_status_check',
        'alter table "public"."assinaturas" add constraint "assinaturas_status_check" check ("status" in (''ativa'',''cancelada'',''pendente''))')
    ) as c(tbl, cname, ddl)
  loop
    select c.conname into v_found
      from pg_constraint c
      join pg_class r on r.oid = c.conrelid
      join pg_namespace n on n.oid = r.relnamespace
     where n.nspname = 'public' and r.relname = t_rec.tbl and c.conname = t_rec.cname;

    if v_found is not null then
      continue;  -- já existe: nada a fazer (e nada é dropado)
    end if;

    begin
      execute t_rec.ddl;
      raise notice 'constraint criada: %.%', t_rec.tbl, t_rec.cname;
    exception when others then
      raise notice 'AVISO: não foi possível criar %.% (%) -- dados atuais do banco
        contradizem a regra. Limpe as linhas conflitantes e rode de novo, ou use
        supabase/reset.sql se puder recriar tudo.', t_rec.tbl, t_rec.cname, sqlerrm;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- INDICES  (o drizzle-kit gera a partir de src/db/schema.ts; os nomes têm que
-- bater com os dois lados, senão `npm run db:push` recria tudo)
-- ---------------------------------------------------------------------------
-- No Postgres uma FOREIGN KEY não cria índice na coluna que referencia. Sem isto,
-- cada listagem por paciente vira um seq scan na tabela inteira. As colunas
-- seguem a ordem dos ORDER BY de src/lib/queries.ts.

create index if not exists "profiles_created_at_idx"
  on "public"."profiles" using btree ("created_at" desc);

create index if not exists "sessions_user_id_idx"
  on "public"."sessions" using btree ("user_id");

create index if not exists "sessions_expires_at_idx"
  on "public"."sessions" using btree ("expires_at");

create index if not exists "consultas_paciente_id_data_idx"
  on "public"."consultas" using btree ("paciente_id", "data" desc, "created_at" desc);

create index if not exists "consultas_medico_id_data_idx"
  on "public"."consultas" using btree ("medico_id", "data" desc, "created_at" desc);

create index if not exists "triagens_medico_id_data_idx"
  on "public"."triagens" using btree ("medico_id", "data" desc, "created_at" desc);

create index if not exists "triagens_paciente_id_idx"
  on "public"."triagens" using btree ("paciente_id");

create index if not exists "medicoes_paciente_id_created_idx"
  on "public"."medicoes" using btree ("paciente_id", "created_at" desc);

create index if not exists "alertas_created_idx"
  on "public"."alertas" using btree ("created_at" desc);

create index if not exists "alertas_paciente_id_idx"
  on "public"."alertas" using btree ("paciente_id");

create index if not exists "pendencias_medico_id_created_idx"
  on "public"."pendencias" using btree ("medico_id", "created_at" desc);

create index if not exists "pendencias_paciente_id_idx"
  on "public"."pendencias" using btree ("paciente_id");

create index if not exists "lembretes_paciente_id_ativo_idx"
  on "public"."lembretes" using btree ("paciente_id", "ativo");

create index if not exists "cardapio_semanal_dia_semana_idx"
  on "public"."cardapio_semanal" using btree ("dia_semana");

-- Uma linha por dia + refeicao: o seed ja usa NOT EXISTS, e o app assume esse
-- par unico ao montar o cardapio do dia. Declarado como UNIQUE INDEX (e nao
-- CONSTRAINT) para bater com o src/db/schema.ts: o drizzle-kit 0.31 nao
-- reconhece constraint unique composta no `push` e propoe recria-la.
create unique index if not exists "cardapio_semanal_dia_refeicao_unique"
  on "public"."cardapio_semanal" ("dia_semana", "refeicao");

create index if not exists "assinaturas_paciente_id_status_idx"
  on "public"."assinaturas" using btree ("paciente_id", "status");

create index if not exists "assinaturas_plano_id_idx"
  on "public"."assinaturas" using btree ("plano_id");

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- Autenticação própria no servidor web/Edge. Clientes NÃO consultam PostgREST.
-- RLS deny-by-default; postgres (owner/BYPASSRLS) continua atendendo ao web.
-- Para banco existente, revisar/aplicar migrations/20261015_mobile_boundary.sql.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','pacientes','medicos','sessions','consultas','triagens','medicoes',
    'alertas','pendencias','lembretes','cardapio_semanal','planos','assinaturas'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA: deve retornar as 13 tabelas com rls_ativo = true e o total de
-- índices/constraints esperado (a query final do script é o que o db:setup lê).
-- ---------------------------------------------------------------------------
select c.relname as tabela,
       (select count(*) from information_schema.columns x
         where x.table_schema='public' and x.table_name = c.relname) as n_colunas,
       (select count(*) from pg_indexes i
         where i.schemaname='public' and i.tablename = c.relname) as n_indices,
       (select count(*) from pg_constraint k
         where k.conrelid = c.oid and k.contype in ('f','c','u')) as n_constraints,
       c.relrowsecurity as rls_ativo
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relname in ('profiles','pacientes','medicos','sessions','consultas','triagens',
                    'medicoes','alertas','pendencias','lembretes','cardapio_semanal',
                    'planos','assinaturas')
order by c.relname;
