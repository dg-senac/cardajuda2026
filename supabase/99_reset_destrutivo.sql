-- ============================================================================
-- 99_reset_destrutivo.sql  --  !! APAGA DADOS !!  leia antes de rodar
-- ============================================================================
-- Voce NAO precisa deste arquivo se o 00_diagnostico.sql mostrou que as suas
-- tabelas ja batem com o schema. Ele existe para dois casos:
--
--   (a) as suas tabelas tem colunas DIFERENTES das que o app espera, ou
--   (b) voce quer recomecar do zero com dados limpos.
--
-- O que ele faz: apaga as 13 tabelas do Carda Ajuda em cascata e as recria.
-- NAO toca em auth.users, storage.objects nem em nenhuma outra tabela sua.
--
-- >>> Faca backup antes: Supabase > Database > Backups, ou
--     Project Settings > Database > Point in time recovery. <<<
--
-- Para executar, troque as duas linhas abaixo de "false" para "true".
-- Enquanto estiverem "false", este arquivo nao faz absolutamente nada.
-- ============================================================================

do $$
declare
  confirmar_dados   boolean := false;  -- <- mude para true para APAGAR as linhas
  confirmar_schema  boolean := false;  -- <- mude para true para APAGAR as tabelas
  t text;
begin
  if not confirmar_schema then
    raise notice 'Reset abortado: confirmar_schema ainda esta false. Nada foi feito.';
    return;
  end if;

  if not confirmar_dados then
    raise notice 'Reset abortado: confirmar_dados ainda esta false. Nada foi feito.';
    return;
  end if;

  foreach t in array array[
    'assinaturas','lembretes','pendencias','alertas','medicoes','triagens','consultas',
    'cardapio_semanal','planos','sessions','medicos','pacientes','profiles'
  ] loop
    execute format('drop table if exists public.%I cascade', t);
    raise notice 'tabela removida: %', t;
  end loop;
end $$;

-- Depois de rodar isto, aplique 01_schema.sql e, se quiser dados, 02_seed.sql.
