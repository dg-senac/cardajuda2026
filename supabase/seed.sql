-- ============================================================================
-- seed.sql  --  Dados de exemplo (opcional, mas necessário para logar)
-- ============================================================================
-- Sem este arquivo o banco fica vazio e não há contas de demonstração.
-- Senha de TODOS os usuários de teste: 123456.
-- (Hash bcrypt custo 10, o mesmo formato que signupPacienteAction grava.)
--
-- Idempotente: usa ON CONFLICT DO NOTHING e NOT EXISTS; pode rodar de novo.
-- Rode schema.sql antes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Contas (profiles) -- a autenticacao do app vive aqui, nao no auth.users
-- ---------------------------------------------------------------------------
insert into "public"."profiles" (id, role, nome, email, telefone, password_hash) values
  ('aaaaaaaa-0000-0000-0000-000000000001','medico',  'Dra. Ana Beatriz Souza','ana@cardiajuda.com',   '81999110001','$2b$10$yOtSWwjqCajbMyjfl0dKG.aQUIxrIp03Pk/w1QxQkgmix7/mvbjGi'),
  ('aaaaaaaa-0000-0000-0000-000000000002','medico',  'Dr. Carlos Mendes',     'carlos@cardiajuda.com','81999110002','$2b$10$yOtSWwjqCajbMyjfl0dKG.aQUIxrIp03Pk/w1QxQkgmix7/mvbjGi'),
  ('bbbbbbbb-0000-0000-0000-000000000001','paciente','Maria da Silva',        'maria@email.com',      '81988220001','$2b$10$yOtSWwjqCajbMyjfl0dKG.aQUIxrIp03Pk/w1QxQkgmix7/mvbjGi'),
  ('bbbbbbbb-0000-0000-0000-000000000002','paciente','João Pereira',          'joao@email.com',       '81988220002','$2b$10$yOtSWwjqCajbMyjfl0dKG.aQUIxrIp03Pk/w1QxQkgmix7/mvbjGi')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Medicos e pacientes (compartilham o id com profiles)
-- CPFs abaixo tem digitos verificadores validos: passam em validateCPF().
-- A idade e calculada, igual ao calculateAge() do app -- nao fica desatualizada.
-- ---------------------------------------------------------------------------
insert into "public"."medicos" (id, crm, especialidade, formacao, genero, avaliacao, consultas_feitas) values
  ('aaaaaaaa-0000-0000-0000-000000000001','CRM-PE-12345','Cardiologia',   'UFPE - 2010','Feminino', 4.9, 312),
  ('aaaaaaaa-0000-0000-0000-000000000002','CRM-PE-67890','Clínica Geral', 'UPE - 2015', 'Masculino',4.6, 198)
on conflict (id) do nothing;

insert into "public"."pacientes" (id, cpf, data_nascimento, idade, tipo_sanguineo, altura, genero, doencas_cronicas, plano) values
  ('bbbbbbbb-0000-0000-0000-000000000001','52998224725', date '1958-03-14',
     date_part('year', age(current_date, date '1958-03-14'))::int,
     'O+','1.62','Feminino','{hipertensão,diabetes tipo 2}','Premium'),
  ('bbbbbbbb-0000-0000-0000-000000000002','11144477735', date '1975-11-02',
     date_part('year', age(current_date, date '1975-11-02'))::int,
     'A-','1.78','Masculino','{hipertensão}','Básico')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Consultas (status tem CHECK: agendada | realizada | cancelada)
-- ---------------------------------------------------------------------------
insert into "public"."consultas"
  (id, paciente_id, medico_id, nome_paciente, data, horario, profissional, especialidade, motivo, status) values
  ('dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
     'Maria da Silva', (current_date + 3)::date, '09:00','Dra. Ana Beatriz Souza','Cardiologia','Retorno - controle de pressao','agendada'),
  ('dddddddd-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
     'Maria da Silva', (current_date - 7)::date, '10:30','Dra. Ana Beatriz Souza','Cardiologia','Avaliação de exames','realizada'),
  ('dddddddd-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',
     'João Pereira',   (current_date + 1)::date, '14:00','Dra. Ana Beatriz Souza','Cardiologia','Dor no peito','agendada'),
  ('dddddddd-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000002',
     'João Pereira',   (current_date - 20)::date,'16:00','Dr. Carlos Mendes','Clínica Geral','Check-up anual','realizada'),
  ('dddddddd-0000-0000-0000-000000000005','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
     'Maria da Silva', (current_date - 2)::date, '08:30','Dra. Ana Beatriz Souza','Cardiologia','Remarcada pelo paciente','cancelada')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Triagens (classificacao tem CHECK: verde | amarela | vermelha)
-- ---------------------------------------------------------------------------
insert into "public"."triagens"
  (id, paciente_id, medico_id, nome_paciente, data, horario, profissional, queixa_principal, classificacao) values
  ('eeeeeeee-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
     'Maria da Silva',(current_date - 1)::date,'08:15','Dra. Ana Beatriz Souza','Tontura e pressão alta','vermelha'),
  ('eeeeeeee-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000002',
     'João Pereira',  (current_date - 3)::date,'11:00','Dr. Carlos Mendes','Dor de cabeça leve','amarela'),
  ('eeeeeeee-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
     'Maria da Silva',(current_date - 10)::date,'15:45','Dra. Ana Beatriz Souza','Rotina de acompanhamento','verde')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Medicoes (status tem CHECK: normal | atencao | alerta)
-- Os pares abaixo foram escolhidos para exercer as tres faixas do
-- getMeasurementStatus() do app, assim o grafico e os alertas tem o que mostrar.
-- ---------------------------------------------------------------------------
insert into "public"."medicoes" (id, paciente_id, sistolica, diastolica, glicemia, status, created_at) values
  ('ffffffff-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001',148,94,132,'alerta',  now() - interval '0 days'),
  ('ffffffff-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001',136,88,105,'atencao', now() - interval '2 days'),
  ('ffffffff-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000001',122,80, 92,'normal',  now() - interval '4 days'),
  ('ffffffff-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000001',152,96,140,'alerta',  now() - interval '6 days'),
  ('ffffffff-0000-0000-0000-000000000005','bbbbbbbb-0000-0000-0000-000000000001',118,76, 88,'normal',  now() - interval '8 days'),
  ('ffffffff-0000-0000-0000-000000000006','bbbbbbbb-0000-0000-0000-000000000002',128,82, 95,'normal',  now() - interval '1 day')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Alertas (status tem CHECK: alerta | pendente | em_dia)
-- ---------------------------------------------------------------------------
insert into "public"."alertas" (id, paciente_id, medico_id, tipo, titulo, descricao, status, created_at) values
  ('99999999-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
     'pressao','Pressão arterial elevada','Sistólica 152 mmHg registrada na última medição.','alerta', now() - interval '1 day'),
  ('99999999-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
     'glicemia','Glicemia acima do limite','Glicemia 140 mg/dL - acima da faixa alvo.','pendente', now() - interval '2 days'),
  ('99999999-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000002',
     'medicacao','Medicacao em dia','Paciente confirmou uso correto dos medicamentos.','em_dia', now() - interval '3 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Pendencias, lembretes
-- ---------------------------------------------------------------------------
insert into "public"."pendencias" (id, medico_id, paciente_id, titulo, concluida) values
  ('88888888-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','Revisar exames de glicemia de Maria',false),
  ('88888888-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Ajustar dose do anti-hipertensivo',false),
  ('88888888-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','Enviar orientações de dieta',true)
on conflict (id) do nothing;

insert into "public"."lembretes" (id, paciente_id, texto, horario, ativo) values
  ('77777777-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','Tomar Losartana 50mg','08:00',true),
  ('77777777-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','Medir pressão arterial','19:00',true),
  ('77777777-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000002','Tomar Metformina','12:30',true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Cardápio da semana: 7 dias x 4 refeições = 28 linhas.
-- ATENÇÃO À GRAFIA: getCardapioDoDia() compara dia_semana por igualdade exata.
-- Os nomes precisam ser iguais ao array DIAS_SEMANA de src/lib/queries.ts,
-- inclusive acentos: 'Terça-feira' e 'Sábado'. O NOT EXISTS evita duplicar as
-- combinações dia/refeição quando este seed for executado novamente.
-- ---------------------------------------------------------------------------
insert into "public"."cardapio_semanal" (dia_semana, refeicao, descricao)
select d.dia, r.refeicao, r.descricao
from (values ('Domingo'),('Segunda-feira'),('Terça-feira'),('Quarta-feira'),
             ('Quinta-feira'),('Sexta-feira'),('Sábado')) as d(dia)
cross join (values
  ('Café da manhã','Aveia com banana e chia'),
  ('Almoço',       'Peixe grelhado, arroz integral e legumes'),
  ('Lanche',       'Iogurte natural com frutas vermelhas'),
  ('Jantar',       'Sopa de legumes com frango desfiado')
) as r(refeicao, descricao)
where not exists (
  select 1 from "public"."cardapio_semanal" c
  where c.dia_semana = d.dia and c.refeicao = r.refeicao
);

-- ---------------------------------------------------------------------------
-- Planos e assinatura
-- ---------------------------------------------------------------------------
insert into "public"."planos" (id, nome, descricao, preco) values
  ('cccccccc-0000-0000-0000-000000000001','Básico', 'Acompanhamento mensal e medições ilimitadas',  49.90),
  ('cccccccc-0000-0000-0000-000000000002','Premium','Consultas ilimitadas, alertas e nutricionista',129.90)
on conflict (id) do nothing;

insert into "public"."assinaturas" (id, paciente_id, plano_id, status) values
  ('66666666-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000002','ativa')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Resultado esperado:
--   profiles 4 | medicos 2 | pacientes 2 | consultas 5 | triagens 3
--   medicoes 6 | alertas 3 | pendencias 3 | lembretes 3 | cardapio 28
--   planos 2 | assinaturas 1 | sessions 0
-- ---------------------------------------------------------------------------
select 'profiles' t, count(*) q from "public"."profiles"
union all select 'medicos',          count(*) from "public"."medicos"
union all select 'pacientes',        count(*) from "public"."pacientes"
union all select 'consultas',        count(*) from "public"."consultas"
union all select 'triagens',         count(*) from "public"."triagens"
union all select 'medicoes',         count(*) from "public"."medicoes"
union all select 'alertas',          count(*) from "public"."alertas"
union all select 'pendencias',       count(*) from "public"."pendencias"
union all select 'lembretes',        count(*) from "public"."lembretes"
union all select 'cardapio_semanal', count(*) from "public"."cardapio_semanal"
union all select 'planos',           count(*) from "public"."planos"
union all select 'assinaturas',      count(*) from "public"."assinaturas"
union all select 'sessions',         count(*) from "public"."sessions"
order by t;

-- Login de teste:  maria@email.com / 123456   (paciente)
--                  ana@cardiajuda.com / 123456 (medica)
