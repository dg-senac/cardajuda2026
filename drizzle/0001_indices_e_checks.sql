-- 0001_indices_e_checks
--
-- Traz o banco criado por `npm run db:migrate` para o MESMO estado do banco
-- criado por `npm run db:setup` (supabase/schema.sql): os indices que o app
-- precisa para nao varrer tabela inteira em cada listagem, os CHECK de
-- status/altura/idade e o par unico (dia, refeicao) do cardapio.
--
-- Sem este arquivo, quem usa migracao em vez do schema.sql fica com as tabelas
-- certas e o plano de execucao pior -- e o primeiro `drizzle-kit push` passa a
-- propor DROP dos indices de quem usou o schema.sql.
--
CREATE INDEX "alertas_created_idx" ON "alertas" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX "alertas_paciente_id_idx" ON "alertas" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "assinaturas_paciente_id_status_idx" ON "assinaturas" USING btree ("paciente_id","status");--> statement-breakpoint
CREATE INDEX "assinaturas_plano_id_idx" ON "assinaturas" USING btree ("plano_id");--> statement-breakpoint
CREATE INDEX "cardapio_semanal_dia_semana_idx" ON "cardapio_semanal" USING btree ("dia_semana");--> statement-breakpoint
CREATE UNIQUE INDEX "cardapio_semanal_dia_refeicao_unique" ON "cardapio_semanal" USING btree ("dia_semana","refeicao");--> statement-breakpoint
CREATE INDEX "consultas_paciente_id_data_idx" ON "consultas" USING btree ("paciente_id","data" desc,"created_at" desc);--> statement-breakpoint
CREATE INDEX "consultas_medico_id_data_idx" ON "consultas" USING btree ("medico_id","data" desc,"created_at" desc);--> statement-breakpoint
CREATE INDEX "lembretes_paciente_id_ativo_idx" ON "lembretes" USING btree ("paciente_id","ativo");--> statement-breakpoint
CREATE INDEX "medicoes_paciente_id_created_idx" ON "medicoes" USING btree ("paciente_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "pendencias_medico_id_created_idx" ON "pendencias" USING btree ("medico_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "pendencias_paciente_id_idx" ON "pendencias" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "profiles_created_at_idx" ON "profiles" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "triagens_medico_id_data_idx" ON "triagens" USING btree ("medico_id","data" desc,"created_at" desc);--> statement-breakpoint
CREATE INDEX "triagens_paciente_id_idx" ON "triagens" USING btree ("paciente_id");--> statement-breakpoint
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_status_check" CHECK ("assinaturas"."status" in ('ativa','cancelada','pendente'));--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_altura_check" CHECK ("pacientes"."altura" between 0.30 and 2.80);--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_idade_check" CHECK ("pacientes"."idade" between 0 and 130);