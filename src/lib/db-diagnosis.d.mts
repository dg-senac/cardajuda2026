/**
 * Tipos do catálogo de diagnóstico de banco (`db-diagnosis.mjs`).
 *
 * O módulo é JavaScript puro para rodar sem build em Node (scripts
 * `npm run db:check` / `npm run db:setup`). Este arquivo dá os tipos ao app.
 */

export interface DatabaseTargetWarningsInput {
  url?: string;
}

export interface DatabaseTarget {
  /** true quando a URL pôde ser interpretada como URL. */
  parsed: boolean;
  /** true quando a variável existe (mesmo que malformada). */
  present: boolean;
  protocol?: string;
  user?: string;
  /** Nunca expõe a senha: só diz se ela foi informada. */
  passwordIsSet?: boolean;
  host?: string;
  port?: number;
  database?: string;
  sslmode?: string | null;
  isLocal?: boolean;
  isSupabasePooler?: boolean;
  isSupabaseDirect?: boolean;
  isSupabase?: boolean;
  /** URL com a senha trocada por ***. */
  redacted: string;
  /** Problemas detectados no formato da URL (senha não codificada, espaço, etc). */
  warnings: string[];
}

export interface DbRootCause {
  name: string;
  code: string | null;
  message: string;
  /** Nome do índice/constraint violado (ex.: pacientes_cpf_unique), quando houver. */
  constraint: string | null;
  /** Detalhe extra do Postgres (ex.: Key (email)=(x@y.com) already exists.). */
  detail: string | null;
  depth: number;
}

export interface DbDiagnosis {
  /** Código do Postgres (42P01, 28P01, ...) ou do Node (ENOTFOUND, ...). */
  code: string | null;
  name: string;
  /** Mensagem crua da causa raiz (sem o SQL do Drizzle). */
  message: string;
  /** Índice/constraint violado, quando houver (ex.: profiles_email_unique). */
  constraint: string | null;
  /** Detalhe extra do Postgres, quando houver. */
  detail: string | null;
  /** O que aconteceu, em português. */
  summary: string;
  /** O que fazer para resolver. */
  hint: string;
  /** Cadeia de erros do Drizzle até a causa raiz. */
  chain: string[];
}

export const APP_TABLES: readonly string[];
export const AUTH_TABLES: readonly string[];

export function getDbRootCause(error: unknown): DbRootCause | null;
export function getDbErrorChain(error: unknown): string[];
export function describeDatabaseTarget(rawUrl?: string | null): DatabaseTarget;
export function diagnoseDbError(error: unknown): DbDiagnosis;
export function formatDbDiagnosis(diagnosis: DbDiagnosis): string;
export function userFacingDbMessage(
  purpose: "cadastro" | "login",
  diagnosis: DbDiagnosis,
  showDetails: boolean,
): string;
export function dbDetailsEnabled(env?: NodeJS.ProcessEnv): boolean;
