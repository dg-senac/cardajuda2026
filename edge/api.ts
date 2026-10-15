import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { consultas } from "@/db/schema";
import * as auth from "@/lib/actions/auth";
import * as appointments from "@/lib/actions/consultas";
import { createMedicaoAction } from "@/lib/actions/medicoes";
import { createTriagemAction } from "@/lib/actions/triagens";
import * as misc from "@/lib/actions/misc";
import * as q from "@/lib/queries";
import { getCurrentProfile, destroySession } from "@/lib/session";
import { isUuid } from "@/lib/validations";
import { context } from "./runtime";
import { canReadPatient } from "./policy";

const cors = {
  "Access-Control-Allow-Origin": "https://localhost",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function forbidden(): never {
  throw new Error("FORBIDDEN");
}

export async function handle(request: Request): Promise<Response> {
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  if (request.method !== "POST")
    return response({ error: "Método inválido." }, 405);
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  return context.run({ token }, async () => {
    try {
      // Streamed bound also covers callers without Content-Length.
      const reader = request.body?.getReader();
      if (!reader) return response({ error: "Corpo obrigatório." }, 400);
      let text = "";
      let bytes = 0;
      const decoder = new TextDecoder();
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        if (bytes > 16000) {
          await reader.cancel();
          return response({ error: "Pedido muito grande." }, 413);
        }
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
      const { op, fields = {}, id, status, concluida } = JSON.parse(text);
      if (
        typeof op !== "string" ||
        !fields ||
        typeof fields !== "object" ||
        Array.isArray(fields)
      )
        return response({ error: "Pedido inválido." }, 400);
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        if (typeof value !== "string" || value.length > 1000)
          return response({ error: "Campo inválido." }, 400);
        form.set(key, value);
      }
      let result: unknown;
      if (["login", "signupPaciente", "signupMedico"].includes(op)) {
        result =
          op === "login"
            ? await auth.loginAction(form)
            : op === "signupPaciente"
              ? await auth.signupPacienteAction(form)
              : await auth.signupMedicoAction(form);
      } else {
        const p = await getCurrentProfile();
        if (!p) throw new Error("UNAUTHORIZED");
        const approved =
          p.role === "medico" &&
          (
            await db.execute(
              sql`select 1 from mobile_private.approved_doctors where medico_id = ${p.id}::uuid`,
            )
          ).rows.length > 0;
        const doctor = () => {
          if (!approved) forbidden();
        };
        const patientAccess = async (pid: string) => {
          if (!isUuid(pid)) forbidden();
          const linked =
            p.role === "medico" &&
            (
              await db
                .select({ id: consultas.id })
                .from(consultas)
                .where(
                  and(
                    eq(consultas.medicoId, p.id),
                    eq(consultas.pacienteId, pid),
                  ),
                )
                .limit(1)
            ).length > 0;
          if (!canReadPatient(p.role, p.id, pid, approved, linked)) forbidden();
        };
        switch (op) {
          case "me":
            result = { profile: p, approved };
            break;
          case "logout":
            result = { success: await destroySession(), error: "Saída local concluída. Não foi possível revogar a sessão no servidor; ela permanece válida até expirar. Entre em contato com o responsável se necessário." };
            break;
          case "home":
            if (p.role === "paciente") {
              result = {
                perfil: await q.getPacienteById(p.id),
                consultas: await q.listConsultasByPaciente(p.id),
                medicoes: await q.listMedicoesByPaciente(p.id, 100),
                lembretes: await q.listLembretesByPaciente(p.id),
                cardapio: await q.getCardapioDoDia(q.getDiaSemanaAtual()),
                planos: await q.listPlanos(),
                assinatura: await q.getAssinaturaAtual(p.id),
                medicos: (await q.listMedicos()).map((m) => ({
                  id: m.id,
                  nome: m.nome,
                  especialidade: m.especialidade,
                  crm: m.crm,
                })),
              };
            } else {
              doctor();
              const agenda = await q.listConsultasByMedico(p.id);
              const ids = [...new Set(agenda.map((c) => c.pacienteId))];
              result = {
                perfil: await q.getMedicoById(p.id),
                consultas: agenda,
                triagens: await q.listTriagensByMedico(p.id),
                pacientes: await Promise.all(
                  ids.map((pid) => q.getPacienteById(pid)),
                ),
                pendencias: await q.listPendenciasByMedico(p.id),
                alertas: (await q.listAlertas()).filter(
                  (a) =>
                    a.medicoId === p.id ||
                    (!a.medicoId && ids.includes(a.pacienteId)),
                ),
              };
            }
            break;
          case "patient":
            await patientAccess(id);
            result = {
              perfil: await q.getPacienteById(id),
              medicoes: await q.listMedicoesByPaciente(id, 100),
              consultas: (await q.listConsultasByMedico(p.id)).filter(c => c.pacienteId === id),
              triagens: (await q.listTriagensByMedico(p.id)).filter(t => t.pacienteId === id),
            };
            break;
          case "measurements": {
            const offset = Number(fields.offset);
            if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) forbidden();
            const pid = fields.paciente_id || p.id;
            await patientAccess(pid);
            result = await q.listMedicoesByPaciente(pid, 100, offset);
            break;
          }
          case "measurement":
            result = await createMedicaoAction(form);
            break;
          case "appointment":
            if (p.role === "medico") {
              doctor();
              await patientAccess(fields.paciente_id);
              const target = await q.getPacienteById(fields.paciente_id);
              form.set("nome_paciente", target!.nome);
              form.set("profissional", p.nome);
              result = await appointments.createConsultaMedicoAction(form);
            } else {
              if (!isUuid(fields.medico_id)) forbidden();
              const m = await q.getMedicoById(fields.medico_id);
              if (!m) forbidden();
              form.set("profissional", m.nome);
              form.set("especialidade", m.especialidade);
              result = await appointments.createConsultaPacienteAction(form);
            }
            break;
          case "triage": {
            doctor();
            await patientAccess(fields.paciente_id);
            const target = await q.getPacienteById(fields.paciente_id);
            form.set("nome_paciente", target!.nome);
            form.set("profissional", p.nome);
            result = await createTriagemAction(form);
            break;
          }
          case "appointmentStatus":
            doctor();
            result = await appointments.updateConsultaStatusAction(id, status);
            break;
          case "pending":
            doctor();
            if (typeof concluida !== "boolean") forbidden();
            result = await misc.togglePendenciaAction(id, concluida);
            break;
          case "profile":
            result = await misc.updateProfileAction(form);
            break;
          case "subscribe":
            result = await misc.assinarPlanoAction(id);
            break;
          default:
            return response({ error: "Operação desconhecida." }, 400);
        }
      }
      if ((result as { error?: string })?.error === "Muitas tentativas. Aguarde 15 minutos.") return response({ error: "Muitas tentativas. Aguarde 15 minutos." }, 429);
      return response({ result, token: context.getStore()?.issued });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "UNAUTHORIZED")
        return response({ error: "Entre novamente." }, 401);
      if (code === "FORBIDDEN")
        return response(
          {
            error:
              "Acesso não permitido. Médicos precisam de aprovação e vínculo com o paciente.",
          },
          403,
        );
      if (code === "RATE_LIMIT")
        return response(
          { error: "Muitas tentativas. Aguarde 15 minutos." },
          429,
        );
      if (e instanceof SyntaxError)
        return response({ error: "Pedido inválido." }, 400);
      return response(
        {
          error:
            "Não foi possível concluir. Verifique a conexão e tente novamente.",
        },
        503,
      );
    }
  });
}
