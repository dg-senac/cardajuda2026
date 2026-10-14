import { sql } from "drizzle-orm";
import { databaseTarget, db } from "@/db";
import {
  APP_TABLES,
  dbDetailsEnabled,
  diagnoseDbError,
  formatDbDiagnosis,
} from "@/lib/db-diagnosis.mjs";

export const dynamic = "force-dynamic";

/**
 * Health check do banco.
 *
 * Antes ele respondia só `{ ok: false }` (sem motivo) e considerava o banco
 * "ok" mesmo quando as tabelas não existiam -- exatamente o caso em que o
 * cadastro quebra com "Failed query: select ... from profiles". Agora:
 *
 *   1. tenta conectar;
 *   2. se conectar, confere se as 13 tabelas do app existem;
 *   3. devolve a causa real (código do Postgres + o que fazer).
 *
 * O detalhe técnico (host, banco, diagnóstico) só aparece fora de produção ou
 * com DB_DEBUG_ERRORS=1, para não expor a infraestrutura em produção.
 */
export async function GET() {
  const target = databaseTarget();
  const details = dbDetailsEnabled();

  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    const diagnosis = diagnoseDbError(error);
    console.error(`[health] banco inacessível\n${formatDbDiagnosis(diagnosis)}`);
    return Response.json(
      {
        ok: false,
        checkedAt: new Date().toISOString(),
        error: "sem conexão com o banco",
        ...(details
          ? {
              database: target,
              code: diagnosis.code,
              message: diagnosis.message,
              cause: diagnosis.summary,
              fix: diagnosis.hint,
              chain: diagnosis.chain,
            }
          : {}),
      },
      { status: 500 },
    );
  }

  let missingTables: string[] = [];
  let tablesChecked = true;
  try {
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const present = new Set(result.rows.map((row) => row.table_name));
    missingTables = APP_TABLES.filter((table) => !present.has(table));
  } catch (error) {
    tablesChecked = false;
    console.error(
      `[health] conectou, mas não conseguiu listar as tabelas\n${formatDbDiagnosis(diagnoseDbError(error))}`,
    );
  }

  if (missingTables.length > 0) {
    console.error(
      `[health] o banco responde, mas faltam ${missingTables.length} tabela(s): ${missingTables.join(", ")}. Rode "npm run db:setup".`,
    );
    return Response.json(
      {
        ok: false,
        checkedAt: new Date().toISOString(),
        error: "o banco responde, mas o schema do app não está aplicado",
        missingTables,
        fix: "Rode `npm run db:setup` (aplica supabase/schema.sql no banco da DATABASE_URL) ou cole o supabase/schema.sql no SQL Editor do Supabase.",
        ...(details ? { database: target, warnings: target.warnings } : {}),
      },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    tables: { expected: APP_TABLES.length, missing: [] as string[], checked: tablesChecked },
    ...(details
      ? { database: target, ...(target.warnings.length > 0 ? { warnings: target.warnings } : {}) }
      : {}),
  });
}
