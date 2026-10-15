import "server-only";
import { cookies } from "next/headers";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { profiles, sessions } from "@/db/schema";
import { diagnoseDbError, formatDbDiagnosis } from "@/lib/db-diagnosis.mjs";
import type { DbDiagnosis } from "@/lib/db-diagnosis.d.mts";
import type { Profile } from "@/types";

export const SESSION_COOKIE = "cardiajuda_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function rowToProfile(row: typeof profiles.$inferSelect): Profile {
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

export async function createSession(userId: string): Promise<void> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // A tabela `sessions` só crescia: cada login insertava uma linha e nada
  // apagava as vencidas (nem o logout de um cookie copiado, nem o delete do
  // getCurrentProfile, que só alcançava a linha daquele token). Em banco de
  // app de celular isso vira lixo acumulado + FK de profiles travando delete.
  // A limpeza do usuário que está logando mantém a tabela proporcional a quem
  // usa, sem precisar de cron nem de `pg_cron` no Supabase.
  await db.transaction(async (tx) => {
    await tx
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
    await tx.insert(sessions).values({ id: token, userId, expiresAt });
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  // O cookie tem que sair MESMO SE o delete falhar. Antes, um banco fora do ar
  // fazia o logout voltar com exceção: o cookie continuava válido e o usuário
  // preso logado (num app de saúde em tablet compartilhado, isso é problema).
  if (token) {
    try {
      await db.delete(sessions).where(eq(sessions.id, token));
    } catch (error) {
      console.error(
        `[session] não consegui apagar a sessão do banco (o cookie foi removido mesmo assim)\n${formatDbDiagnosis(diagnoseDbError(error))}`,
      );
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentProfile(): Promise<Profile | null> {
  return (await lookupCurrentProfile()).profile;
}

export interface SessionLookup {
  profile: Profile | null;
  /** Preenchido só quando a consulta ao banco falhou (banco fora do ar, tabela ausente...). */
  failure: DbDiagnosis | null;
}

/**
 * Igual a `getCurrentProfile`, mas NUNCA lança.
 *
 * Por que existe: cada página/layout chamava `getCurrentProfile()` direto. Com o
 * banco inacessível (DATABASE_URL errada, Supabase pausado, `schema.sql` não
 * aplicado) o `select` estourava e a pessoa recebia a tela de erro do Next --
 * inclusive em /login, justamente a tela onde ela conseguiria ler o aviso e
 * resolver. Aqui o erro vira um diagnóstico que a página mostra em português.
 */
export async function lookupCurrentProfile(): Promise<SessionLookup> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return { profile: null, failure: null };

  let rows: { profile: typeof profiles.$inferSelect; expiresAt: Date }[];
  try {
    rows = await db
      .select({ profile: profiles, expiresAt: sessions.expiresAt })
      .from(sessions)
      .innerJoin(profiles, eq(sessions.userId, profiles.id))
      .where(eq(sessions.id, token))
      .limit(1);
  } catch (error) {
    const diagnosis = diagnoseDbError(error);
    console.error(
      `[session] não consegui ler a sessão do cookie (o usuário será tratado como deslogado)\n${formatDbDiagnosis(diagnosis)}`,
    );
    return { profile: null, failure: diagnosis };
  }

  const row = rows[0];
  if (!row) return { profile: null, failure: null };

  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, token)).catch(() => {
      // sessão vencida: se o delete falhar agora, a limpeza acontece no próximo
      // login do mesmo usuário (createSession) -- não é motivo para erro na tela.
    });
    return { profile: null, failure: null };
  }

  return { profile: rowToProfile(row.profile), failure: null };
}
