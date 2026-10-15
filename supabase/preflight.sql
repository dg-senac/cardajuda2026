-- READ ONLY. Do not export row contents or password hashes.
begin read only;
select current_user, rolbypassrls from pg_roles where rolname = current_user;
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema='public'
order by table_name, ordinal_position;
select tablename, indexname, indexdef from pg_indexes where schemaname='public';
select conrelid::regclass as tabela, conname, pg_get_constraintdef(oid)
from pg_constraint where connamespace='public'::regnamespace;
select c.relname, c.relrowsecurity, pg_get_userbyid(c.relowner) as owner
from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r';
select * from pg_policies where schemaname in ('public','mobile_private');
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','PUBLIC');
-- SECURITY DEFINER RPCs/views can bypass table RLS: review before exposing API.
select n.nspname, p.proname, p.prosecdef, p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef;
select table_name, view_definition from information_schema.views where table_schema='public';
commit;
