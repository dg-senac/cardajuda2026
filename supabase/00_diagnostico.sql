-- ============================================================================
-- 00_diagnostico.sql  --  RODE ESTE PRIMEIRO, ANTES DE QUALQUER OUTRA COISA
-- ============================================================================
-- Por que: "CREATE TABLE IF NOT EXISTS" passa em SILENCIO se a tabela ja existe.
-- Se as suas tabelas atuais tem nomes de colunas diferentes dos que o app espera,
-- o schema "aplica sem erro" e o app quebra depois em runtime com
-- "column X does not exist". Este script mostra a diferenca antes de acontecer.
--
-- NAO modifica nada: sao apenas consultas de catalogo, seguras de rodar.
-- Se aparecer alguma coluna com situacao 'FALTA (o app precisa)', me mande a
-- saida antes de aplicar o 01_schema.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Quais das 13 tabelas que o app espera ja existem no seu projeto?
-- ---------------------------------------------------------------------------
select
  t.esperada                                                  as tabela,
  case when i.oid is not null then 'EXISTE' else 'FALTA' end  as situacao
from (values
  ('profiles'), ('pacientes'), ('medicos'), ('sessions'), ('consultas'),
  ('triagens'), ('medicoes'), ('alertas'), ('pendencias'), ('lembretes'),
  ('cardapio_semanal'), ('planos'), ('assinaturas')
) as t(esperada)
left join pg_class i
  on i.relname = t.esperada
 and i.relkind = 'r'
 and i.relnamespace = 'public'::regnamespace
order by situacao desc, tabela;

-- ---------------------------------------------------------------------------
-- 2) Divergencia coluna a coluna.
--    'FALTA (o app precisa)' = bloqueante, o app vai quebrar.
--    'SOBRA (inofensiva)'     = coluna sua que o app nao le; pode continuar la.
-- ---------------------------------------------------------------------------
with esperado(tabela, coluna) as (values
  ('profiles','id'),('profiles','role'),('profiles','nome'),('profiles','email'),
  ('profiles','telefone'),('profiles','password_hash'),('profiles','avatar_url'),('profiles','created_at'),
  ('sessions','id'),('sessions','user_id'),('sessions','expires_at'),('sessions','created_at'),
  ('pacientes','id'),('pacientes','cpf'),('pacientes','data_nascimento'),('pacientes','idade'),
  ('pacientes','tipo_sanguineo'),('pacientes','altura'),('pacientes','genero'),
  ('pacientes','doencas_cronicas'),('pacientes','plano'),
  ('medicos','id'),('medicos','crm'),('medicos','especialidade'),('medicos','formacao'),
  ('medicos','genero'),('medicos','avaliacao'),('medicos','consultas_feitas'),
  ('consultas','id'),('consultas','paciente_id'),('consultas','medico_id'),('consultas','nome_paciente'),
  ('consultas','data'),('consultas','horario'),('consultas','profissional'),('consultas','especialidade'),
  ('consultas','motivo'),('consultas','status'),('consultas','created_at'),
  ('triagens','id'),('triagens','paciente_id'),('triagens','medico_id'),('triagens','nome_paciente'),
  ('triagens','data'),('triagens','horario'),('triagens','profissional'),('triagens','queixa_principal'),
  ('triagens','classificacao'),('triagens','created_at'),
  ('medicoes','id'),('medicoes','paciente_id'),('medicoes','sistolica'),('medicoes','diastolica'),
  ('medicoes','glicemia'),('medicoes','status'),('medicoes','created_at'),
  ('alertas','id'),('alertas','paciente_id'),('alertas','medico_id'),('alertas','tipo'),
  ('alertas','titulo'),('alertas','descricao'),('alertas','status'),('alertas','created_at'),
  ('pendencias','id'),('pendencias','medico_id'),('pendencias','paciente_id'),
  ('pendencias','titulo'),('pendencias','concluida'),('pendencias','created_at'),
  ('lembretes','id'),('lembretes','paciente_id'),('lembretes','texto'),
  ('lembretes','horario'),('lembretes','ativo'),
  ('cardapio_semanal','id'),('cardapio_semanal','dia_semana'),('cardapio_semanal','refeicao'),('cardapio_semanal','descricao'),
  ('planos','id'),('planos','nome'),('planos','descricao'),('planos','preco'),
  ('assinaturas','id'),('assinaturas','paciente_id'),('assinaturas','plano_id'),
  ('assinaturas','status'),('assinaturas','created_at')
),
real as (
  select c.table_name as tabela, c.column_name as coluna
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name in (select distinct tabela from esperado)
)
select coalesce(e.tabela, r.tabela) as tabela,
       coalesce(e.coluna, r.coluna) as coluna,
       case when r.coluna is null then 'FALTA (o app precisa)'
            else 'SOBRA (inofensiva)'
       end as situacao
from esperado e
full outer join real r on r.tabela = e.tabela and r.coluna = e.coluna
where e.coluna is null or r.coluna is null
order by situacao, tabela, coluna;

-- ---------------------------------------------------------------------------
-- 3) Tipos das colunas que o app le de forma sensiveis a tipo.
--    Se divergir daqui, me avise: mudar tipo de coluna e migracao, nao DDL.
-- ---------------------------------------------------------------------------
select table_name as tabela, column_name as coluna, data_type as tipo
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('profiles','id'), ('profiles','created_at'),
    ('pacientes','altura'), ('pacientes','doencas_cronicas'), ('pacientes','data_nascimento'),
    ('medicos','avaliacao'),
    ('consultas','data'),
    ('planos','preco'),
    ('sessions','expires_at')
  )
order by tabela, coluna;

-- ---------------------------------------------------------------------------
-- 4) RLS esta ligado? O app faz a propria autenticacao (bcrypt + cookie) e
--    conversa com o banco SOMENTE pelo servidor. Se rls_ligado = true e a
--    conexao nao for dona da tabela, todo SELECT volta vazio SEM dar erro --
--    o sintoma e "loguei, mas as telas aparecem sem nenhum dado".
-- ---------------------------------------------------------------------------
select c.relname              as tabela,
       c.relrowsecurity       as rls_ligado,
       c.relforcerowsecurity  as rls_forcado
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relname in ('profiles','pacientes','medicos','sessions','consultas','triagens',
                    'medicoes','alertas','pendencias','lembretes','cardapio_semanal',
                    'planos','assinaturas')
order by c.relname;

-- ---------------------------------------------------------------------------
-- A contagem de linhas ficou em 00b_contagem.sql de proposito: ela so funciona
-- depois que as 13 tabelas existem.
-- ---------------------------------------------------------------------------
