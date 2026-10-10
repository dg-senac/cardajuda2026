"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { alertas, pacientes, triagens } from "@/db/schema";
import { requireProfile } from "@/lib/actions/auth";
import type { ActionResult } from "@/types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createTriagemAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "medico") return { success: false, error: "Ação não permitida." };

  const pacienteId = str(formData, "paciente_id");
  const nomePaciente = str(formData, "nome_paciente");
  const data = str(formData, "data");
  const horario = str(formData, "horario");
  const profissional = str(formData, "profissional");
  const queixaPrincipal = str(formData, "queixa_principal");
  const classificacao = str(formData, "classificacao");

  if (!pacienteId || !nomePaciente || !data || !horario || !profissional || !queixaPrincipal || !classificacao) {
    return { success: false, error: "Selecione um paciente válido e preencha todos os campos." };
  }
  if (!["verde", "amarela", "vermelha"].includes(classificacao)) {
    return { success: false, error: "Classificação inválida." };
  }

  const pacienteRows = await db.select().from(pacientes).where(eq(pacientes.id, pacienteId)).limit(1);
  if (!pacienteRows[0]) {
    return { success: false, error: "Paciente não encontrado. Selecione um da lista." };
  }

  try {
    await db.insert(triagens).values({
      pacienteId,
      medicoId: profile.id,
      nomePaciente,
      data,
      horario,
      profissional,
      queixaPrincipal,
      classificacao,
    });

    if (classificacao === "vermelha") {
      await db.insert(alertas).values({
        pacienteId,
        medicoId: profile.id,
        tipo: "triagem",
        titulo: `Triagem crítica: ${nomePaciente}`,
        descricao: queixaPrincipal,
        status: "alerta",
      });
    }
  } catch (err) {
    console.error("Erro ao criar triagem:", err);
    return { success: false, error: "Não foi possível salvar a triagem." };
  }

  revalidatePath("/medico/consultas");
  revalidatePath("/medico/historico");
  revalidatePath("/medico/alertas");
  revalidatePath("/medico/inicio");
  return { success: true };
}
