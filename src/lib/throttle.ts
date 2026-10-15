import "server-only";
import { db } from "@/db";
import { sql } from "drizzle-orm";
// Persistent, atomic account-based throttling across Edge instances; never store emails/IPs here.
export async function throttle(email: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.toLowerCase().trim()),
  );
  const key = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const result =
    await db.execute(sql`insert into mobile_private.login_limits (key, attempts, window_start)
    values (${key}, 1, now()) on conflict (key) do update set
    attempts = case when mobile_private.login_limits.window_start < now() - interval '15 minutes' then 1 else mobile_private.login_limits.attempts + 1 end,
    window_start = case when mobile_private.login_limits.window_start < now() - interval '15 minutes' then now() else mobile_private.login_limits.window_start end
    returning attempts`);
  if (Number(result.rows[0]?.attempts) > 10) throw new Error("RATE_LIMIT");
}

