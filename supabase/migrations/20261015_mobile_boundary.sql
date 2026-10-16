-- REVIEW FIRST. Run preflight.sql and npm run db:check against the REAL project.
-- No application rows are changed. Web/Edge connections must use a server role
-- that owns these tables or has BYPASSRLS (e.g. the existing postgres connection).
-- No anon/authenticated policies: the ONLY mobile data path is the Edge API.
begin;
-- Não alterar silenciosamente views/RPCs de outro sistema: interromper para revisão.
do $$ begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
    where n.nspname='public' and c.relkind in ('v','m') and r.rolname in ('anon','authenticated')
      and has_table_privilege(r.oid,c.oid,'SELECT')
  ) then raise exception 'Views públicas acessíveis detectadas. Revise/restrinja grants antes da migração (preflight.sql).'; end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join pg_roles r
    where n.nspname='public' and p.prosecdef and r.rolname in ('anon','authenticated')
      and has_function_privilege(r.oid,p.oid,'EXECUTE')
      and not exists (select 1 from pg_depend d where d.objid=p.oid and d.classid='pg_proc'::regclass and d.deptype='e')
  ) then raise exception 'RPC SECURITY DEFINER pública detectada. Revise/restrinja EXECUTE antes de continuar.'; end if;
end $$;
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
create table if not exists mobile_private.mutation_receipts (
  user_id uuid not null references public.profiles(id),
  request_id uuid not null,
  operation text not null,
  created_at timestamptz not null default now(),
  primary key(user_id, request_id, operation)
);
alter table mobile_private.mutation_receipts enable row level security;
revoke all on mobile_private.mutation_receipts from public;
do $$ declare r text; begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select from pg_roles where rolname=r) then
      execute format('revoke all on mobile_private.mutation_receipts from %I', r);
    end if;
  end loop;
end $$;
-- Tabelas criadas no futuro pelo SQL Editor (papel postgres) não podem nascer com
-- acesso público: o Supabase concede ALL a anon/authenticated em public por padrão.
do $$ declare r text; begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select from pg_roles where rolname=r) then
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end $$;
commit;
