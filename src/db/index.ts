import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { describeDatabaseTarget } from "@/lib/db-diagnosis.mjs";
import type { DatabaseTarget } from "@/lib/db-diagnosis.d.mts";

const rawDatabaseUrl = process.env.DATABASE_URL;

if (!rawDatabaseUrl) {
  throw new Error(
    [
      "DATABASE_URL não está definida.",
      "Crie o arquivo .env.local na raiz do projeto (ele não vai para o git) com:",
      "  DATABASE_URL=postgresql://usuario:senha@host:5432/postgres?sslmode=require",
      "Em produção (Vercel, Render, GitHub Actions...) cadastre a mesma variável no painel do provedor.",
      "Para descobrir o que está faltando, rode: npm run db:check",
    ].join("\n"),
  );
}

// Espaço/quebra de linha sobrando no fim do valor no .env muda o nome do banco
// ("postgres " != "postgres") e derruba a conexão com um erro que não aponta
// para o .env. O trim elimina essa classe de erro.
const databaseUrl = rawDatabaseUrl.trim();

if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  throw new Error(
    [
      `DATABASE_URL inválida: precisa começar com "postgresql://" (recebido: "${describeDatabaseTarget(databaseUrl).redacted}").`,
      "Sem o prefixo, o driver assume host/porta padrão e o erro aparece como ENOTFOUND/ECONNREFUSED sem relação com o banco real.",
      "Rode npm run db:check para ver o que está sendo lido.",
    ].join("\n"),
  );
}

const connectionTimeoutMs = Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15_000);

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlPoolErrorHandler?: boolean;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    // Sem isto, um pooler/projeto pausado deixa a requisição pendurada para
    // sempre (a tela fica só com o "carregando"). Com o limite, o erro aparece.
    connectionTimeoutMillis: Number.isFinite(connectionTimeoutMs) ? connectionTimeoutMs : 15_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });

// Um cliente ocioso que morre (pooler derrubando conexão, rede caindo) emite
// 'error' no pool. Sem listener, o Node derruba o processo inteiro.
if (!globalForDb.__arenaNextJsPostgresqlPoolErrorHandler) {
  pool.on("error", (error) => {
    console.error("[db] conexão ociosa do pool caiu:", error.message);
  });
  globalForDb.__arenaNextJsPostgresqlPoolErrorHandler = true;
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

/** Host/banco/schema que o app está usando, sempre com a senha oculta. */
export function databaseTarget(): DatabaseTarget {
  return describeDatabaseTarget(databaseUrl);
}
