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

begin read only;
select table_schema, table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema in ('public','mobile_private') and grantee in ('PUBLIC','anon','authenticated');
select n.nspname, c.relname, c.relkind, c.relacl, c.reloptions
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','mobile_private') and c.relkind in ('v','m','r');
-- Inclui funções SECURITY INVOKER e DEFINER, grants implícitos de PUBLIC e search_path.
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as argumentos,
 p.prosecdef, p.proacl, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','mobile_private');
select nspname, nspacl from pg_namespace where nspname in ('public','mobile_private');
select rolname, rolbypassrls, rolsuper from pg_roles where rolname=current_user;
commit;

-- Heranças de papéis podem conceder privilégios não visíveis como grant direto.
select membro.rolname as membro, grupo.rolname as papel_herdado
from pg_auth_members m join pg_roles membro on membro.oid=m.member
join pg_roles grupo on grupo.oid=m.roleid;
