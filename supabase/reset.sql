-- ============================================================================
-- reset.sql  --  ATENÇÃO: APAGA AS 13 TABELAS DO APP
-- ============================================================================
-- Faça backup antes de executar (Supabase > Database > Backups).
-- Este script não apaga auth.users, storage.objects nem tabelas fora da lista.
-- Não usa CASCADE: se houver uma dependência externa, o PostgreSQL aborta o
-- reset em vez de remover essa dependência automaticamente.
--
-- O reset vem bloqueado por duas confirmações. Para executá-lo, altere AMBAS
-- as variáveis abaixo para true. Com qualquer uma em false, nada é removido.
-- Após o reset, execute schema.sql e, se desejar os dados de demonstração,
-- seed.sql.
-- ============================================================================

do $$
declare
  confirmar_dados  boolean := false; -- <- mude para true para APAGAR os dados
  confirmar_schema boolean := false; -- <- mude para true para APAGAR as tabelas
  t text;
begin
  if not confirmar_schema then
    raise notice 'Reset abortado: confirmar_schema ainda está false. Nada foi feito.';
    return;
  end if;

  if not confirmar_dados then
    raise notice 'Reset abortado: confirmar_dados ainda está false. Nada foi feito.';
    return;
  end if;

  -- Ordem de dependência: tabelas-filhas antes das tabelas-pai.
  foreach t in array array[
    'assinaturas', 'lembretes', 'pendencias', 'alertas', 'medicoes', 'triagens',
    'consultas', 'cardapio_semanal', 'sessions', 'medicos', 'pacientes', 'planos',
    'profiles'
  ] loop
    execute format('drop table if exists public.%I', t);
    raise notice 'Tabela removida: %', t;
  end loop;
end $$;
