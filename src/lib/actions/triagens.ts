"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { alertas, pacientes, profiles, triagens } from "@/db/schema";
import { requireDoctor, requirePatientAccess } from "@/lib/access";
import { requireProfile } from "@/lib/actions/auth";
import { reportDbFailure } from "@/lib/actions/db";
import { isUuid, isValidIsoDate, isValidTime } from "@/lib/validations";
import type { ActionResult } from "@/types";

const CLASSIFICACOES = ["verde", "amarela", "vermelha"] as const;
type Classificacao = (typeof CLASSIFICACOES)[number];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

class RequisitoInvalido extends Error {}

export async function createTriagemAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "medico") return { success: false, error: "Ação não permitida." };
  await requireDoctor(profile.id);

  const pacienteId = str(formData, "paciente_id");
  const nomePaciente = str(formData, "nome_paciente");
  const data = str(formData, "data");
  const horario = str(formData, "horario");
  const profissional = str(formData, "profissional");
  const queixaPrincipal = str(formData, "queixa_principal");
  const classificacao = str(formData, "classificacao");

  if (!nomePaciente || !data || !horario || !profissional || !queixaPrincipal) {
    return { success: false, error: "Preencha todos os campos." };
  }
  if (!isUuid(pacienteId)) {
    return {
      success: false,
      error: "Selecione um paciente válido (digite o nome e escolha um da lista).",
    };
  }
  if (!CLASSIFICACOES.includes(classificacao as Classificacao)) {
    return { success: false, error: "Classificação inválida." };
  }
  // A coluna triagens.classificacao tem CHECK ('verde','amarela','vermelha') e
  // `data`/`horario` são `date`/`text`: conferir aqui devolve mensagem na tela em
  // vez de 23514/22007 dentro do "Failed query" do Drizzle.
  if (!isValidIsoDate(data) || !isValidTime(horario)) {
    return { success: false, error: "Data ou horário em formato inválido." };
  }

  const requestId = String(formData.get("request_id") ?? "");
  if (requestId && !isUuid(requestId)) return { success: false, error: "Pedido inválido." };
  try {
    // triagem + alerta críticos na mesma transação.
    //
    // A triagem 'vermelha' gera um alerta em `alertas`. Sem transação, uma falha
    // no segundo insert deixava a triagem registrada SEM alerta: justamente o
    // caso que precisa de atenção imediata sumindo da tela do médico, sem nenhum
    // erro visível para ninguém.
    await db.transaction(async (tx) => {
      if (requestId) {
        const receipt = await tx.execute(sql`insert into mobile_private.mutation_receipts (user_id, request_id, operation) values (${profile.id}::uuid, ${requestId}::uuid, 'triage') on conflict do nothing returning request_id`);
        if (!receipt.rows.length) return;
      }
      await requirePatientAccess(pacienteId);
      const alvo = await tx
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(eq(pacientes.id, pacienteId))
        .limit(1);
      if (!alvo[0]) {
        throw new RequisitoInvalido("Paciente não encontrado. Selecione um da lista.");
      }

      const patientName = (await tx.select({ nome: profiles.nome }).from(profiles).where(eq(profiles.id, pacienteId)))[0].nome;
      await tx.insert(triagens).values({
        pacienteId,
        medicoId: profile.id,
        nomePaciente: patientName,
        data,
        horario,
        profissional: profile.nome,
        queixaPrincipal,
        classificacao,
      });

      if (classificacao === "vermelha") {
        await tx.insert(alertas).values({
          pacienteId,
          medicoId: profile.id,
          tipo: "triagem",
          titulo: `Triagem crítica: ${patientName}`,
          descricao: queixaPrincipal,
          status: "alerta",
        });
      }
    });
  } catch (err) {
    if (err instanceof RequisitoInvalido) return { success: false, error: err.message };
    return {
      success: false,
      error: reportDbFailure("createTriagemAction", err, "Não foi possível salvar a triagem."),
    };
  }

  revalidatePath("/medico/consultas");
  revalidatePath("/medico/historico");
  revalidatePath("/medico/alertas");
  revalidatePath("/medico/inicio");
  return { success: true };
}
