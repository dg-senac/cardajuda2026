import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  // Arquivos de declaração de tipos não têm código para avaliar (o parser do
  // Next só cobre .ts/.tsx; declarações ambientes como "export const X: T;"
  // não são JavaScript válido).
  globalIgnores([".next/**", "www/app.js", "supabase/functions/**", "out/**", "build/**", "next-env.d.ts", "**/*.d.mts"]),
]);
