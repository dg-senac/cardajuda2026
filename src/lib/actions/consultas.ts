"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { consultas, medicos, pacientes } from "@/db/schema";
import { requireProfile } from "@/lib/actions/auth";
import type { ActionResult } from "@/types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createConsultaPacienteAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "paciente") return { success: false, error: "Ação não permitida." };

  const data = str(formData, "data");
  const horario = str(formData, "horario");
  const profissional = str(formData, "profissional");
  const especialidade = str(formData, "especialidade");
  const motivo = str(formData, "motivo");

  if (!data || !horario || !profissional || !especialidade || !motivo) {
    return { success: false, error: "Preencha todos os campos." };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(`${data}T00:00:00`);
  if (selected < today) {
    return { success: false, error: "A data não pode ser no passado." };
  }

  try {
    await db.insert(consultas).values({
      pacienteId: profile.id,
      nomePaciente: profile.nome,
      data,
      horario,
      profissional,
      especialidade,
      motivo,
      status: "agendada",
    });
  } catch (err) {
    console.error("Erro ao criar consulta:", err);
    return { success: false, error: "Não foi possível agendar a consulta." };
  }

  revalidatePath("/paciente/consultas");
  revalidatePath("/paciente/inicio");
  return { success: true };
}

export async function createConsultaMedicoAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "medico") return { success: false, error: "Ação não permitida." };

  const pacienteId = str(formData, "paciente_id");
  const nomePaciente = str(formData, "nome_paciente");
  const data = str(formData, "data");
  const horario = str(formData, "horario");
  const profissional = str(formData, "profissional");
  const especialidade = str(formData, "especialidade");
  const motivo = str(formData, "motivo");

  if (!pacienteId || !nomePaciente || !data || !horario || !profissional || !especialidade || !motivo) {
    return { success: false, error: "Selecione um paciente válido e preencha todos os campos." };
  }

  const pacienteRows = await db.select().from(pacientes).where(eq(pacientes.id, pacienteId)).limit(1);
  if (!pacienteRows[0]) {
    return { success: false, error: "Paciente não encontrado. Selecione um da lista." };
  }

  try {
    await db.insert(consultas).values({
      pacienteId,
      medicoId: profile.id,
      nomePaciente,
      data,
      horario,
      profissional,
      especialidade,
      motivo,
      status: "agendada",
    });
  } catch (err) {
    console.error("Erro ao criar consulta:", err);
    return { success: false, error: "Não foi possível agendar a consulta." };
  }

  revalidatePath("/medico/consultas");
  revalidatePath("/medico/historico");
  revalidatePath("/medico/inicio");
  return { success: true };
}

export async function updateConsultaStatusAction(
  consultaId: string,
  status: "realizada" | "cancelada",
): Promise<ActionResult> {
  await requireProfile();
  try {
    await db.update(consultas).set({ status }).where(eq(consultas.id, consultaId));
    if (status === "realizada") {
      const rows = await db.select().from(consultas).where(eq(consultas.id, consultaId)).limit(1);
      const medicoId = rows[0]?.medicoId;
      if (medicoId) {
        const medicoRows = await db.select().from(medicos).where(eq(medicos.id, medicoId)).limit(1);
        if (medicoRows[0]) {
          await db
            .update(medicos)
            .set({ consultasFeitas: medicoRows[0].consultasFeitas + 1 })
            .where(eq(medicos.id, medicoId));
        }
      }
    }
  } catch (err) {
    console.error("Erro ao atualizar consulta:", err);
    return { success: false, error: "Não foi possível atualizar a consulta." };
  }

  revalidatePath("/medico/consultas");
  revalidatePath("/medico/historico");
  revalidatePath("/paciente/consultas");
  return { success: true };
}
