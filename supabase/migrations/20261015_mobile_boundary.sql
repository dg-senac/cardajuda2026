-- REVIEW FIRST. Run preflight.sql and npm run db:check against the REAL project.
-- No application rows are changed. Web/Edge connections must use a server role
-- that owns these tables or has BYPASSRLS (e.g. the existing postgres connection).
-- No anon/authenticated policies: the ONLY mobile data path is the Edge API.
begin;
do $$
declare t text; r text;
begin
  foreach t in array array['profiles','sessions','pacientes','medicos','consultas',
    'triagens','medicoes','alertas','pendencias','lembretes','cardapio_semanal','planos','assinaturas'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'Missing table %. Stop and compare the live schema before proceeding.', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public', t);
    execute (select format('revoke select (%s), insert (%s), update (%s), references (%s) on public.%I from public',
      string_agg(quote_ident(column_name), ','), string_agg(quote_ident(column_name), ','),
      string_agg(quote_ident(column_name), ','), string_agg(quote_ident(column_name), ','), t)
      from information_schema.columns where table_schema = 'public' and table_name = t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select from pg_roles where rolname = r) then
        execute format('revoke all on table public.%I from %I', t, r);
        -- Column-level grants survive table-level REVOKE. Remove those too.
        execute (select format('revoke select (%s), insert (%s), update (%s), references (%s) on public.%I from %I',
          string_agg(quote_ident(column_name), ','), string_agg(quote_ident(column_name), ','),
          string_agg(quote_ident(column_name), ','), string_agg(quote_ident(column_name), ','), t, r)
          from information_schema.columns where table_schema = 'public' and table_name = t);
      end if;
    end loop;
  end loop;
end $$;
create schema if not exists mobile_private;
revoke all on schema mobile_private from public;
create table if not exists mobile_private.approved_doctors (
  medico_id uuid primary key references public.medicos(id),
  approved_at timestamptz not null default now()
);
create table if not exists mobile_private.login_limits (
  key text primary key,
  attempts integer not null,
  window_start timestamptz not null
);
alter table mobile_private.approved_doctors enable row level security;
alter table mobile_private.login_limits enable row level security;
revoke all on all tables in schema mobile_private from public;
do $$ declare r text; begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select from pg_roles where rolname = r) then
      execute format('revoke all on schema mobile_private from %I', r);
      execute format('revoke all on all tables in schema mobile_private from %I', r);
    end if;
  end loop;
end $$;
commit;
