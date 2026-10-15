-- ============================================================================
-- 05_conteudo_planos_cardapio.sql  --  Conteúdo do app (OPCIONAL)
-- ============================================================================
-- Insere os planos e o cardápio semanal se ainda não existirem. Não cria contas,
-- pacientes, médicos nem dados clínicos. Pode ser executado mais de uma vez.
-- Use somente se as telas "Planos" e "Cardápio" estiverem vazias.
-- Rode depois de supabase/migrations/20261015_mobile_boundary.sql.
-- ============================================================================

begin;

-- Planos (checados pelo nome, para não duplicar planos já cadastrados à mão)
insert into public.planos (nome, descricao, preco)
select v.nome, v.descricao, v.preco
from (values
  ('Básico',  'Acompanhamento mensal e medições ilimitadas',   49.90::numeric),
  ('Premium', 'Consultas ilimitadas, alertas e nutricionista', 129.90::numeric)
) as v(nome, descricao, preco)
where not exists (select 1 from public.planos p where p.nome = v.nome);

-- Cardápio: 7 dias x 4 refeições. Os nomes dos dias precisam ser EXATAMENTE os de
-- DIAS_SEMANA em src/lib/queries.ts (com acentos).
insert into public.cardapio_semanal (dia_semana, refeicao, descricao)
select d.dia, r.refeicao, r.descricao
from (values ('Domingo'),('Segunda-feira'),('Terça-feira'),('Quarta-feira'),
             ('Quinta-feira'),('Sexta-feira'),('Sábado')) as d(dia)
cross join (values
  ('Café da manhã', 'Aveia com banana e chia'),
  ('Almoço',        'Peixe grelhado, arroz integral e legumes'),
  ('Lanche',        'Iogurte natural com frutas vermelhas'),
  ('Jantar',        'Sopa de legumes com frango desfiado')
) as r(refeicao, descricao)
where not exists (
  select 1 from public.cardapio_semanal c
  where c.dia_semana = d.dia and c.refeicao = r.refeicao
);

commit;

-- Conferência (somente leitura)
select 'planos' as tabela, count(*) as linhas from public.planos
union all select 'cardapio_semanal', count(*) from public.cardapio_semanal;
