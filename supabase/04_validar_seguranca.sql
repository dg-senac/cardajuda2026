-- Somente leitura. Não imprime linhas clínicas, tokens ou hashes.
begin read only;
select current_user as papel_da_conexao;
select n.nspname, c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','mobile_private') and c.relkind='r';
-- Deve retornar ZERO linhas para as tabelas do aplicativo.
select grantee, table_schema, table_name, privilege_type
from information_schema.table_privileges
where table_schema in ('public','mobile_private') and grantee in ('anon','authenticated','PUBLIC');
select grantee, table_schema, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema in ('public','mobile_private') and grantee in ('anon','authenticated','PUBLIC');
-- Caminhos alternativos: ZERO resultados não justificados/revisados antes de publicar.
select n.nspname, c.relname, r.rolname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join pg_roles r
where n.nspname in ('public','mobile_private') and c.relkind in ('v','m')
 and r.rolname in ('anon','authenticated') and has_table_privilege(r.oid,c.oid,'SELECT');
select n.nspname,p.proname,r.rolname,p.prosecdef
from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join pg_roles r
where n.nspname in ('public','mobile_private') and r.rolname in ('anon','authenticated')
 and has_function_privilege(r.oid,p.oid,'EXECUTE');
select count(*) as medicos_aprovados from mobile_private.approved_doctors;
select paciente_id, count(*) as assinaturas_ativas from public.assinaturas
where status='ativa' group by paciente_id having count(*)>1;
commit;

-- Privilégios EFETIVOS (inclui heranças): zero para tabelas clínicas/privadas.
select n.nspname,c.relname,r.rolname
from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
where c.relkind='r' and n.nspname in ('public','mobile_private')
 and r.rolname in ('anon','authenticated')
 and (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE')
   or has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE'));
