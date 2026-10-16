"use server";

import { sql } from "drizzle-orm";
import { isUuid } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { alertas, medicoes } from "@/db/schema";
import { requireProfile } from "@/lib/actions/auth";
import { reportDbFailure } from "@/lib/actions/db";
import { getMeasurementStatus, validateMeasurement } from "@/lib/validations";
import type { ActionResult } from "@/types";

/**
 * Limites da coluna: `sistolica`/`diastolica`/`glicemia` são `integer`. O
 * `type="number"` do navegador aceita "1e21", e Number() disso é 1e21 -> o
 * Postgres responde 22003 "integer out of range" dentro do "Failed query" do
 * Drizzle, com a tela mostrando só "Não foi possível registrar".
 */
function bruto(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createMedicaoAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "paciente") return { success: false, error: "Ação não permitida." };

  const sistolicaTexto = bruto(formData, "sistolica");
  const diastolicaTexto = bruto(formData, "diastolica");
  const glicemiaTexto = bruto(formData, "glicemia");

  // A validação recebe o TEXTO: assim o nome do campo errado chega na mensagem
  // ("glicemia deve ser um número inteiro entre 20 e 1500") em vez de um genérico
  // "preencha os campos".
  const problema = validateMeasurement({
    sistolica: sistolicaTexto,
    diastolica: diastolicaTexto,
    glicemia: glicemiaTexto,
  });
  if (problema) return { success: false, error: problema };

  const sistolica = Number(sistolicaTexto);
  const diastolica = Number(diastolicaTexto);
  const glicemia = Number(glicemiaTexto);

  const status = getMeasurementStatus(sistolica, diastolica, glicemia);

  const requestId = String(formData.get("request_id") ?? "");
  if (requestId && !isUuid(requestId)) return { success: false, error: "Pedido inválido." };
  try {
    // medição + alerta na mesma transação: se o insert do alerta falhasse, a
    // medição ficava registrada e o alerta -- o motivo de existir da tela do
    // médico -- não existia.
    await db.transaction(async (tx) => {
      if (requestId) {
        const receipt = await tx.execute(sql`insert into mobile_private.mutation_receipts (user_id, request_id, operation) values (${profile.id}::uuid, ${requestId}::uuid, 'measurement') on conflict do nothing returning request_id`);
        if (!receipt.rows.length) return;
      }
      await tx.insert(medicoes).values({
        pacienteId: profile.id,
        sistolica,
        diastolica,
        glicemia,
        status,
      });

      if (status !== "normal") {
        await tx.insert(alertas).values({
          pacienteId: profile.id,
          tipo: "medicao",
          titulo: status === "alerta" ? "Medição com alerta" : "Medição requer atenção",
          descricao: `Pressão ${sistolica}/${diastolica} mmHg, Glicemia ${glicemia} mg/dL`,
          status: status === "alerta" ? "alerta" : "pendente",
        });
      }
    });
  } catch (err) {
    return {
      success: false,
      error: reportDbFailure("createMedicaoAction", err, "Não foi possível registrar a medição."),
    };
  }

  revalidatePath("/paciente/saude");
  revalidatePath("/medico/alertas");
  revalidatePath("/medico/pacientes");
  return { success: true };
}
