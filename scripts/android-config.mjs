import { build } from "esbuild";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
export function validateSupabaseUrl(raw) {
  const url = new URL(raw || "");
  if (
    url.protocol !== "https:" ||
    !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "MOBILE_SUPABASE_URL deve ser a URL HTTPS do projeto Supabase.",
    );
  return url.origin;
}
export async function main() {
  config({ path: ".env.local", quiet: true });
  let url;
  try {
    url = validateSupabaseUrl(process.env.MOBILE_SUPABASE_URL);
  } catch {
    throw new Error(
      "Configure MOBILE_SUPABASE_URL em .env.local ou nas Variables do GitHub. O build não gera APK sem configuração.",
    );
  }
  // Only this public constant is injected. Never spread process.env into a browser build.
  await build({
    entryPoints: ["mobile/app.tsx"],
    outfile: "www/app.js",
    bundle: true,
    minify: true,
    platform: "browser",
    define: {
      __SUPABASE_URL__: JSON.stringify(url),
      "process.env.NODE_ENV": '"production"',
    },
    metafile: true,
  }).then((result) => {
    if (
      Object.keys(result.metafile.inputs).some((p) =>
        /src\/(db|lib\/actions)|\bpg\b|bcrypt/.test(p),
      )
    )
      throw new Error("Módulo de servidor no APK.");
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
