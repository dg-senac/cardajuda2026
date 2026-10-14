import "server-only";
import {
  dbDetailsEnabled,
  diagnoseDbError,
  formatDbDiagnosis,
} from "@/lib/db-diagnosis.mjs";
import type { DbDiagnosis } from "@/lib/db-diagnosis.d.mts";

/**
 * Tratamento de falha de banco compartilhado por todas as Server Actions.
 *
 * Por que existe: só `auth.ts` desembrulhava a causa real do erro. As outras
 * ações (consulta, triagem, medição, perfil, plano) faziam
 * `console.error("Erro ao ...", err)` e mostravam "Não foi possível salvar" --
 * com o SQL do Drizzle no log e o código do Postgres escondido em `error.cause`.
 * Aqui toda falha (1) cai numa regra do catálogo de diagnóstico, (2) é logada com
 * a causa raiz e (3) vira uma mensagem útil, incluindo as violações de
 * constraint que o app precisa distinguir.
 */

const UNIQUE_TARGETS: { pattern: RegExp; message: string }[] = [
  { pattern: /email/i, message: "Já existe uma conta com este email." },
  { pattern: /cpf/i, message: "Já existe um cadastro com este CPF." },
  { pattern: /crm/i, message: "Já existe um cadastro com este CRM." },
  {
    pattern: /dia_semana|refeicao/i,
    message: "Este dia/refeição já tem uma entrada no cardápio.",
  },
];

/** 23505 (unique violation) traduzido para o que o usuário deve ler. */
export function uniqueViolationMessage(diagnosis: DbDiagnosis): string | null {
  if (diagnosis.code !== "23505") return null;

  const alvo = `${diagnosis.constraint ?? ""} ${diagnosis.message} ${diagnosis.detail ?? ""}`;
  for (const candidate of UNIQUE_TARGETS) {
    if (candidate.pattern.test(alvo)) return candidate.message;
  }
  return "Já existe um cadastro com estes dados.";
}

/**
 * 23503 (foreign key) quase sempre significa o mesmo problema neste projeto:
 * a linha de `pacientes`/`medicos` não existe porque um cadastro anterior
 * gravou só o `profiles` (antes das transações serem obrigatórias aqui).
 */
function foreignKeyMessage(diagnosis: DbDiagnosis): string | null {
  if (diagnosis.code !== "23503") return null;
  return (
    "Falta um cadastro vinculado a esta conta (a linha do paciente ou do médico não existe no banco). " +
    "Isso acontece quando um cadastro antigo foi salvo pela metade. Rode `npm run db:check` -- ele lista as contas órfãs e como corrigir."
  );
}

/** Loga a causa raiz e devolve a mensagem curta para a tela. */
export function reportDbFailure(context: string, error: unknown, fallback: string): string {
  const diagnosis = diagnoseDbError(error);
  console.error(`[db] ${context} falhou\n${formatDbDiagnosis(diagnosis)}`);

  const friendly = uniqueViolationMessage(diagnosis) ?? foreignKeyMessage(diagnosis);
  if (friendly) return friendly;

  return dbDetailsEnabled()
    ? `${fallback} [${diagnosis.code ?? "sem código"}] ${diagnosis.message}`
    : fallback;
}

/**
 * Erro de validação (não é falha de banco): vai para a tela sem stack e sem
 * detalhe técnico -- é o "400" deste app.
 */
export class ValidationError extends Error {}

/** `throw new ValidationError("...")` dentro de uma transaction faz rollback e mostra a mensagem. */
export async function runDbAction(
  context: string,
  fallback: string,
  work: () => Promise<void>,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await work();
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: reportDbFailure(context, error, fallback) };
  }
  return { success: true };
}
