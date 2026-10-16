import { desc, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Fonte da verdade do schema.
 *
 * Os ÍNDICES abaixo existem porque o `supabase/schema.sql` também os cria. Sem
 * eles declarados aqui, um `npm run db:push` (ou `db:generate`) via a tabela
 * como "certa" e DERRUBA os 14 índices do banco -- o `drizzle-kit` remove tudo
 * que não está no schema TS. Foi exatamente o que este commit corrigiu; a
 * verificação fica em `scripts/db-schema-parity.test.mjs`.
 *
 * Regra: mudou aqui -> roda `npm run db:generate` e mantém o supabase/schema.sql
 * batendo (o `npm run db:check` confere os dois no banco real).
 */

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
  (table) => [
    check("profiles_role_check", sql`${table.role} in ('paciente','medico')`),
    // listPacientes() ordena por created_at desc; sem índice é um sort completo.
    index("profiles_created_at_idx").on(desc(table.createdAt)),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    // A limpeza de sessão expirada (src/lib/session.ts) filtra por expires_at.
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const pacientes = pgTable(
  "pacientes",
  {
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
  },
  (table) => [
    // numeric(5,2) estoura em 22003 se alguém mandar altura em centímetros
    // ("170" em vez de "1.70"). O app já valida antes; a constraint garante que
    // nenhum outro caminho (seed, SQL Editor, importação) grave valor absurdo.
    check("pacientes_altura_check", sql`${table.altura} between 0.30 and 2.80`),
    check("pacientes_idade_check", sql`${table.idade} between 0 and 130`),
  ],
);

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
    index("consultas_paciente_id_data_idx").on(table.pacienteId, desc(table.data), desc(table.createdAt)),
    index("consultas_medico_id_data_idx").on(table.medicoId, desc(table.data), desc(table.createdAt)),
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
    index("triagens_medico_id_data_idx").on(table.medicoId, desc(table.data), desc(table.createdAt)),
    index("triagens_paciente_id_idx").on(table.pacienteId),
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
    index("medicoes_paciente_id_created_idx").on(table.pacienteId, desc(table.createdAt)),
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
    index("alertas_created_idx").on(desc(table.createdAt)),
    index("alertas_paciente_id_idx").on(table.pacienteId),
  ],
);

export const pendencias = pgTable(
  "pendencias",
  {
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
  },
  (table) => [
    index("pendencias_medico_id_created_idx").on(table.medicoId, desc(table.createdAt)),
    index("pendencias_paciente_id_idx").on(table.pacienteId),
  ],
);

export const lembretes = pgTable(
  "lembretes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pacienteId: uuid("paciente_id")
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    texto: text("texto").notNull(),
    horario: text("horario").notNull(),
    ativo: boolean("ativo").notNull().default(true),
  },
  (table) => [index("lembretes_paciente_id_ativo_idx").on(table.pacienteId, table.ativo)],
);

export const cardapioSemanal = pgTable(
  "cardapio_semanal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    diaSemana: text("dia_semana").notNull(),
    refeicao: text("refeicao").notNull(),
    descricao: text("descricao").notNull(),
  },
  (table) => [
    index("cardapio_semanal_dia_semana_idx").on(table.diaSemana),
    // getCardapioDoDia() é chamado a cada load do início do paciente: sem índice
    // composto, a busca por dia + refeicao vira seq scan a cada visita.
    // uniqueIndex (e nao unique constraint): o drizzle-kit 0.31 nao reconhece
    // constraint composta multi-coluna no `push` e fica propondo recriar.
    uniqueIndex("cardapio_semanal_dia_refeicao_unique").on(table.diaSemana, table.refeicao),
  ],
);

export const planos = pgTable("planos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  descricao: text("descricao").notNull(),
  preco: numeric("preco", { precision: 10, scale: 2 }).notNull(),
});

export const assinaturas = pgTable(
  "assinaturas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pacienteId: uuid("paciente_id")
      .notNull()
      .references(() => pacientes.id, { onDelete: "cascade" }),
    planoId: uuid("plano_id")
      .notNull()
      .references(() => planos.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Sem CHECK, um 'ATIVO' (maiúsculo) gravado por qualquer caminho fica
    // invisível para getAssinaturaAtual(), que filtra por 'ativa'.
    check("assinaturas_status_check", sql`${table.status} in ('ativa','cancelada','pendente')`),
    index("assinaturas_paciente_id_status_idx").on(table.pacienteId, table.status),
    index("assinaturas_plano_id_idx").on(table.planoId),
  ],
);
