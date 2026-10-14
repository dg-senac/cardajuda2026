import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

/**
 * Configuração do drizzle-kit (npm run db:push / db:studio / generate).
 *
 * A URL vem da MESMA variável que o app usa (DATABASE_URL do .env.local).
 * Antes existia um drizzle.config.json fixo apontando para
 * postgresql://postgres:postgres@127.0.0.1:5432/app_db: quem rodava
 * `npx drizzle-kit push` criava as tabelas num Postgres local enquanto o app
 * falava com o Supabase -- e o cadastro quebrava com
 * "Failed query: select ... from profiles" (relation "profiles" does not exist).
 *
 * Mesma precedência do Next: .env.local tem prioridade sobre .env.
 */
config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    [
      "DATABASE_URL não está definida -- o drizzle-kit precisa da mesma URL do app.",
      "Crie o arquivo .env.local na raiz do projeto com:",
      "  DATABASE_URL=postgresql://usuario:senha@host:5432/postgres?sslmode=require",
      "Veja supabase/README.md. Para diagnosticar a conexão: npm run db:check",
    ].join("\n"),
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
