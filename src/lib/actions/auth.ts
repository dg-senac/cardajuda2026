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
import { uniqueViolationMessage } from "@/lib/actions/db";
import { createSession, destroySession, getCurrentProfile } from "@/lib/session";
import {
  calculateAge,
  isValidIsoDate,
  normalizeCpf,
  validateCPF,
  validateEmail,
  validateHeight,
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

  const duplicate = uniqueViolationMessage(diagnosis);
  if (duplicate && purpose === "cadastro") {
    return { success: false, error: duplicate };
  }
  return { success: false, error: userFacingDbMessage(purpose, diagnosis, dbDetailsEnabled()) };
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

/**
 * Mensagem única para os dois cadastros: quando o profile é gravado e o passo
 * seguinte falha, NÃO se deve sugerir "cadastre de novo" (o email está ocupado).
 */
function incompleteSignup(error: unknown, context: string): ActionResult {
  const diagnosis = diagnoseDbError(error);
  console.error(
    `[auth] ${context}: conta criada, mas o restante falhou\n${formatDbDiagnosis(diagnosis)}`,
  );
  return {
    success: false,
    error: dbDetailsEnabled()
      ? `A conta foi criada, mas o cadastro não foi concluído [${diagnosis.code ?? "sem código"}] ${diagnosis.message} | ${diagnosis.hint}`
      : "A conta foi criada, mas o cadastro não foi concluído. Tente entrar; se não conseguir, avise o suporte.",
  };
}

export async function signupPacienteAction(formData: FormData): Promise<ActionResult> {
  const nome = str(formData, "nome");
  const cpf = normalizeCpf(str(formData, "cpf"));
  const telefone = str(formData, "telefone");
  const email = str(formData, "email").toLowerCase();
  const senha = str(formData, "senha");
  const dataNascimento = str(formData, "data_nascimento");
  const tipoSanguineo = str(formData, "tipo_sanguineo");
  const alturaTexto = str(formData, "altura").replace(",", ".");
  const genero = str(formData, "genero");

  if (!nome || !cpf || !telefone || !email || !senha || !dataNascimento || !tipoSanguineo || !alturaTexto || !genero) {
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
  if (!isValidIsoDate(dataNascimento)) {
    return { success: false, error: "Data de nascimento inválida (use o formato AAAA-MM-DD)." };
  }
  const altura = Number(alturaTexto);
  if (!validateHeight(altura)) {
    return {
      success: false,
      error: "Altura inválida: informe em metros, por exemplo 1.70 (a coluna é numeric(5,2)).",
    };
  }

  const idade = calculateAge(dataNascimento);
  if (idade < 0 || idade > 120) {
    return { success: false, error: "Data de nascimento inválida." };
  }

  const passwordHash = await bcrypt.hash(senha, 10);

  let profileId: string | undefined;
  try {
    const existing = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, email)).limit(1);
    if (existing[0]) {
      return { success: false, error: "Já existe uma conta com este email." };
    }
    // O WHERE usa o CPF JÁ NORMALIZADO: a coluna guarda "52998224725", então
    // comparar com o valor digitado ("529.982.247-25") nunca achava nada e a
    // checagem virava enfeite.
    const existingCpf = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(eq(pacientes.cpf, cpf))
      .limit(1);
    if (existingCpf[0]) {
      return { success: false, error: "Já existe um cadastro com este CPF." };
    }

    // profiles + pacientes numa transação SÓ.
    //
    // Antes eram dois inserts fora de transação: se o segundo falhasse (coluna
    // ausente no banco, overflow de numeric, conexão caindo), restava um
    // `profiles` sem linha em `pacientes`. Consequências: o login passava, toda
    // tela de paciente vinha vazia, e a próxima tentativa de cadastro esbarrava
    // em "Já existe uma conta com este email" -- o usuário ficava preso. É o
    // mesmo motivo pelo qual `updateConsultaStatusAction` e
    // `assinarPlanoAction` também transacionam.
    profileId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(profiles)
        .values({ role: "paciente", nome, email, telefone, passwordHash })
        .returning({ id: profiles.id });
      const id = inserted[0]?.id;
      if (!id) {
        throw new Error("O insert em profiles não retornou o id.");
      }

      await tx.insert(pacientes).values({
        id,
        cpf,
        dataNascimento,
        idade,
        tipoSanguineo,
        altura: String(altura),
        genero,
        doencasCronicas: [],
      });
      return id;
    });

    await createSession(profileId);
  } catch (error) {
    if (profileId) return incompleteSignup(error, "signupPacienteAction");
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
    const existing = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);
    if (existing[0]) {
      return { success: false, error: "Já existe uma conta com este email." };
    }
    const existingCrm = await db
      .select({ id: medicos.id })
      .from(medicos)
      .where(eq(medicos.crm, crm))
      .limit(1);
    if (existingCrm[0]) {
      return { success: false, error: "Já existe um cadastro com este CRM." };
    }

    profileId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(profiles)
        .values({ role: "medico", nome, email, telefone, passwordHash })
        .returning({ id: profiles.id });
      const id = inserted[0]?.id;
      if (!id) {
        throw new Error("O insert em profiles não retornou o id.");
      }

      await tx.insert(medicos).values({
        id,
        crm,
        especialidade,
        formacao,
        genero,
      });
      return id;
    });

    await createSession(profileId);
  } catch (error) {
    if (profileId) return incompleteSignup(error, "signupMedicoAction");
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
