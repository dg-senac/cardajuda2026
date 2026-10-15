import { APP_TABLES } from "@/lib/db-diagnosis.mjs";
import { checkDatabase } from "@/lib/db-ready";

export const dynamic = "force-dynamic";

/**
 * Health check do banco.
 *
 * Responde o mesmo que a tela /diagnostico, em JSON -- útil para monitoramento,
 * para o script `npm run db:check` e para quem está descobrindo por que o login
 * não funciona. A checagem mora em src/lib/db-ready.ts (uma fonte só).
 *
 *   ok: true  -> conecta e as 13 tabelas existem
 *   ok: false -> inclui `error`, `missingTables` (quando for schema) e `fix`
 *
 * O detalhe técnico (host, cadeia de erros) só aparece fora de produção ou com
 * DB_DEBUG_ERRORS=1, para não expor a infraestrutura em produção.
 */
export async function GET() {
  const status = await checkDatabase(true);

  if (status.ok) {
    return Response.json({
      ok: true,
      checkedAt: status.checkedAt,
      tables: { expected: APP_TABLES.length, missing: [] as string[], checked: true },
      ...(status.detailsEnabled
        ? {
            database: status.target,
            ...(status.warnings.length > 0 ? { warnings: status.warnings } : {}),
          }
        : {}),
    });
  }

  console.error(`[health] banco não está pronto (${status.kind}): ${status.title}`);

  return Response.json(
    {
      ok: false,
      checkedAt: status.checkedAt,
      error: status.title,
      message: status.message,
      fix: status.hint,
      ...(status.missingTables.length > 0 ? { missingTables: status.missingTables } : {}),
      ...(status.detailsEnabled
        ? {
            database: status.target,
            code: status.code,
            chain: status.chain,
            warnings: status.warnings,
          }
        : {}),
    },
    { status: 500 },
  );
}
