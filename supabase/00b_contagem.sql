-- ============================================================================
-- 00b_contagem.sql  --  contagem de linhas (rode DEPOIS do 01_schema.sql)
-- ============================================================================
-- Ficou em arquivo proprio porque, se alguma das 13 tabelas ainda nao existir,
-- a consulta aborta a transacao inteira do SQL Editor.
-- Se alguma linha vier com qtd > 0 e voce nao esperaba dados ali, NAO rode
-- 99_reset_destrutivo.sql sem fazer backup antes.
-- ============================================================================
select 'profiles'         as tabela, count(*) as qtd from "public"."profiles"
union all select 'pacientes',        count(*) from "public"."pacientes"
union all select 'medicos',          count(*) from "public"."medicos"
union all select 'sessions',         count(*) from "public"."sessions"
union all select 'consultas',        count(*) from "public"."consultas"
union all select 'triagens',         count(*) from "public"."triagens"
union all select 'medicoes',         count(*) from "public"."medicoes"
union all select 'alertas',          count(*) from "public"."alertas"
union all select 'pendencias',       count(*) from "public"."pendencias"
union all select 'lembretes',        count(*) from "public"."lembretes"
union all select 'cardapio_semanal', count(*) from "public"."cardapio_semanal"
union all select 'planos',           count(*) from "public"."planos"
union all select 'assinaturas',      count(*) from "public"."assinaturas"
order by tabela;
