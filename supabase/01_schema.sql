-- ============================================================================
-- 01_schema.sql  --  Schema do Carda Ajuda para Supabase / PostgreSQL
-- ============================================================================
-- Gerado a partir de src/db/schema.ts com `drizzle-kit generate`, ou seja:
-- bate exatamente com o que o codigo espera. Nao foi escrito a mao.
--
-- * Idempotente: pode rodar de novo sem quebrar (IF NOT EXISTS / DROP IF EXISTS).
-- * NAO apaga dados. Se quiser zerar tudo, veja 99_reset_destrutivo.sql.
-- * Requer PostgreSQL 13+ (gen_random_uuid() nativo). Supabase = 15/17. OK.
-- ============================================================================

-- gen_random_uuid() e nativo no PostgreSQL 13+ (Supabase = 15/17), entao esta
-- linha e so rede de seguranca para projeto antigo. Se ela falhar por falta de
-- privilegio, o bloco apenas avisa e segue: nao e necessario.
do $$ begin
  create extension if not exists "pgcrypto";
exception when insufficient_privilege then
  raise notice 'pgcrypto nao instalado (sem privilegio). Sem problema: gen_random_uuid() e nativo no PG13+.';
end $$;

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
  constraint "pacientes_cpf_unique" unique ("cpf")
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
  "created_at"  timestamp with time zone default now() not null
);

-- ---------------------------------------------------------------------------
-- CHAVES ESTRANGEIRAS
-- O "drop if exists" + "add" e o que torna o bloco re-executavel: o Postgres
-- nao tem "ADD CONSTRAINT IF NOT EXISTS".
-- ---------------------------------------------------------------------------

alter table "public"."pacientes" drop constraint if exists "pacientes_id_profiles_id_fk";
alter table "public"."pacientes" add constraint "pacientes_id_profiles_id_fk"
  foreign key ("id") references "public"."profiles"("id") on delete cascade;

alter table "public"."medicos" drop constraint if exists "medicos_id_profiles_id_fk";
alter table "public"."medicos" add constraint "medicos_id_profiles_id_fk"
  foreign key ("id") references "public"."profiles"("id") on delete cascade;

alter table "public"."sessions" drop constraint if exists "sessions_user_id_profiles_id_fk";
alter table "public"."sessions" add constraint "sessions_user_id_profiles_id_fk"
  foreign key ("user_id") references "public"."profiles"("id") on delete cascade;

alter table "public"."consultas" drop constraint if exists "consultas_paciente_id_pacientes_id_fk";
alter table "public"."consultas" add constraint "consultas_paciente_id_pacientes_id_fk"
  foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade;

alter table "public"."consultas" drop constraint if exists "consultas_medico_id_medicos_id_fk";
alter table "public"."consultas" add constraint "consultas_medico_id_medicos_id_fk"
  foreign key ("medico_id") references "public"."medicos"("id") on delete set null;

alter table "public"."triagens" drop constraint if exists "triagens_paciente_id_pacientes_id_fk";
alter table "public"."triagens" add constraint "triagens_paciente_id_pacientes_id_fk"
  foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade;

alter table "public"."triagens" drop constraint if exists "triagens_medico_id_medicos_id_fk";
alter table "public"."triagens" add constraint "triagens_medico_id_medicos_id_fk"
  foreign key ("medico_id") references "public"."medicos"("id") on delete cascade;

alter table "public"."medicoes" drop constraint if exists "medicoes_paciente_id_pacientes_id_fk";
alter table "public"."medicoes" add constraint "medicoes_paciente_id_pacientes_id_fk"
  foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade;

alter table "public"."alertas" drop constraint if exists "alertas_paciente_id_pacientes_id_fk";
alter table "public"."alertas" add constraint "alertas_paciente_id_pacientes_id_fk"
  foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade;

alter table "public"."alertas" drop constraint if exists "alertas_medico_id_medicos_id_fk";
alter table "public"."alertas" add constraint "alertas_medico_id_medicos_id_fk"
  foreign key ("medico_id") references "public"."medicos"("id") on delete set null;

alter table "public"."pendencias" drop constraint if exists "pendencias_medico_id_medicos_id_fk";
alter table "public"."pendencias" add constraint "pendencias_medico_id_medicos_id_fk"
  foreign key ("medico_id") references "public"."medicos"("id") on delete cascade;

alter table "public"."pendencias" drop constraint if exists "pendencias_paciente_id_pacientes_id_fk";
alter table "public"."pendencias" add constraint "pendencias_paciente_id_pacientes_id_fk"
  foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade;

alter table "public"."lembretes" drop constraint if exists "lembretes_paciente_id_pacientes_id_fk";
alter table "public"."lembretes" add constraint "lembretes_paciente_id_pacientes_id_fk"
  foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade;

alter table "public"."assinaturas" drop constraint if exists "assinaturas_paciente_id_pacientes_id_fk";
alter table "public"."assinaturas" add constraint "assinaturas_paciente_id_pacientes_id_fk"
  foreign key ("paciente_id") references "public"."pacientes"("id") on delete cascade;

alter table "public"."assinaturas" drop constraint if exists "assinaturas_plano_id_planos_id_fk";
alter table "public"."assinaturas" add constraint "assinaturas_plano_id_planos_id_fk"
  foreign key ("plano_id") references "public"."planos"("id") on delete cascade;

-- ---------------------------------------------------------------------------
-- INDICES  (isto o drizzle-kit NAO gera, e faz falta)
-- No Postgres uma FOREIGN KEY nao cria indice na coluna que referencia.
-- Sem isto, cada listagem por paciente vira um seq scan na tabela inteira.
-- As colunas seguem a ordem dos ORDER BY de src/lib/queries.ts.
-- ---------------------------------------------------------------------------

create index if not exists "sessions_user_id_idx"
  on "public"."sessions" ("user_id");

create index if not exists "consultas_paciente_id_data_idx"
  on "public"."consultas" ("paciente_id", "data" desc, "created_at" desc);

create index if not exists "consultas_medico_id_data_idx"
  on "public"."consultas" ("medico_id", "data" desc, "created_at" desc);

create index if not exists "triagens_medico_id_data_idx"
  on "public"."triagens" ("medico_id", "data" desc, "created_at" desc);

create index if not exists "triagens_paciente_id_idx"
  on "public"."triagens" ("paciente_id");

create index if not exists "medicoes_paciente_id_created_idx"
  on "public"."medicoes" ("paciente_id", "created_at" desc);

create index if not exists "alertas_created_idx"
  on "public"."alertas" ("created_at" desc);

create index if not exists "alertas_paciente_id_idx"
  on "public"."alertas" ("paciente_id");

create index if not exists "pendencias_medico_id_created_idx"
  on "public"."pendencias" ("medico_id", "created_at" desc);

create index if not exists "pendencias_paciente_id_idx"
  on "public"."pendencias" ("paciente_id");

create index if not exists "lembretes_paciente_id_ativo_idx"
  on "public"."lembretes" ("paciente_id", "ativo");

create index if not exists "cardapio_semanal_dia_semana_idx"
  on "public"."cardapio_semanal" ("dia_semana");

create index if not exists "assinaturas_paciente_id_status_idx"
  on "public"."assinaturas" ("paciente_id", "status");

create index if not exists "assinaturas_plano_id_idx"
  on "public"."assinaturas" ("plano_id");

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- Este app NAO usa Supabase Auth. Ele tem autenticacao propria: bcrypt em
-- "profiles.password_hash" + cookie de sessao na tabela "sessions", e o banco
-- e acessado SO pelo servidor (src/db/index.ts e src/lib/* importam "server-only").
--
-- Com RLS ligado e sem politicas, todo SELECT volta VAZIO sem erro nenhum:
-- o sintoma e logar certo e ver as telas sem dado nenhum. Por isso desligamos.
--
-- Se voce um dia expor estas tabelas pela chave "anon" via PostgREST, ai sim
-- reative o RLS e escreva politicas -- mas nunca com a senha do role "postgres".
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','pacientes','medicos','sessions','consultas','triagens','medicoes',
    'alertas','pendencias','lembretes','cardapio_semanal','planos','assinaturas'
  ] loop
    execute format('alter table public.%I disable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- CONFERENCIA: deve retornar 13 linhas, todas com colunas_ok = true.
-- ---------------------------------------------------------------------------
select c.relname as tabela,
       (select count(*) from information_schema.columns x
         where x.table_schema='public' and x.table_name = c.relname) as n_colunas
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relname in ('profiles','pacientes','medicos','sessions','consultas','triagens',
                    'medicoes','alertas','pendencias','lembretes','cardapio_semanal',
                    'planos','assinaturas')
order by c.relname;
