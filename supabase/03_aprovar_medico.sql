-- Somente administrador, após conferir identidade, CRM/UF e habilitação fora do app.
-- Substitua o marcador pelo UUID real de public.medicos (não é email nem CRM).
-- O script falha sem alteração enquanto o UUID não for substituído.
begin;
do $$
declare alvo uuid := 'COLE-O-UUID-REAL-AQUI';
begin
  if not exists (select 1 from public.medicos m join public.profiles p on p.id=m.id where m.id=alvo and p.role='medico') then
    raise exception 'Médico não encontrado. Confira o UUID e o papel.';
  end if;
  insert into mobile_private.approved_doctors(medico_id) values (alvo) on conflict do nothing;
end $$;
commit;
-- Revogar acesso médico: delete from mobile_private.approved_doctors where medico_id = 'UUID-REAL';
-- Revogar sessão específica: delete from public.sessions where user_id = 'UUID-REAL';
-- Não execute aprovações em massa. Nenhuma senha é alterada.
