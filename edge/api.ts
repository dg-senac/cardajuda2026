import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { consultas } from "@/db/schema";
import * as auth from "@/lib/actions/auth";
import * as appointments from "@/lib/actions/consultas";
import { createMedicaoAction } from "@/lib/actions/medicoes";
import { createTriagemAction } from "@/lib/actions/triagens";
import * as misc from "@/lib/actions/misc";
import * as q from "@/lib/queries";
import { getCurrentProfile } from "@/lib/session";
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

// Persistent, atomic account-based throttling across Edge instances; never store emails/IPs here.
async function throttle(email: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.toLowerCase().trim()),
  );
  const key = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const result =
    await db.execute(sql`insert into mobile_private.login_limits (key, attempts, window_start)
    values (${key}, 1, now()) on conflict (key) do update set
    attempts = case when mobile_private.login_limits.window_start < now() - interval '15 minutes' then 1 else mobile_private.login_limits.attempts + 1 end,
    window_start = case when mobile_private.login_limits.window_start < now() - interval '15 minutes' then now() else mobile_private.login_limits.window_start end
    returning attempts`);
  if (Number(result.rows[0]?.attempts) > 10) throw new Error("RATE_LIMIT");
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
        await throttle(String(fields.email ?? ""));
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
            // logoutAction redirects after revocation; the adapter has no navigation.
            try {
              await auth.logoutAction();
            } catch (e) {
              if (!(e instanceof Error) || e.message !== "UNAUTHORIZED")
                throw e;
            }
            result = { success: true };
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
            };
            break;
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
