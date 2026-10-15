import "server-only";
import { getTableColumns, getTableName, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, databaseTarget } from "@/db";
import * as schema from "@/db/schema";
import { APP_TABLES, dbDetailsEnabled, diagnoseDbError } from "@/lib/db-diagnosis.mjs";
import type { DatabaseTarget } from "@/lib/db-diagnosis.d.mts";

/**
 * "O banco está pronto para o app funcionar?" -- em uma pergunta só.
 *
 * Por que existe: login e cadastro quebravam em três cenários diferentes que a
 * pessoa via como "o app deu erro":
 *
 *   1. a DATABASE_URL não chegou ao servidor (falta no .env.local / no painel do host);
 *   2. ela existe, mas o banco não responde (senha, DNS, IPv6, projeto pausado, TLS);
 *   3. ela conecta, mas o banco está SEM as 13 tabelas do app -- o caso de quem
 *      "tem o Supabase esperando para linkar": sem `supabase/schema.sql` aplicado,
 *      todo login responde `relation "profiles" does not exist`.
 *
 * Antes disso, o cenário 1 derrubava o import de `@/db` e a página de login
 * inteira virava erro 500; o 3 só aparecia depois do formulário enviado. Aqui a
 * checagem é feita ANTES de renderizar login/cadastro (e na página /diagnostico),
 * devolve uma mensagem acionável e nunca lança.
 *
 * O resultado é cacheado: sucesso por 60s (o caminho feliz não paga duas queries
 * por visita) e falha por 15s (para quem acabou de rodar `npm run db:setup` ver o
 * resultado rápido). Chamadas simultâneas compartilham a mesma promise.
 */

export type DbProblemKind = "config" | "conexao" | "schema";

/** Tabela que existe no banco, mas sem alguma coluna que o app usa. */
export interface ColunaFaltando {
  table: string;
  missing: string[];
}

export interface DbStatus {
  ok: boolean;
  kind: DbProblemKind | null;
  /** Título curto para a tela. */
  title: string;
  /** O que aconteceu, em português. */
  message: string;
  /** O que fazer para resolver (comandos, links). */
  hint: string;
  code: string | null;
  chain: string[];
  warnings: string[];
  target: DatabaseTarget;
  /** Tabelas do app que NÃO existem no banco (vazio quando está tudo certo). */
  missingTables: string[];
  /**
   * Colunas que o app usa e não existem no banco. Acontece com banco criado por
   * uma versão antiga do projeto: `create table if not exists` (schema.sql) não
   * altera tabela que já existe, então a tabela está lá, mas incompleta.
   */
  columnDrift: ColunaFaltando[];
  /** Host:porta/banco, sem usuário e sem senha -- para achar o alvo errado rápido. */
  targetSummary: string;
  checkedAt: string;
  /** Detalhe técnico (cadeia de erros, SQLSTATE) -- só fora de produção. */
  detailsEnabled: boolean;
}

const APP_TABLE_SET = new Set(APP_TABLES);

/**
 * As 13 tabelas do app, na forma que o Drizzle entende.
 *
 * A lista é escrita à mão de propósito: `Object.values(schema)` traria também
 * qualquer coisa que o módulo exporte no futuro, e `getTableColumns()` de um
 * objeto que não é tabela estoura. A conferência abaixo garante que esta lista
 * não sai de sincronia com `APP_TABLES` (a que o schema.sql/seed usa).
 */
const TABELAS_DO_APP: Record<string, PgTable> = {
  profiles: schema.profiles,
  pacientes: schema.pacientes,
  medicos: schema.medicos,
  sessions: schema.sessions,
  consultas: schema.consultas,
  triagens: schema.triagens,
  medicoes: schema.medicoes,
  alertas: schema.alertas,
  pendencias: schema.pendencias,
  lembretes: schema.lembretes,
  cardapio_semanal: schema.cardapioSemanal,
  planos: schema.planos,
  assinaturas: schema.assinaturas,
};

if (Object.keys(TABELAS_DO_APP).length !== APP_TABLES.length) {
  // Falha alto e cedo: adicionou tabela em src/db/schema.ts? Atualize aqui e no
  // APP_TABLES de src/lib/db-diagnosis.mjs.
  console.error(
    `[db] TABELAS_DO_APP tem ${Object.keys(TABELAS_DO_APP).length} tabelas, mas APP_TABLES tem ${APP_TABLES.length}.`,
  );
}

/** `host:porta/banco` -- nunca inclui usuário nem senha. */
export function targetSummary(target: DatabaseTarget): string {
  if (!target.parsed) return target.redacted;
  return `${target.host ?? "?"}:${target.port ?? 5432}/${target.database ?? "?"}`;
}

export const SETUP_COMMANDS = [
  "npm run db:check   # diz exatamente o que está faltando",
  "npm run db:setup   # cria as 13 tabelas no banco da DATABASE_URL",
  "npm run db:seed    # opcional: contas de demonstração (senha 123456)",
].join("\n");

const CACHE_OK_MS = 60_000;
const CACHE_ERRO_MS = 15_000;

let cache: { status: DbStatus; at: number } | null = null;
let inFlight: Promise<DbStatus> | null = null;

function baseStatus(target: DatabaseTarget): Omit<DbStatus, "ok" | "kind" | "title" | "message" | "hint"> {
  return {
    code: null,
    chain: [],
    warnings: target.warnings,
    target,
    missingTables: [],
    columnDrift: [],
    targetSummary: targetSummary(target),
    checkedAt: new Date().toISOString(),
    detailsEnabled: dbDetailsEnabled(),
  };
}

/**
 * Nunca lança: qualquer falha vira um DbStatus com o motivo e o que fazer.
 *
 * @param force ignora o cache (usado pelo /api/health e pela página /diagnostico)
 */
export async function checkDatabase(force = false): Promise<DbStatus> {
  const now = Date.now();
  if (!force && cache) {
    const ttl = cache.status.ok ? CACHE_OK_MS : CACHE_ERRO_MS;
    if (now - cache.at < ttl) return cache.status;
  }
  if (inFlight) return inFlight;

  inFlight = run().finally(() => {
    inFlight = null;
  });
  const status = await inFlight;
  cache = { status, at: Date.now() };
  return status;
}

/** Limpa o cache (útil nos testes e no botão "verificar de novo"). */
export function clearDatabaseStatusCache(): void {
  cache = null;
}

async function run(): Promise<DbStatus> {
  const target = databaseTarget();

  // ---------------------------------------------------------------- 1. config
  if (!target.present) {
    return {
      ok: false,
      kind: "config",
      title: "Banco de dados não configurado",
      message:
        "A variável DATABASE_URL não chegou ao servidor que está rodando este app. Sem ela não existe login nem cadastro: não há onde guardar as contas.",
      hint: [
        "No seu computador: crie o arquivo .env.local na raiz do projeto com a connection string do Supabase e reinicie o `npm run dev`.",
        "No servidor (Vercel/Render/Railway): cadastre DATABASE_URL nas variáveis de ambiente e faça um novo deploy.",
      ].join("\n"),
      ...baseStatus(target),
    };
  }

  if (!target.parsed || !(target.host || "").length) {
    return {
      ok: false,
      kind: "config",
      title: "DATABASE_URL inválida",
      message: "A variável existe, mas não é uma URL de Postgres que o driver consiga usar.",
      hint: [
        "O valor precisa começar com postgresql:// e seguir o formato:",
        "  postgresql://usuario:senha@host:5432/postgres?sslmode=require",
        "Se a senha tem @ # / : ? &, codifique o caractere (%40 %23 %2F %3A %3F %26).",
        "Rode `npm run db:check` para ver o que o app está lendo (a senha nunca é exibida).",
      ].join("\n"),
      ...baseStatus(target),
    };
  }

  // ------------------------------------------------------------- 2. conexão
  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    const diagnosis = diagnoseDbError(error);
    return {
      ok: false,
      kind: "conexao",
      title: "Não foi possível conectar ao banco de dados",
      message: diagnosis.summary,
      hint: diagnosis.hint,
      ...baseStatus(target),
      code: diagnosis.code,
      chain: diagnosis.chain,
    };
  }

  // -------------------------------------------------------------- 3. schema
  let missingTables: string[] = [];
  const columnDrift: ColunaFaltando[] = [];
  try {
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const present = new Set(result.rows.map((row) => row.table_name));
    // Só consideramos "faltando" o que é tabela do app: um banco com tabelas
    // extras (auth.users, storage...) não é problema.
    missingTables = [...APP_TABLE_SET].filter((table) => !present.has(table));
  } catch (error) {
    const diagnosis = diagnoseDbError(error);
    return {
      ok: false,
      kind: "conexao",
      title: "O banco respondeu, mas não consegui listar as tabelas",
      message: diagnosis.summary,
      hint: diagnosis.hint,
      ...baseStatus(target),
      code: diagnosis.code,
      chain: diagnosis.chain,
    };
  }

  // Colunas esperadas: vêm do PRÓPRIO src/db/schema.ts (getTableColumns), então
  // não existe uma segunda lista para manter em sincronia.
  if (missingTables.length === 0) {
    try {
      const colunas = await db.execute<{ table_name: string; column_name: string }>(
        sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`,
      );
      const porTabela = new Map<string, Set<string>>();
      for (const linha of colunas.rows) {
        if (!porTabela.has(linha.table_name)) porTabela.set(linha.table_name, new Set());
        porTabela.get(linha.table_name)!.add(linha.column_name);
      }

      for (const tabela of Object.values(TABELAS_DO_APP)) {
        const nome = getTableName(tabela);
        const esperadas = Object.values(getTableColumns(tabela)).map((coluna) => coluna.name);
        const existentes = porTabela.get(nome);
        if (!existentes) continue; // tabela ausente já foi tratada acima
        const faltando = esperadas.filter((coluna) => !existentes.has(coluna));
        if (faltando.length > 0) columnDrift.push({ table: nome, missing: faltando });
      }
    } catch (error) {
      // Não é motivo para dizer que o banco está quebrado: a checagem de
      // existência das tabelas (acima) é a que decide.
      console.error("[db] não consegui conferir as colunas:", error);
    }
  }

  if (columnDrift.length > 0) {
    return {
      ok: false,
      kind: "schema",
      title: "As tabelas existem, mas o banco está numa versão antiga do schema",
      message: `Faltam colunas que o app usa: ${columnDrift
        .map((item) => `${item.table}(${item.missing.join(", ")})`)
        .join("; ")}. O cadastro e as listagens que tocam essas tabelas falham.`,
      hint: [
        "`schema.sql` usa create table if not exists: ele NÃO altera tabela que já existe.",
        "1) Rode `npm run db:check` para ver a lista completa (colunas, índices e constraints que faltam).",
        "2) No SQL Editor do Supabase, acrescente as colunas nas tabelas indicadas (ALTER TABLE ... ADD COLUMN ...).",
        "3) Se o banco não tem dados para preservar, supabase/reset.sql + schema.sql recriam tudo do zero",
        "   (ATENÇÃO: o reset apaga as 13 tabelas -- leia o cabeçalho do arquivo antes).",
      ].join("\n"),
      ...baseStatus(target),
      columnDrift,
    };
  }

  if (missingTables.length > 0) {
    return {
      ok: false,
      kind: "schema",
      title: "O schema do app ainda não foi aplicado neste banco",
      message: `O banco conectou, mas ${missingTables.length} das ${APP_TABLES.length} tabelas do app não existem${
        missingTables.length <= 6 ? `: ${missingTables.join(", ")}` : ""
      }. Todas as ações que gravam ou leem dados (login, cadastro, consultas) falham enquanto isso.`,
      hint: [
        "Escolha UMA das opções:",
        "1) No seu computador, com a mesma DATABASE_URL do app:",
        ...SETUP_COMMANDS.split("\n").map((linha) => `   ${linha}`),
        "2) Pelo painel do Supabase: SQL Editor -> New query -> cole o conteúdo de supabase/schema.sql -> Run.",
        "Depois volte ao login e recarregue a página.",
      ].join("\n"),
      ...baseStatus(target),
      missingTables,
    };
  }

  return {
    ok: true,
    kind: null,
    title: "Banco de dados conectado",
    message: `Conexão ok e as ${APP_TABLES.length} tabelas do app existem neste banco.`,
    hint: "",
    ...baseStatus(target),
  };
}
