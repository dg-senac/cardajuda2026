"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { consultas, medicos, pacientes, profiles } from "@/db/schema";
import { isApprovedDoctor, requireDoctor, requirePatientAccess } from "@/lib/access";
import { requireProfile } from "@/lib/actions/auth";
import { reportDbFailure } from "@/lib/actions/db";
import { isUuid, isValidIsoDate, isValidTime } from "@/lib/validations";
import type { ActionResult } from "@/types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

const TAMANHO_MAXIMO = 500;

/** Interrompe a transação com mensagem amigável (nada é gravado). */
class RequisitoInvalido extends Error {}

/**
 * Checagens comuns aos dois formulários de consulta.
 *
 * `data`/`horario` iam direto para as colunas `date`/`text`: um valor fora do
 * formato devolvia 22007 "invalid input syntax for type date" (ou 22P02 para
 * uuid) embrulhado no "Failed query" do Drizzle. Aqui o erro vira mensagem na
 * tela antes de tocar no banco.
 */
function validarAgendamento(
  data: string,
  horario: string,
  campos: Record<string, string>,
): string | null {
  for (const [label, valor] of Object.entries(campos)) {
    if (!valor) return `Preencha o campo ${label}.`;
    if (valor.length > TAMANHO_MAXIMO) return `O campo ${label} está longo demais.`;
  }
  if (!isValidIsoDate(data)) return "Data inválida (use o formato AAAA-MM-DD).";
  if (!isValidTime(horario)) return "Horário inválido (use HH:MM).";
  return null;
}

/** Hoje no fuso do servidor, em AAAA-MM-DD (a coluna `data` não tem hora). */
function hojeIso(): string {
  return new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo", year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

export async function createConsultaPacienteAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "paciente") return { success: false, error: "Ação não permitida." };

  const data = str(formData, "data");
  const horario = str(formData, "horario");
  const profissional = str(formData, "profissional");
  const especialidade = str(formData, "especialidade");
  const motivo = str(formData, "motivo");

  const invalido = validarAgendamento(data, horario, {
    data,
    horario,
    profissional,
    especialidade,
    motivo,
  });
  if (invalido) return { success: false, error: invalido };

  if (data < hojeIso()) {
    return { success: false, error: "A data não pode ser no passado." };
  }

  try {
    // O texto digitado no form nunca vira id de médico às cegas: `paciente_id` e
    // companhia são ignorados de propósito, porque o vínculo é o PERFIL logado.
    const escolhido = str(formData, "medico_id");
    if (!isUuid(escolhido)) return { success: false, error: "Selecione um médico da lista." };
    const rows = await db.select({ id: medicos.id, nome: profiles.nome, especialidade: medicos.especialidade }).from(medicos).innerJoin(profiles, eq(profiles.id, medicos.id)).where(eq(medicos.id, escolhido)).limit(1);
    if (!rows[0]) return { success: false, error: "Médico não encontrado." };
    const medicoId = rows[0].id;
    if (!await isApprovedDoctor(medicoId)) return { success: false, error: "Este médico ainda aguarda aprovação." };
    await db.insert(consultas).values({
      pacienteId: profile.id,
      medicoId,
      nomePaciente: profile.nome,
      data,
      horario,
      profissional: rows[0].nome,
      especialidade: rows[0].especialidade,
      motivo,
      status: "agendada",
    });
  } catch (err) {
    return {
      success: false,
      error: reportDbFailure("createConsultaPacienteAction", err, "Não foi possível agendar a consulta."),
    };
  }

  revalidatePath("/paciente/consultas");
  revalidatePath("/paciente/inicio");
  return { success: true };
}

export async function createConsultaMedicoAction(formData: FormData): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "medico") return { success: false, error: "Ação não permitida." };
  await requireDoctor(profile.id);

  const pacienteId = str(formData, "paciente_id");
  const nomePaciente = str(formData, "nome_paciente");
  const data = str(formData, "data");
  const horario = str(formData, "horario");
  const profissional = str(formData, "profissional");
  const especialidade = str(formData, "especialidade");
  const motivo = str(formData, "motivo");

  // `paciente_id` vem de um <input type="hidden">: qualquer coisa ali chega ao
  // banco como parâmetro de uuid() e estoura em 22P02.
  if (!isUuid(pacienteId)) {
    return {
      success: false,
      error: "Selecione um paciente válido (digite o nome e escolha um da lista).",
    };
  }
  const invalido = validarAgendamento(data, horario, {
    nomePaciente,
    data,
    horario,
    profissional,
    especialidade,
    motivo,
  });
  if (invalido) return { success: false, error: invalido };

  try {
    // Conferência + insert na MESMA transação: entre o select e o insert de
    // antes, o paciente podia ser apagado e a FK estourava no meio da action.
    await db.transaction(async (tx) => {
      await requirePatientAccess(pacienteId);
      const alvo = await tx
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(eq(pacientes.id, pacienteId))
        .limit(1);
      if (!alvo[0]) {
        throw new RequisitoInvalido("Paciente não encontrado. Selecione um da lista.");
      }

      await tx.insert(consultas).values({
        pacienteId,
        medicoId: profile.id,
        nomePaciente: (await tx.select({ nome: profiles.nome }).from(profiles).where(eq(profiles.id, pacienteId)))[0].nome,
        data,
        horario,
        profissional: profile.nome,
        especialidade: (await tx.select({ especialidade: medicos.especialidade }).from(medicos).where(eq(medicos.id, profile.id)))[0].especialidade,
        motivo,
        status: "agendada",
      });
    });
  } catch (err) {
    if (err instanceof RequisitoInvalido) return { success: false, error: err.message };
    return {
      success: false,
      error: reportDbFailure("createConsultaMedicoAction", err, "Não foi possível agendar a consulta."),
    };
  }

  revalidatePath("/medico/consultas");
  revalidatePath("/medico/historico");
  revalidatePath("/medico/inicio");
  return { success: true };
}

/**
 * Marca consulta como realizada/cancelada.
 *
 * Três correções no mesmo ponto:
 *
 * 1. **Escopo.** Antes bastava `requireProfile()`: qualquer pessoa logada --
 *    inclusive um paciente com o uuid em mãos -- conseguia marcar como
 *    "realizada" a consulta de outro profissional, ou cancelar a dele. O UPDATE
 *    agora só encontra a linha se ela pertencer ao médico logado.
 * 2. **Contador atômico.** `consultas_feitas` era lido, somado fora do banco e
 *    gravado: duas marcações simultâneas liam o mesmo valor e uma consulta
 *    deixava de contar. O `+ 1` agora é executado pelo Postgres, na transação.
 * 3. **Idempotência.** Clicar duas vezes em "Marcar realizada" somava 2. O
 *    `for("update")` tranca a linha e o incremento só roda quando o status
 *    anterior não era "realizada".
 */
export async function updateConsultaStatusAction(
  consultaId: string,
  status: "realizada" | "cancelada",
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "medico") {
    return { success: false, error: "Ação não permitida." };
  }
  if (!isUuid(consultaId) || !["realizada", "cancelada"].includes(status)) {
    return { success: false, error: "Parâmetros inválidos." };
  }

  try {
    await db.transaction(async (tx) => {
      await requireDoctor(profile.id);
      const alvo = await tx
        .select({ id: consultas.id, status: consultas.status })
        .from(consultas)
        .where(and(eq(consultas.id, consultaId), eq(consultas.medicoId, profile.id)))
        .for("update")
        .limit(1);

      const consulta = alvo[0];
      if (!consulta) {
        throw new ForaDoEscopo();
      }
      if (consulta.status === status) return;
      if (consulta.status !== "agendada") throw new RequisitoInvalido("Consulta finalizada não pode mudar de estado.");

      await tx.update(consultas).set({ status }).where(eq(consultas.id, consultaId));

      if (status === "realizada") {
        await tx
          .update(medicos)
          .set({ consultasFeitas: sql`${medicos.consultasFeitas} + 1` })
          .where(eq(medicos.id, profile.id));
      }
    });
  } catch (err) {
    if (err instanceof RequisitoInvalido) return { success: false, error: err.message };
    if (err instanceof ForaDoEscopo) {
      return { success: false, error: "Esta consulta não existe ou não está no seu nome." };
    }
    return {
      success: false,
      error: reportDbFailure(
        "updateConsultaStatusAction",
        err,
        "Não foi possível atualizar a consulta.",
      ),
    };
  }

  revalidatePath("/medico/consultas");
  revalidatePath("/medico/historico");
  revalidatePath("/paciente/consultas");
  return { success: true };
}

class ForaDoEscopo extends Error {}
