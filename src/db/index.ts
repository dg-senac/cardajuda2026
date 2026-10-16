import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { describeDatabaseTarget } from "@/lib/db-diagnosis.mjs";
import type { DatabaseTarget } from "@/lib/db-diagnosis.d.mts";

/**
 * Conexão com o Postgres.
 *
 * IMPORTANTE (leia antes de mudar): nada aqui pode lançar erro no momento do
 * `import`. Antes, a falta da DATABASE_URL estourava no carregamento do módulo
 * e QUALQUER página do app -- inclusive /login e /cadastro-* -- virava a tela
 * de erro 500 do Next, sem nenhuma pista para quem estava usando. Num APK isso
 * é pior ainda: a WebView mostra "não foi possível carregar a página" e a pessoa
 * não tem como saber que o problema é configuração de servidor.
 *
 * Agora o pool é criado na PRIMEIRA QUERY (`getPool()`), a URL é lida na hora do
 * uso (não no import) e o `db` é um Proxy que só toca no pool quando alguém
 * consulta. Assim as páginas conseguem renderizar, detectar o problema e mostrar
 * o diagnóstico certo -- ver src/lib/db-ready.ts e src/components/AvisoBanco.tsx.
 */

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlPoolErrorHandler?: boolean;
};

/**
 * Lê e valida a DATABASE_URL AGORA (não no import).
 *
 * Espaço/quebra de linha sobrando no fim do valor no .env muda o nome do banco
 * ("postgres " != "postgres") e derruba a conexão com um erro que não aponta para
 * o .env; por isso o trim. O erro de "não definida" mantém o texto reconhecido
 * pelo catálogo de diagnóstico (src/lib/db-diagnosis.mjs).
 */
export function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;

  if (!raw) {
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

  const url = raw.trim();

  if (!/^postgres(ql)?:\/\//i.test(url)) {
    throw new Error(
      [
        `DATABASE_URL inválida: precisa começar com "postgresql://" (recebido: "${describeDatabaseTarget(url).redacted}").`,
        "Sem o prefixo, o driver assume host/porta padrão e o erro aparece como ENOTFOUND/ECONNREFUSED sem relação com o banco real.",
        "Rode npm run db:check para ver o que está sendo lido.",
      ].join("\n"),
    );
  }

  return url;
}

/** Host/banco/schema que o app está usando, sempre com a senha oculta. */
export function databaseTarget(): DatabaseTarget {
  return describeDatabaseTarget(process.env.DATABASE_URL);
}

function createPool(): Pool {
  const connectionTimeoutMs = Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15_000);

  /**
   * Teto de execução de CADA query (padrão 30s).
   *
   * Sem isso, uma consulta lenta (banco acordando de pause, `seq scan` em tabela
   * grande, lock de um `ALTER TABLE` rodando no SQL Editor) deixa a Server Action
   * pendurada: a tela fica no "carregando" e o usuário recarrega, empilhando mais
   * consultas. Com o timeout o Postgres cancela a query e o app devolve um erro
   * com SQLSTATE 57014, que o catálogo de diagnóstico sabe explicar.
   *
   * `application_name` aparece no `pg_stat_activity` do Supabase, o que permite
   * diferenciar as queries deste app das de um `drizzle-kit studio` aberto.
   */
  const statementTimeoutMs = Number(process.env.DB_STATEMENT_TIMEOUT_MS || 30_000);
  const serverOptions = [
    Number.isFinite(statementTimeoutMs) && statementTimeoutMs > 0
      ? `-c statement_timeout=${Math.round(statementTimeoutMs)}`
      : null,
    "-c application_name=cardiajuda",
  ]
    .filter(Boolean)
    .join(" ");

  const pool = new Pool({
    connectionString: databaseUrl(),
    options: serverOptions,
    // Sem isto, um pooler/projeto pausado deixa a requisição pendurada para
    // sempre (a tela fica só com o "carregando"). Com o limite, o erro aparece.
    connectionTimeoutMillis: Number.isFinite(connectionTimeoutMs) ? connectionTimeoutMs : 15_000,
    idleTimeoutMillis: 30_000,
    // O session pooler do Supabase libera ~60 conexões por projeto no plano
    // gratuito; 10 por instância evita que um `npm run dev` esgote o pool.
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

  return pool;
}

let localPool: Pool | null = null;

/** Pool de conexões, criado na primeira consulta (e reaproveitado depois). */
export function getPool(): Pool {
  if (localPool) return localPool;
  localPool = globalForDb.__arenaNextJsPostgresqlPool ?? createPool();
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = localPool;
  }
  return localPool;
}

/** true quando existe um pool aberto (sem tocar no banco). */
export function hasPool(): boolean {
  return localPool !== null;
}

/** Fecha o pool (usado pelos testes). */
export async function closePool(): Promise<void> {
  const pool = localPool ?? globalForDb.__arenaNextJsPostgresqlPool;
  localPool = null;
  globalForDb.__arenaNextJsPostgresqlPool = undefined;
  if (pool) await pool.end().catch(() => {});
}

let instance: NodePgDatabase | null = null;

function realDb(): NodePgDatabase {
  instance ??= drizzle(getPool());
  return instance;
}

/**
 * Cliente Drizzle.
 *
 * É um Proxy de propósito: `drizzle(pool)` exigiria o pool já criado no import.
 * Cada chamada (`db.select()`, `db.transaction()`, `db.execute()`) resolve o
 * pool real na hora -- e os métodos são amarrados ao driver verdadeiro, para o
 * `this` interno continuar válido.
 */
export const db = new Proxy({} as NodePgDatabase, {
  get(_target, property) {
    const real = realDb();
    const value = Reflect.get(real as object, property) as unknown;
    return typeof value === "function" ? value.bind(real) : value;
  },
}) as NodePgDatabase;
