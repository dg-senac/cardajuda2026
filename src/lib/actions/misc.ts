"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { assinaturas, medicos, pacientes, pendencias, planos, profiles } from "@/db/schema";
import { requireProfile } from "@/lib/actions/auth";
import { reportDbFailure } from "@/lib/actions/db";
import { isUuid, validatePhone } from "@/lib/validations";
import type { ActionResult } from "@/types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

class RequisitoInvalido extends Error {}

/** Máximo de caracteres tolerado pelas colunas `text` que o app usa em formulários. */
const LIMITE_TEXTO = 200;

export async function togglePendenciaAction(pendenciaId: string, concluida: boolean): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "medico") return { success: false, error: "Ação não permitida." };
  if (!isUuid(pendenciaId)) return { success: false, error: "Parâmetros inválidos." };

  try {
    // `where(medicoId = logado)`: antes qualquer usuário logado que tivesse o uuid
    // de uma pendência concluia a pendência de outro médico (a tela mostrava só as
    // suas, mas a action não checava nada). O rowCount conta para a UI saber se
    // realmente mexeu em alguma linha.
    const alteradas = await db
      .update(pendencias)
      .set({ concluida: Boolean(concluida) })
      .where(and(eq(pendencias.id, pendenciaId), eq(pendencias.medicoId, profile.id)))
      .returning({ id: pendencias.id });

    if (alteradas.length === 0) {
      return { success: false, error: "Esta pendência não existe ou não é sua." };
    }
  } catch (err) {
    return {
      success: false,
      error: reportDbFailure("togglePendenciaAction", err, "Não foi possível atualizar a pendência."),
    };
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
  if (nome.length > LIMITE_TEXTO || telefone.length > LIMITE_TEXTO) {
    return { success: false, error: "Nome ou telefone longos demais." };
  }
  if (!validatePhone(telefone)) {
    return { success: false, error: "Telefone inválido." };
  }

  const especialidade = str(formData, "especialidade");
  const formacao = str(formData, "formacao");

  try {
    // As duas tabelas (profiles + medicos) precisam mudar juntas: nome no perfil
    // com especialidade antiga é o tipo de incoerência que depois ninguém explica.
    await db.transaction(async (tx) => {
      await tx.update(profiles).set({ nome, telefone }).where(eq(profiles.id, profile.id));

      if (profile.role === "medico" && especialidade && formacao) {
        await tx
          .update(medicos)
          .set({ especialidade, formacao })
          .where(eq(medicos.id, profile.id));
      }
    });
  } catch (err) {
    return {
      success: false,
      error: reportDbFailure("updateProfileAction", err, "Não foi possível atualizar o perfil."),
    };
  }

  revalidatePath("/paciente/perfil");
  revalidatePath("/medico/perfil");
  return { success: true };
}

/**
 * Assina (ou troca) o plano do paciente.
 *
 * Eram três gravações soltas: cancelar as assinaturas antigas, inserir a nova e
 * atualizar `pacientes.plano`. Se a segunda falhasse, o paciente ficava SEM
 * assinatura ativa e com o nome do plano antigo na ficha -- dados divergentes que
 * as telas mostram de formas diferentes. Agora é uma transação só, e o `planoId`
 * é conferido antes (sem isso, um uuid inexistente virava violação de FK com o
 * `reltable "planos"` escondido no "Failed query" do Drizzle).
 */
export async function assinarPlanoAction(planoId: string): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "paciente") return { success: false, error: "Ação não permitida." };
  if (!isUuid(planoId)) return { success: false, error: "Plano inválido." };

  try {
    await db.transaction(async (tx) => {
      const plano = await tx
        .select({ id: planos.id, nome: planos.nome })
        .from(planos)
        .where(eq(planos.id, planoId))
        .limit(1);
      if (!plano[0]) {
        throw new RequisitoInvalido("Este plano não está mais disponível. Recarregue a lista.");
      }

      await tx
        .update(assinaturas)
        .set({ status: "cancelada" })
        .where(and(eq(assinaturas.pacienteId, profile.id), ne(assinaturas.status, "cancelada")));

      await tx.insert(assinaturas).values({
        pacienteId: profile.id,
        planoId,
        status: "ativa",
      });

      // `pacientes.plano` é uma cópia denormalizada do nome do plano (as telas de
      // perfil mostram direto). Atualizar as duas coisas juntas é o que mantém a
      // ficha e a assinatura dizendo a mesma coisa.
      await tx
        .update(pacientes)
        .set({ plano: plano[0].nome })
        .where(eq(pacientes.id, profile.id));
    });
  } catch (err) {
    if (err instanceof RequisitoInvalido) return { success: false, error: err.message };
    return {
      success: false,
      error: reportDbFailure("assinarPlanoAction", err, "Não foi possível assinar o plano."),
    };
  }

  revalidatePath("/paciente/inicio");
  revalidatePath("/paciente/perfil");
  return { success: true };
}
