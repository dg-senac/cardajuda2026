/**
 * Resolver para `node --test`: mapeia os aliases do app para que as Server
 * Actions possam ser importadas em Node puro (mesmo código que roda no Next).
 *
 *   @/x            -> src/x(.ts|.tsx|/index.ts)
 *   next/headers   -> stub com um cookie jar em memória
 *   next/cache     -> stub (revalidatePath no-op)
 *   next/navigation-> stub (redirect vira exceção)
 *   server-only    -> vazio
 *
 * TypeScript: o Node 22.18+ já remove os tipos sozinho, então nada de build.
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const RAIZ = path.resolve(import.meta.dirname, "..", "..");
const STUBS = {
  "server-only": "empty.mjs",
  "next/headers": "next-headers.mjs",
  "next/cache": "next-cache.mjs",
  "next/navigation": "next-navigation.mjs",
};

export async function resolve(specifier, context, nextResolve) {
  const harness = (arquivo) => pathToFileURL(path.join(RAIZ, "scripts/test-harness", arquivo)).href;

  if (STUBS[specifier]) return { url: harness(STUBS[specifier]), shortCircuit: true };

  if (specifier.startsWith("@/")) {
    const sub = specifier.slice(2);
    for (const sufixo of ["", ".ts", ".tsx", "/index.ts", ".mjs"]) {
      const candidato = path.join(RAIZ, "src", sub + sufixo);
      if (fs.existsSync(candidato) && fs.statSync(candidato).isFile()) {
        return { url: pathToFileURL(candidato).href, shortCircuit: true };
      }
    }
    throw new Error(`alias ${specifier} não resolveu em src/`);
  }

  return nextResolve(specifier, context);
}

/** Chamar do teste: instala os hooks no loader registry do processo. */
export function instalarLoader() {
  register(pathToFileURL(path.join(RAIZ, "scripts/test-harness/loader.mjs")));
}
