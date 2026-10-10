import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, sessions } from "@/db/schema";
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

  await db.insert(sessions).values({ id: token, userId, expiresAt });

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
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ profile: profiles, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(profiles, eq(sessions.userId, profiles.id))
    .where(eq(sessions.id, token))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }

  return rowToProfile(row.profile);
}
