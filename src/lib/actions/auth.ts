"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { medicos, pacientes, profiles } from "@/db/schema";
import {
  dbDetailsEnabled,
  diagnoseDbError,
  formatDbDiagnosis,
  userFacingDbMessage,
} from "@/lib/db-diagnosis.mjs";
import type { DbDiagnosis } from "@/lib/db-diagnosis.d.mts";
import { createSession, destroySession, getCurrentProfile } from "@/lib/session";
import {
  calculateAge,
  validateCPF,
  validateEmail,
  validatePhone,
} from "@/lib/validations";
import type { ActionResult } from "@/types";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Converte uma falha de banco em ActionResult.
 *
 * A mensagem que o Drizzle entrega ("Failed query: select ... limit $2") não diz
 * nada sobre a causa: a explicação real fica em `error.cause` (tabela
 * inexistente, senha errada, TLS, DNS...). Aqui a causa é desembrulhada, vai
 * inteira para o log do servidor e -- fora de produção ou com DB_DEBUG_ERRORS=1
 * -- volta também para a tela, para dar para resolver sem adivinhar.
 */
function dbFailure(purpose: "cadastro" | "login", context: string, error: unknown): ActionResult {
  const diagnosis = diagnoseDbError(error);
  console.error(`[auth] ${context} falhou\n${formatDbDiagnosis(diagnosis)}`);
  return { success: false, error: userFacingDbMessage(purpose, diagnosis, dbDetailsEnabled()) };
}

/** Conflito de unicidade (email/CPF/CRM): mensagem específica, não "erro de banco". */
function uniqueViolationMessage(diagnosis: DbDiagnosis): string | null {
  if (diagnosis.code !== "23505") return null;

  const alvo = `${diagnosis.constraint ?? ""} ${diagnosis.message} ${diagnosis.detail ?? ""}`;
  if (/email/i.test(alvo)) return "Já existe uma conta com este email.";
  if (/cpf/i.test(alvo)) return "Já existe um cadastro com este CPF.";
  if (/crm/i.test(alvo)) return "Já existe um cadastro com este CRM.";
  return "Já existe um cadastro com estes dados.";
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");

  if (!email || !password) {
    return { success: false, error: "Preencha email e senha." };
  }

  let profile: typeof profiles.$inferSelect | undefined;
  try {
    const rows = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    profile = rows[0];
  } catch (error) {
    return dbFailure("login", "loginAction/select profiles", error);
  }

  if (!profile) {
    return { success: false, error: "Email ou senha inválidos." };
  }

  const valid = await bcrypt.compare(password, profile.passwordHash);
  if (!valid) {
    return { success: false, error: "Email ou senha inválidos." };
  }

  try {
    await createSession(profile.id);
  } catch (error) {
    return dbFailure("login", "loginAction/createSession", error);
  }

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function signupPacienteAction(formData: FormData): Promise<ActionResult> {
  const nome = str(formData, "nome");
  const cpf = str(formData, "cpf");
  const telefone = str(formData, "telefone");
  const email = str(formData, "email").toLowerCase();
  const senha = str(formData, "senha");
  const dataNascimento = str(formData, "data_nascimento");
  const tipoSanguineo = str(formData, "tipo_sanguineo");
  const altura = str(formData, "altura");
  const genero = str(formData, "genero");

  if (!nome || !cpf || !telefone || !email || !senha || !dataNascimento || !tipoSanguineo || !altura || !genero) {
    return { success: false, error: "Preencha todos os campos obrigatórios." };
  }
  if (!validateCPF(cpf)) {
    return { success: false, error: "CPF inválido." };
  }
  if (!validateEmail(email)) {
    return { success: false, error: "Email inválido." };
  }
  if (!validatePhone(telefone)) {
    return { success: false, error: "Telefone inválido." };
  }
  if (senha.length < 6) {
    return { success: false, error: "A senha deve ter no mínimo 6 caracteres." };
  }

  const idade = calculateAge(dataNascimento);
  if (idade < 0 || idade > 120) {
    return { success: false, error: "Data de nascimento inválida." };
  }

  const passwordHash = await bcrypt.hash(senha, 10);

  // Toda a conversa com o banco fica dentro do try: qualquer falha (tabela
  // ausente, senha errada, host fora do ar, TLS) volta como ActionResult, em vez
  // de subir a exceção e derrubar a página inteira com "Runtime Error".
  let profileId: string | undefined;
  try {
    const existing = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    if (existing[0]) {
      return { success: false, error: "Já existe uma conta com este email." };
    }
    const existingCpf = await db.select().from(pacientes).where(eq(pacientes.cpf, cpf)).limit(1);
    if (existingCpf[0]) {
      return { success: false, error: "Já existe um cadastro com este CPF." };
    }

    const inserted = await db
      .insert(profiles)
      .values({ role: "paciente", nome, email, telefone, passwordHash })
      .returning({ id: profiles.id });
    profileId = inserted[0]?.id;
    if (!profileId) {
      throw new Error("O insert em profiles não retornou o id.");
    }

    await db.insert(pacientes).values({
      id: profileId,
      cpf: cpf.replace(/\D/g, ""),
      dataNascimento,
      idade,
      tipoSanguineo,
      altura,
      genero,
      doencasCronicas: [],
    });

    await createSession(profileId);
  } catch (error) {
    const diagnosis = diagnoseDbError(error);
    const duplicate = uniqueViolationMessage(diagnosis);
    if (duplicate) {
      return { success: false, error: duplicate };
    }

    // A conta foi gravada, mas um passo posterior falhou: avisar em vez de
    // sugerir um novo cadastro (que esbarraria no email duplicado).
    if (profileId) {
      console.error(`[auth] signupPacienteAction: conta ${profileId} criada, mas o restante falhou\n${formatDbDiagnosis(diagnosis)}`);
      return {
        success: false,
        error: dbDetailsEnabled()
          ? `A conta foi criada, mas o cadastro não foi concluído [${diagnosis.code ?? "sem código"}] ${diagnosis.message} | ${diagnosis.hint}`
          : "A conta foi criada, mas o cadastro não foi concluído. Tente entrar; se não conseguir, avise o suporte.",
      };
    }

    return dbFailure("cadastro", "signupPacienteAction", error);
  }

  return { success: true };
}

export async function signupMedicoAction(formData: FormData): Promise<ActionResult> {
  const nome = str(formData, "nome");
  const crm = str(formData, "crm");
  const especialidade = str(formData, "especialidade");
  const formacao = str(formData, "formacao");
  const telefone = str(formData, "telefone");
  const email = str(formData, "email").toLowerCase();
  const senha = str(formData, "senha");
  const genero = str(formData, "genero");

  if (!nome || !crm || !especialidade || !formacao || !telefone || !email || !senha || !genero) {
    return { success: false, error: "Preencha todos os campos obrigatórios." };
  }
  if (!validateEmail(email)) {
    return { success: false, error: "Email inválido." };
  }
  if (!validatePhone(telefone)) {
    return { success: false, error: "Telefone inválido." };
  }
  if (senha.length < 6) {
    return { success: false, error: "A senha deve ter no mínimo 6 caracteres." };
  }
  if (crm.length < 5) {
    return { success: false, error: "CRM inválido (mínimo 5 caracteres)." };
  }

  const passwordHash = await bcrypt.hash(senha, 10);

  let profileId: string | undefined;
  try {
    const existing = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    if (existing[0]) {
      return { success: false, error: "Já existe uma conta com este email." };
    }
    const existingCrm = await db.select().from(medicos).where(eq(medicos.crm, crm)).limit(1);
    if (existingCrm[0]) {
      return { success: false, error: "Já existe um cadastro com este CRM." };
    }

    const inserted = await db
      .insert(profiles)
      .values({ role: "medico", nome, email, telefone, passwordHash })
      .returning({ id: profiles.id });
    profileId = inserted[0]?.id;
    if (!profileId) {
      throw new Error("O insert em profiles não retornou o id.");
    }

    await db.insert(medicos).values({
      id: profileId,
      crm,
      especialidade,
      formacao,
      genero,
    });

    await createSession(profileId);
  } catch (error) {
    const diagnosis = diagnoseDbError(error);
    const duplicate = uniqueViolationMessage(diagnosis);
    if (duplicate) {
      return { success: false, error: duplicate };
    }

    if (profileId) {
      console.error(`[auth] signupMedicoAction: conta ${profileId} criada, mas o restante falhou\n${formatDbDiagnosis(diagnosis)}`);
      return {
        success: false,
        error: dbDetailsEnabled()
          ? `A conta foi criada, mas o cadastro não foi concluído [${diagnosis.code ?? "sem código"}] ${diagnosis.message} | ${diagnosis.hint}`
          : "A conta foi criada, mas o cadastro não foi concluído. Tente entrar; se não conseguir, avise o suporte.",
      };
    }

    return dbFailure("cadastro", "signupMedicoAction", error);
  }

  return { success: true };
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}
