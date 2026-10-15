import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("supabase/functions/mobile-api", { recursive: true });
await build({
  entryPoints: ["edge/api.ts"],
  outfile: "supabase/functions/mobile-api/api.js",
  banner: { js: "import process from 'node:process';" },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  alias: {
    "next/headers": "./edge/runtime.ts",
    "next/navigation": "./edge/runtime.ts",
    "next/cache": "./edge/runtime.ts",
    "server-only": "./scripts/test-harness/empty.mjs",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.DB_DEBUG_ERRORS": '"0"',
  },
});
await writeFile(
  "supabase/functions/mobile-api/index.ts",
  `import { handle } from './api.js';\nDeno.serve(handle);\n`,
);
