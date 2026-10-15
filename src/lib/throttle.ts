import "server-only";
import { db } from "@/db";
import { sql } from "drizzle-orm";

// Persistent, atomic account-based throttling across Edge instances; never store emails/IPs here.
async function throttleKey(email: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.toLowerCase().trim()),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function throttle(email: string) {
  const key = await throttleKey(email);
  const result =
    await db.execute(sql`insert into mobile_private.login_limits (key, attempts, window_start)
    values (${key}, 1, now()) on conflict (key) do update set
    attempts = case when mobile_private.login_limits.window_start < now() - interval '15 minutes' then 1 else mobile_private.login_limits.attempts + 1 end,
    window_start = case when mobile_private.login_limits.window_start < now() - interval '15 minutes' then now() else mobile_private.login_limits.window_start end
    returning attempts`);
  if (Number(result.rows[0]?.attempts) > 10) throw new Error("RATE_LIMIT");
}

/**
 * Login bem-sucedido zera a contagem da conta. Assim, quem acerta a senha não fica
 * bloqueado por tentativas anteriores à entrada (ex.: testar o app várias vezes).
 * Tentativas erradas continuam contando dentro da janela de 15 minutos.
 */
export async function clearThrottle(email: string) {
  const key = await throttleKey(email);
  await db.execute(sql`delete from mobile_private.login_limits where key = ${key}`);
}
