#!/usr/bin/env node
/**
 * Ajustes no projeto Android gerado pelo Capacitor (`android/` é ignorado no git,
 * ou seja: o Capacitor recria a pasta a cada `npx cap add android`).
 *
 * Hoje faz uma coisa só: liberar tráfego HTTP sem TLS.
 *
 * Por quê: o app pode ser apontado, dentro do próprio aplicativo, para um servidor
 * de teste na rede local (`http://192.168.0.10:3000`). Do Android 9 em diante,
 * `usesCleartextTraffic` vem desligado em quem tem targetSdk >= 28, e o download
 * simplesmente falha sem dizer o motivo ("ERR_CLEARTEXT_NOT_PERMITTED"). Servidores
 * em produção usam https e não precisam disto.
 *
 * Rode depois de `npx cap add android` / `npx cap sync android`:
 *   node scripts/android-patch.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFESTO = path.join(RAIZ, "android", "app", "src", "main", "AndroidManifest.xml");

const ATRIBUTO = 'android:usesCleartextTraffic="true"';

export function aplicarPatch(xml) {
  if (xml.includes("usesCleartextTraffic")) {
    return { xml, mudou: false, motivo: "já configura usesCleartextTraffic" };
  }
  const comAtributo = xml.replace(/<application\b(\s)/, `<application ${ATRIBUTO}$1`);
  if (comAtributo === xml) {
    return { xml, mudou: false, motivo: "não encontrei a tag <application> no manifesto" };
  }
  return { xml: comAtributo, mudou: true, motivo: "usesCleartextTraffic adicionado" };
}

function principal() {
  if (!fs.existsSync(MANIFESTO)) {
    console.log(
      "android:patch -- pasta android/ ainda não existe (rode `npx cap add android` antes). Nada a fazer.",
    );
    return;
  }

  const antes = fs.readFileSync(MANIFESTO, "utf8");
  const { xml, mudou, motivo } = aplicarPatch(antes);

  if (mudou) {
    fs.writeFileSync(MANIFESTO, xml, "utf8");
    console.log(`android:patch -- ${motivo} em ${path.relative(RAIZ, MANIFESTO)}`);
    console.log("  (permite apontar o app para um servidor de teste em http:// na rede local)");
  } else {
    console.log(`android:patch -- nada a fazer (${motivo}).`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal();
}
