import type { StatusMedicao } from "@/types";

export function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i], 10) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(clean[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i], 10) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(clean[10], 10)) return false;

  return true;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, "");
  return clean.length === 10 || clean.length === 11;
}

export function classifyPressure(
  sistolica: number,
  diastolica: number,
): StatusMedicao {
  if (sistolica >= 140 || diastolica >= 90) return "alerta";
  if (sistolica >= 130 || diastolica >= 85) return "atencao";
  return "normal";
}

export function classifyGlucose(glicemia: number): StatusMedicao {
  if (glicemia < 70) return "alerta";
  if (glicemia >= 126) return "alerta";
  if (glicemia >= 100) return "atencao";
  return "normal";
}

export function getMeasurementStatus(
  sistolica: number,
  diastolica: number,
  glicemia: number,
): StatusMedicao {
  const pressao = classifyPressure(sistolica, diastolica);
  const glicose = classifyGlucose(glicemia);
  if (pressao === "alerta" || glicose === "alerta") return "alerta";
  if (pressao === "atencao" || glicose === "atencao") return "atencao";
  return "normal";
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function calculateAge(birthDate: string | Date): number {
  const d = typeof birthDate === "string" ? new Date(`${birthDate}T00:00:00`) : birthDate;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age;
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hoje às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ontem";
  return `há ${diffDays} dias`;
}
