"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { alertas, medicoes } from "@/db/schema";
import { requireProfile } from "@/lib/actions/auth";
import { getMeasurementStatus } from "@/lib/validations";
import type { ActionResult } from "@/types";

function num(formData: FormData, key: string): number {
  return Number(formData.get(key));
}

export async function createMedicaoAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "paciente") return { success: false, error: "Ação não permitida." };

  const sistolica = num(formData, "sistolica");
  const diastolica = num(formData, "diastolica");
  const glicemia = num(formData, "glicemia");

  if (!sistolica || !diastolica || !glicemia) {
    return { success: false, error: "Preencha todos os campos com valores válidos." };
  }
  if (sistolica <= 0 || diastolica <= 0 || glicemia <= 0) {
    return { success: false, error: "Os valores devem ser maiores que zero." };
  }

  const status = getMeasurementStatus(sistolica, diastolica, glicemia);

  try {
    await db.insert(medicoes).values({
      pacienteId: profile.id,
      sistolica,
      diastolica,
      glicemia,
      status,
    });

    if (status !== "normal") {
      await db.insert(alertas).values({
        pacienteId: profile.id,
        tipo: "medicao",
        titulo: status === "alerta" ? "Medição com alerta" : "Medição requer atenção",
        descricao: `Pressão ${sistolica}/${diastolica} mmHg, Glicemia ${glicemia} mg/dL`,
        status: status === "alerta" ? "alerta" : "pendente",
      });
    }
  } catch (err) {
    console.error("Erro ao registrar medição:", err);
    return { success: false, error: "Não foi possível registrar a medição." };
  }

  revalidatePath("/paciente/saude");
  revalidatePath("/medico/alertas");
  revalidatePath("/medico/pacientes");
  return { success: true };
}
