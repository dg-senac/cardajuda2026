-- ============================================================================
-- 03_aprovar_medico.sql  --  Aprovação MANUAL de médico para o APK
-- ============================================================================
-- Médico só enxerga pacientes/consultas no app depois de aprovado aqui.
-- Confira identidade, CRM e UF fora do aplicativo antes de aprovar.
-- Execute o PASSO 1 para copiar o UUID; depois execute o PASSO 2 com o UUID.
-- Nenhuma senha é alterada. Não há aprovação em massa.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1 (somente leitura): liste os médicos e copie o id do médico certo.
-- ---------------------------------------------------------------------------
select m.id,
       p.nome,
       p.email,
       m.crm,
       m.especialidade,
       exists (select 1 from mobile_private.approved_doctors a where a.medico_id = m.id) as ja_aprovado
from public.medicos m
join public.profiles p on p.id = m.id
where p.role = 'medico'
order by p.nome;

-- ---------------------------------------------------------------------------
-- PASSO 2: troque o marcador abaixo pelo id copiado (entre aspas simples) e
-- execute este bloco inteiro. Se o marcador não for trocado, nada é alterado.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  alvo_texto text := 'COLE-O-UUID-REAL-AQUI';
  alvo uuid;
begin
  if alvo_texto !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Troque COLE-O-UUID-REAL-AQUI pelo UUID real de medicos.id. Nada foi alterado.';
  end if;
  alvo := alvo_texto::uuid;

  if not exists (
    select 1 from public.medicos m
    join public.profiles p on p.id = m.id
    where m.id = alvo and p.role = 'medico'
  ) then
    raise exception 'Médico não encontrado para este UUID (ou o perfil não é de médico). Nada foi alterado.';
  end if;

  insert into mobile_private.approved_doctors (medico_id)
  values (alvo)
  on conflict do nothing;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- Conferência (somente leitura): quantos médicos estão aprovados.
-- ---------------------------------------------------------------------------
select count(*) as medicos_aprovados from mobile_private.approved_doctors;

-- Revogar acesso de um médico (suspende todo o acesso dele ao app):
--   delete from mobile_private.approved_doctors where medico_id = 'UUID-REAL';
-- Derrubar as sessões ativas dele (ele precisará entrar de novo):
--   delete from public.sessions where user_id = 'UUID-REAL';
