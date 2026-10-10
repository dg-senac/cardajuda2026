import type { profiles, medicos, pacientes } from "@/db/schema";
import type { Medico, Paciente, Profile } from "@/types";

type ProfileRow = typeof profiles.$inferSelect;
type PacienteRow = typeof pacientes.$inferSelect;
type MedicoRow = typeof medicos.$inferSelect;

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    role: row.role as Profile["role"],
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPaciente(profileRow: ProfileRow, pacienteRow: PacienteRow): Paciente {
  return {
    ...toProfile(profileRow),
    cpf: pacienteRow.cpf,
    dataNascimento: pacienteRow.dataNascimento,
    idade: pacienteRow.idade,
    tipoSanguineo: pacienteRow.tipoSanguineo,
    altura: Number(pacienteRow.altura),
    genero: pacienteRow.genero,
    doencasCronicas: pacienteRow.doencasCronicas ?? [],
    plano: pacienteRow.plano,
  };
}

export function toMedico(profileRow: ProfileRow, medicoRow: MedicoRow): Medico {
  return {
    ...toProfile(profileRow),
    crm: medicoRow.crm,
    especialidade: medicoRow.especialidade,
    formacao: medicoRow.formacao,
    genero: medicoRow.genero,
    avaliacao: Number(medicoRow.avaliacao),
    consultasFeitas: medicoRow.consultasFeitas,
  };
}
