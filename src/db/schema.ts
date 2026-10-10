import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// profiles acts as the auth + profile table (no separate Supabase auth here).
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: text("role").notNull(),
    nome: text("nome").notNull(),
    email: text("email").notNull().unique(),
    telefone: text("telefone").notNull(),
    passwordHash: text("password_hash").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("profiles_role_check", sql`${table.role} in ('paciente','medico')`)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pacientes = pgTable("pacientes", {
  id: uuid("id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  cpf: text("cpf").notNull().unique(),
  dataNascimento: date("data_nascimento").notNull(),
  idade: integer("idade").notNull(),
  tipoSanguineo: text("tipo_sanguineo").notNull(),
  altura: numeric("altura", { precision: 5, scale: 2 }).notNull(),
  genero: text("genero").notNull(),
  doencasCronicas: text("doencas_cronicas").array().notNull().default(sql`'{}'::text[]`),
  plano: text("plano"),
});

export const medicos = pgTable("medicos", {
  id: uuid("id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  crm: text("crm").notNull().unique(),
  especialidade: text("especialidade").notNull(),
  formacao: text("formacao").notNull(),
  genero: text("genero").notNull(),
  avaliacao: numeric("avaliacao", { precision: 2, scale: 1 }).notNull().default("0.0"),
  consultasFeitas: integer("consultas_feitas").notNull().default(0),
});

export const consultas = pgTable(
  "consultas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pacienteId: uuid("paciente_id")
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    medicoId: uuid("medico_id").references(() => medicos.id, { onDelete: "set null" }),
    nomePaciente: text("nome_paciente").notNull(),
    data: date("data").notNull(),
    horario: text("horario").notNull(),
    profissional: text("profissional").notNull(),
    especialidade: text("especialidade").notNull(),
    motivo: text("motivo").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("consultas_status_check", sql`${table.status} in ('agendada','realizada','cancelada')`),
  ],
);

export const triagens = pgTable(
  "triagens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pacienteId: uuid("paciente_id")
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    medicoId: uuid("medico_id")
      .notNull()
      .references(() => medicos.id, { onDelete: "cascade" }),
    nomePaciente: text("nome_paciente").notNull(),
    data: date("data").notNull(),
    horario: text("horario").notNull(),
    profissional: text("profissional").notNull(),
    queixaPrincipal: text("queixa_principal").notNull(),
    classificacao: text("classificacao").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "triagens_classificacao_check",
      sql`${table.classificacao} in ('verde','amarela','vermelha')`,
    ),
  ],
);

export const medicoes = pgTable(
  "medicoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pacienteId: uuid("paciente_id")
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    sistolica: integer("sistolica").notNull(),
    diastolica: integer("diastolica").notNull(),
    glicemia: integer("glicemia").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("medicoes_status_check", sql`${table.status} in ('normal','atencao','alerta')`),
  ],
);

export const alertas = pgTable(
  "alertas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pacienteId: uuid("paciente_id")
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    medicoId: uuid("medico_id").references(() => medicos.id, { onDelete: "set null" }),
    tipo: text("tipo").notNull(),
    titulo: text("titulo").notNull(),
    descricao: text("descricao").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("alertas_status_check", sql`${table.status} in ('alerta','pendente','em_dia')`),
  ],
);

export const pendencias = pgTable("pendencias", {
  id: uuid("id").primaryKey().defaultRandom(),
  medicoId: uuid("medico_id")
    .notNull()
    .references(() => medicos.id, { onDelete: "cascade" }),
  pacienteId: uuid("paciente_id")
    .notNull()
    .references(() => pacientes.id, { onDelete: "cascade" }),
  titulo: text("titulo").notNull(),
  concluida: boolean("concluida").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lembretes = pgTable("lembretes", {
  id: uuid("id").primaryKey().defaultRandom(),
  pacienteId: uuid("paciente_id")
    .notNull()
    .references(() => pacientes.id, { onDelete: "cascade" }),
  texto: text("texto").notNull(),
  horario: text("horario").notNull(),
  ativo: boolean("ativo").notNull().default(true),
});

export const cardapioSemanal = pgTable("cardapio_semanal", {
  id: uuid("id").primaryKey().defaultRandom(),
  diaSemana: text("dia_semana").notNull(),
  refeicao: text("refeicao").notNull(),
  descricao: text("descricao").notNull(),
});

export const planos = pgTable("planos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  descricao: text("descricao").notNull(),
  preco: numeric("preco", { precision: 10, scale: 2 }).notNull(),
});

export const assinaturas = pgTable("assinaturas", {
  id: uuid("id").primaryKey().defaultRandom(),
  pacienteId: uuid("paciente_id")
    .notNull()
    .references(() => pacientes.id, { onDelete: "cascade" }),
  planoId: uuid("plano_id")
    .notNull()
    .references(() => planos.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
