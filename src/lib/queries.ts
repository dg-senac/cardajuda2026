import "server-only";
import { requireDoctor, requirePatientAccess } from "@/lib/access";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  alertas,
  assinaturas,
  cardapioSemanal,
  consultas,
  lembretes,
  medicoes,
  medicos,
  pacientes,
  pendencias,
  planos,
  profiles,
  triagens,
} from "@/db/schema";
import { toMedico, toPaciente } from "@/lib/mappers";
import type {
  Alerta,
  Assinatura,
  CardapioItem,
  Consulta,
  Lembrete,
  Medicao,
  Medico,
  Paciente,
  Pendencia,
  Plano,
  Triagem,
} from "@/types";

const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export function getDiaSemanaAtual(): string {
  return DIAS_SEMANA[new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay()];
}

export async function getPacienteById(id: string): Promise<Paciente | null> {
  await requirePatientAccess(id);
  const rows = await db
    .select()
    .from(pacientes)
    .innerJoin(profiles, eq(pacientes.id, profiles.id))
    .where(eq(pacientes.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return toPaciente(row.profiles, row.pacientes);
}

export async function getMedicoById(id: string): Promise<Medico | null> {
  const rows = await db
    .select()
    .from(medicos)
    .innerJoin(profiles, eq(medicos.id, profiles.id))
    .where(eq(medicos.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return toMedico(row.profiles, row.medicos);
}

export async function listMedicos(): Promise<Medico[]> {
  const rows = await db
    .select()
    .from(medicos)
    .innerJoin(profiles, eq(medicos.id, profiles.id))
    .where(sql`exists (select 1 from mobile_private.approved_doctors a where a.medico_id = ${medicos.id})`)
    .orderBy(profiles.nome);
  return rows.map((row) => toMedico(row.profiles, row.medicos));
}

/**
 * Prepara o termo para dentro de um LIKE/ILIKE.
 *
 * Sem isto, um "%" ou "_" digitado na busca vira curinga do padrão: procurar por
 * "100%" achava qualquer CPF terminando em 100, e o "%" sozinho devolvia a lista
 * inteira. O `\\` é escapado junto para o usuário poder procurar por backslash.
 */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export async function listPacientes(search?: string): Promise<Paciente[]> {
  const doctor = await requireDoctor();
  const linked = sql`exists (select 1 from consultas c where c.paciente_id = ${pacientes.id} and c.medico_id = ${doctor.id}::uuid)`;
  const base = db
    .select()
    .from(pacientes)
    .innerJoin(profiles, eq(pacientes.id, profiles.id));

  // ORDER BY nos dois ramos: sem ele a busca voltava em ordem arbitrária (e
  // mudando a cada página), porque o Postgres não garante ordem sem ORDER BY.
  const rows = search
    ? await base
        .where(and(linked, or(ilike(profiles.nome, likePattern(search)), ilike(pacientes.cpf, likePattern(search)))))
        .orderBy(desc(profiles.createdAt), profiles.nome)
    : await base.where(linked).orderBy(desc(profiles.createdAt));

  return rows.map((row) => toPaciente(row.profiles, row.pacientes));
}

function mapConsulta(row: typeof consultas.$inferSelect): Consulta {
  return {
    id: row.id,
    pacienteId: row.pacienteId,
    medicoId: row.medicoId,
    nomePaciente: row.nomePaciente,
    data: row.data,
    horario: row.horario,
    profissional: row.profissional,
    especialidade: row.especialidade,
    motivo: row.motivo,
    status: row.status as Consulta["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listConsultasByPaciente(pacienteId: string): Promise<Consulta[]> {
  await requirePatientAccess(pacienteId);
  const rows = await db
    .select()
    .from(consultas)
    .where(eq(consultas.pacienteId, pacienteId))
    .orderBy(desc(consultas.data), desc(consultas.createdAt));
  return rows.map(mapConsulta);
}

export async function listTodasConsultas(): Promise<Consulta[]> {
  const doctor = await requireDoctor();
  const rows = await db.select().from(consultas).where(eq(consultas.medicoId, doctor.id)).orderBy(desc(consultas.data), desc(consultas.createdAt));
  return rows.map(mapConsulta);
}

function mapTriagem(row: typeof triagens.$inferSelect): Triagem {
  return {
    id: row.id,
    pacienteId: row.pacienteId,
    medicoId: row.medicoId,
    nomePaciente: row.nomePaciente,
    data: row.data,
    horario: row.horario,
    profissional: row.profissional,
    queixaPrincipal: row.queixaPrincipal,
    classificacao: row.classificacao as Triagem["classificacao"],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTodasTriagens(): Promise<Triagem[]> {
  const doctor = await requireDoctor();
  const rows = await db.select().from(triagens).where(eq(triagens.medicoId, doctor.id)).orderBy(desc(triagens.data), desc(triagens.createdAt));
  return rows.map(mapTriagem);
}

export async function listTriagensByMedico(medicoId: string): Promise<Triagem[]> {
  await requireDoctor(medicoId);
  const rows = await db
    .select()
    .from(triagens)
    .where(eq(triagens.medicoId, medicoId))
    .orderBy(desc(triagens.data), desc(triagens.createdAt));
  return rows.map(mapTriagem);
}

export async function listConsultasByMedico(medicoId: string): Promise<Consulta[]> {
  await requireDoctor(medicoId);
  const rows = await db
    .select()
    .from(consultas)
    .where(eq(consultas.medicoId, medicoId))
    .orderBy(desc(consultas.data), desc(consultas.createdAt));
  return rows.map(mapConsulta);
}

function mapMedicao(row: typeof medicoes.$inferSelect): Medicao {
  return {
    id: row.id,
    pacienteId: row.pacienteId,
    sistolica: row.sistolica,
    diastolica: row.diastolica,
    glicemia: row.glicemia,
    status: row.status as Medicao["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Última medição de CADA paciente numa query só.
 *
 * A tela /medico/pacientes fazia `listMedicoesByPaciente(id, 1)` dentro de um
 * `Promise.all` por paciente: 1 + N ida ao banco (com N=300 pacientes eram 301
 * queries, cada uma pagando latência de pooler -- na prática, a tela demorando
 * segundos). `distinct on` é a forma nativa do Postgres de dizer "a linha mais
 * recente por grupo"; o índice medicoes_paciente_id_created_idx atende exatamente
 * essa ordem, então o plano é um index scan por paciente, sem sort.
 */
export async function getUltimasMedicoesPorPaciente(
  pacienteIds: string[],
): Promise<Map<string, Medicao>> {
  await Promise.all(pacienteIds.map(requirePatientAccess));
  if (pacienteIds.length === 0) return new Map();

  const rows = await db
    .selectDistinctOn([medicoes.pacienteId], { medicao: medicoes })
    .from(medicoes)
    .where(inArray(medicoes.pacienteId, pacienteIds))
    .orderBy(medicoes.pacienteId, desc(medicoes.createdAt));

  return new Map(rows.map((row) => [row.medicao.pacienteId, mapMedicao(row.medicao)]));
}

/** Pacientes + última medição de cada um, em 2 queries (era 1 + N). */
export async function listPacientesComUltimaMedicao(search?: string): Promise<
  {
    id: string;
    nome: string;
    idade: number;
    genero: string;
    ultima: Medicao | null;
  }[]
> {
  const pacientesList = await listPacientes(search);
  const ultimas = await getUltimasMedicoesPorPaciente(pacientesList.map((p) => p.id));

  return pacientesList.map((paciente) => ({
    id: paciente.id,
    nome: paciente.nome,
    idade: paciente.idade,
    genero: paciente.genero,
    ultima: ultimas.get(paciente.id) ?? null,
  }));
}

export async function listMedicoesByPaciente(pacienteId: string, limit = 10, offset = 0): Promise<Medicao[]> {
  await requirePatientAccess(pacienteId);
  const rows = await db
    .select()
    .from(medicoes)
    .where(eq(medicoes.pacienteId, pacienteId))
    .orderBy(desc(medicoes.createdAt))
    .limit(Math.min(100, Math.max(1, limit)))
    .offset(offset);
  return rows.map(mapMedicao);
}

export async function getUltimaMedicao(pacienteId: string): Promise<Medicao | null> {
  const rows = await listMedicoesByPaciente(pacienteId, 1);
  return rows[0] ?? null;
}

function mapAlerta(row: typeof alertas.$inferSelect): Alerta {
  return {
    id: row.id,
    pacienteId: row.pacienteId,
    medicoId: row.medicoId,
    tipo: row.tipo,
    titulo: row.titulo,
    descricao: row.descricao,
    status: row.status as Alerta["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAlertas(): Promise<Alerta[]> {
  const doctor = await requireDoctor();
  const rows = await db.select().from(alertas).where(or(eq(alertas.medicoId, doctor.id), sql`(${alertas.medicoId} is null and exists (select 1 from consultas c where c.paciente_id = ${alertas.pacienteId} and c.medico_id = ${doctor.id}::uuid))`)).orderBy(desc(alertas.createdAt));
  return rows.map(mapAlerta);
}

function mapPendencia(row: typeof pendencias.$inferSelect): Pendencia {
  return {
    id: row.id,
    medicoId: row.medicoId,
    pacienteId: row.pacienteId,
    titulo: row.titulo,
    concluida: row.concluida,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPendenciasByMedico(medicoId: string): Promise<Pendencia[]> {
  await requireDoctor(medicoId);
  const rows = await db
    .select()
    .from(pendencias)
    .where(eq(pendencias.medicoId, medicoId))
    .orderBy(desc(pendencias.createdAt));
  return rows.map(mapPendencia);
}

/**
 * Pendências do médico já com o nome do paciente (o JOIN economiza um select por
 * linha -- a tela de alertas fazia getPacienteById() para cada pendência).
 */
export async function listPendenciasComPaciente(medicoId: string): Promise<
  (Pendencia & { pacienteNome: string })[]
> {
  await requireDoctor(medicoId);
  const rows = await db
    .select({ pendencia: pendencias, pacienteNome: profiles.nome })
    .from(pendencias)
    .innerJoin(profiles, eq(pendencias.pacienteId, profiles.id))
    .where(eq(pendencias.medicoId, medicoId))
    .orderBy(desc(pendencias.createdAt));

  return rows.map((row) => ({ ...mapPendencia(row.pendencia), pacienteNome: row.pacienteNome }));
}

export async function listLembretesByPaciente(pacienteId: string): Promise<Lembrete[]> {
  await requirePatientAccess(pacienteId);
  const rows = await db
    .select()
    .from(lembretes)
    .where(and(eq(lembretes.pacienteId, pacienteId), eq(lembretes.ativo, true)));
  return rows.map((row) => ({
    id: row.id,
    pacienteId: row.pacienteId,
    texto: row.texto,
    horario: row.horario,
    ativo: row.ativo,
  }));
}

export async function getCardapioDoDia(diaSemana: string): Promise<CardapioItem[]> {
  const rows = await db.select().from(cardapioSemanal).where(eq(cardapioSemanal.diaSemana, diaSemana));
  return rows.map((row) => ({
    id: row.id,
    diaSemana: row.diaSemana,
    refeicao: row.refeicao,
    descricao: row.descricao,
  }));
}

export async function listPlanos(): Promise<Plano[]> {
  const rows = await db.select().from(planos);
  return rows.map((row) => ({
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    preco: Number(row.preco),
  }));
}

export async function getAssinaturaAtual(pacienteId: string): Promise<(Assinatura & { planoNome?: string }) | null> {
  await requirePatientAccess(pacienteId);
  const rows = await db
    .select()
    .from(assinaturas)
    .innerJoin(planos, eq(assinaturas.planoId, planos.id))
    .where(and(eq(assinaturas.pacienteId, pacienteId), eq(assinaturas.status, "ativa")))
    .orderBy(desc(assinaturas.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.assinaturas.id,
    pacienteId: row.assinaturas.pacienteId,
    planoId: row.assinaturas.planoId,
    status: row.assinaturas.status,
    createdAt: row.assinaturas.createdAt.toISOString(),
    planoNome: row.planos.nome,
  };
}
