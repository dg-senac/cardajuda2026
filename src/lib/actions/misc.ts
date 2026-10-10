"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { assinaturas, medicos, pacientes, pendencias, planos, profiles } from "@/db/schema";
import { requireProfile } from "@/lib/actions/auth";
import { validatePhone } from "@/lib/validations";
import type { ActionResult } from "@/types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function togglePendenciaAction(pendenciaId: string, concluida: boolean): Promise<ActionResult> {
  await requireProfile();
  try {
    await db.update(pendencias).set({ concluida }).where(eq(pendencias.id, pendenciaId));
  } catch (err) {
    console.error("Erro ao atualizar pendência:", err);
    return { success: false, error: "Não foi possível atualizar a pendência." };
  }
  revalidatePath("/medico/alertas");
  return { success: true };
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  const nome = str(formData, "nome");
  const telefone = str(formData, "telefone");

  if (!nome || !telefone) {
    return { success: false, error: "Preencha nome e telefone." };
  }
  if (!validatePhone(telefone)) {
    return { success: false, error: "Telefone inválido." };
  }

  try {
    await db.update(profiles).set({ nome, telefone }).where(eq(profiles.id, profile.id));

    if (profile.role === "medico") {
      const especialidade = str(formData, "especialidade");
      const formacao = str(formData, "formacao");
      if (especialidade && formacao) {
        await db.update(medicos).set({ especialidade, formacao }).where(eq(medicos.id, profile.id));
      }
    }
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    return { success: false, error: "Não foi possível atualizar o perfil." };
  }

  revalidatePath("/paciente/perfil");
  revalidatePath("/medico/perfil");
  return { success: true };
}

export async function assinarPlanoAction(planoId: string): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "paciente") return { success: false, error: "Ação não permitida." };

  try {
    await db.update(assinaturas).set({ status: "cancelada" }).where(eq(assinaturas.pacienteId, profile.id));
    await db.insert(assinaturas).values({ pacienteId: profile.id, planoId, status: "ativa" });

    const planoRows = await db.select().from(planos).where(eq(planos.id, planoId)).limit(1);
    if (planoRows[0]) {
      await db.update(pacientes).set({ plano: planoRows[0].nome }).where(eq(pacientes.id, profile.id));
    }
  } catch (err) {
    console.error("Erro ao assinar plano:", err);
    return { success: false, error: "Não foi possível assinar o plano." };
  }

  revalidatePath("/paciente/inicio");
  return { success: true };
}

