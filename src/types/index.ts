export type UserRole = "paciente" | "medico";
export type StatusMedicao = "normal" | "atencao" | "alerta";
export type StatusConsulta = "agendada" | "realizada" | "cancelada";
export type ClassificacaoTriagem = "verde" | "amarela" | "vermelha";
export type StatusAlerta = "alerta" | "pendente" | "em_dia";

export interface Profile {
  id: string;
  role: UserRole;
  nome: string;
  email: string;
  telefone: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Paciente extends Profile {
  cpf: string;
  dataNascimento: string;
  idade: number;
  tipoSanguineo: string;
  altura: number;
  genero: string;
  doencasCronicas: string[];
  plano: string | null;
}

export interface Medico extends Profile {
  crm: string;
  especialidade: string;
  formacao: string;
  genero: string;
  avaliacao: number;
  consultasFeitas: number;
}

export interface Consulta {
  id: string;
  pacienteId: string;
  medicoId: string | null;
  nomePaciente: string;
  data: string;
  horario: string;
  profissional: string;
  especialidade: string;
  motivo: string;
  status: StatusConsulta;
  createdAt: string;
}

export interface Triagem {
  id: string;
  pacienteId: string;
  medicoId: string;
  nomePaciente: string;
  data: string;
  horario: string;
  profissional: string;
  queixaPrincipal: string;
  classificacao: ClassificacaoTriagem;
  createdAt: string;
}

export interface Medicao {
  id: string;
  pacienteId: string;
  sistolica: number;
  diastolica: number;
  glicemia: number;
  status: StatusMedicao;
  createdAt: string;
}

export interface Alerta {
  id: string;
  pacienteId: string;
  medicoId: string | null;
  tipo: string;
  titulo: string;
  descricao: string;
  status: StatusAlerta;
  createdAt: string;
}

export interface Pendencia {
  id: string;
  medicoId: string;
  pacienteId: string;
  titulo: string;
  concluida: boolean;
  createdAt: string;
}

export interface Lembrete {
  id: string;
  pacienteId: string;
  texto: string;
  horario: string;
  ativo: boolean;
}

export interface CardapioItem {
  id: string;
  diaSemana: string;
  refeicao: string;
  descricao: string;
}

export interface Plano {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
}

export interface Assinatura {
  id: string;
  pacienteId: string;
  planoId: string;
  status: string;
  createdAt: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}
