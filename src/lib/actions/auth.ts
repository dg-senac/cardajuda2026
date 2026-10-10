"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { medicos, pacientes, profiles } from "@/db/schema";
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

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");

  if (!email || !password) {
    return { success: false, error: "Preencha email e senha." };
  }

  const rows = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  const profile = rows[0];
  if (!profile) {
    return { success: false, error: "Email ou senha inválidos." };
  }

  const valid = await bcrypt.compare(password, profile.passwordHash);
  if (!valid) {
    return { success: false, error: "Email ou senha inválidos." };
  }

  await createSession(profile.id);
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

  const existing = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  if (existing[0]) {
    return { success: false, error: "Já existe uma conta com este email." };
  }
  const existingCpf = await db.select().from(pacientes).where(eq(pacientes.cpf, cpf)).limit(1);
  if (existingCpf[0]) {
    return { success: false, error: "Já existe um cadastro com este CPF." };
  }

  const passwordHash = await bcrypt.hash(senha, 10);

  try {
    const inserted = await db
      .insert(profiles)
      .values({ role: "paciente", nome, email, telefone, passwordHash })
      .returning({ id: profiles.id });
    const profileId = inserted[0].id;

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
  } catch (err) {
    console.error("Erro ao cadastrar paciente:", err);
    return { success: false, error: "Não foi possível concluir o cadastro. Tente novamente." };
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

  const existing = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  if (existing[0]) {
    return { success: false, error: "Já existe uma conta com este email." };
  }
  const existingCrm = await db.select().from(medicos).where(eq(medicos.crm, crm)).limit(1);
  if (existingCrm[0]) {
    return { success: false, error: "Já existe um cadastro com este CRM." };
  }

  const passwordHash = await bcrypt.hash(senha, 10);

  try {
    const inserted = await db
      .insert(profiles)
      .values({ role: "medico", nome, email, telefone, passwordHash })
      .returning({ id: profiles.id });
    const profileId = inserted[0].id;

    await db.insert(medicos).values({
      id: profileId,
      crm,
      especialidade,
      formacao,
      genero,
    });

    await createSession(profileId);
  } catch (err) {
    console.error("Erro ao cadastrar médico:", err);
    return { success: false, error: "Não foi possível concluir o cadastro. Tente novamente." };
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
