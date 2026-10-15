#!/usr/bin/env node
/**
 * npm test -- o APK que o usuário instala precisa abrir alguma coisa.
 *
 * História real: o `capacitor.config.json` tinha
 * `"server": { "url": "https://seu-servidor-production.com" }` -- um domínio de
 * exemplo que NÃO EXISTE. O APK gerado no GitHub Actions abria nesse endereço e o
 * Android mostrava "Página da web não disponível / ERR_NAME_NOT_RESOLVED", sem o
 * app carregar nada. Como essa tela só aparece depois de instalar o APK no
 * celular (o CI não tem Android), nenhum teste pegava.
 *
 * Este arquivo fixa as regras que impedem o problema de voltar:
 *   1. nenhum endereço de exemplo no capacitor.config.json;
 *   2. o WebView começa em assets LOCAIS (www/), então o app sempre abre;
 *   3. o endereço do servidor entra por APP_SERVER_URL no build e é verificado;
 *   4. a tela de configuração embutida existe e sabe testar o endereço;
 *   5. o ajuste do AndroidManifest é idempotente.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizarEndereco } from "./android-config.mjs";
import { aplicarPatch } from "./android-patch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (relativo) => fs.readFileSync(path.join(ROOT, relativo), "utf8");

test("capacitor.config.json não aponta para endereço de exemplo", () => {
  const config = JSON.parse(ler("capacitor.config.json"));

  assert.equal(
    config.server?.url,
    undefined,
    "server.url fixo volta a produzir o APK que abre em ERR_NAME_NOT_RESOLVED; use APP_SERVER_URL",
  );
  assert.doesNotMatch(
    JSON.stringify(config),
    /seu-servidor|SEU-DOMINIO|example\.com|placeholder/i,
    "sobrou um endereço de exemplo no capacitor.config.json",
  );
  assert.equal(config.webDir, "www", "o WebView precisa carregar os arquivos locais de www/");
  assert.ok(
    Array.isArray(config.server?.allowNavigation) && config.server.allowNavigation.includes("*"),
    "allowNavigation com curinga é o que mantém a navegação para o servidor dentro do app",
  );
  assert.equal(
    config.appendUserAgent,
    "CardaAjudaApp",
    "o user agent é como as telas reconhecem que estão rodando dentro do APK",
  );
});

test("www/ tem a tela de configuração e o endereço padrão", () => {
  const html = ler("www/index.html");
  for (const trecho of [
    "CapacitorHttp", // checagem sem CORS/conteúdo misto quando roda no app
    "no-cors", // fallback para quando a página é aberta fora do app
    "/api/health", // mesmo endpoint que o resto do projeto usa
    "localStorage",
    "window.location.replace", // navegação para o servidor escolhido
  ]) {
    assert.ok(html.includes(trecho), `www/index.html deveria conter "${trecho}"`);
  }
  assert.doesNotMatch(html, /seu-servidor-production/i);

  const config = ler("www/config.js");
  assert.match(
    config,
    /window\.CARDAJUDA_SERVER_URL\s*=\s*""/,
    "www/config.js começa vazio: quem preenche é scripts/android-config.mjs",
  );
});

test("o workflow do APK usa APP_SERVER_URL e não embute DATABASE_URL no app", () => {
  const workflow = ler(".github/workflows/build-android-apk.yml");

  assert.match(workflow, /scripts\/android-config\.mjs/, "o build precisa gerar o www/config.js");
  assert.match(workflow, /APP_SERVER_URL/, "o endereço do servidor vem de variável, não do código");
  assert.match(workflow, /scripts\/android-patch\.mjs/, "o manifesto do Android precisa ser ajustado");
  assert.match(workflow, /assembleDebug/, "e o APK precisa ser construído de verdade");

  assert.doesNotMatch(
    workflow,
    /seu-servidor-production/i,
    "o workflow não pode citar o endereço de exemplo antigo",
  );
});

test("normalizarEndereco aceita o que a pessoa costuma digitar", () => {
  assert.equal(normalizarEndereco("https://cardiajuda.vercel.app").valor, "https://cardiajuda.vercel.app");
  assert.equal(normalizarEndereco("cardiajuda.vercel.app").valor, "https://cardiajuda.vercel.app");
  assert.equal(normalizarEndereco("https://cardiajuda.vercel.app/").valor, "https://cardiajuda.vercel.app");
  assert.equal(normalizarEndereco("http://192.168.0.10:3000").valor, "http://192.168.0.10:3000");
  assert.equal(normalizarEndereco("  HTTPS://Carda.vercel.app  ").valor, "https://carda.vercel.app");

  // endereços que NÃO podem virar APK: o app abriria numa tela de erro
  assert.ok(normalizarEndereco("").erro, "vazio");
  assert.ok(normalizarEndereco("localhost").erro, "sem domínio");
  assert.ok(normalizarEndereco("http://").erro, "sem host");
  assert.ok(normalizarEndereco("ftp://carda.vercel.app").erro, "protocolo errado");
  assert.ok(normalizarEndereco("https://carda.vercel.app/app").erro, "caminho junto do domínio");
});

test("android-patch é idempotente e não estraga o manifesto", () => {
  const original = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
    "    <application",
    '        android:allowBackup="true"',
    '        android:label="@string/app_name">',
    "    </application>",
    "</manifest>",
    "",
  ].join("\n");

  const primeira = aplicarPatch(original);
  assert.equal(primeira.mudou, true);
  assert.match(primeira.xml, /android:usesCleartextTraffic="true"/);
  assert.match(primeira.xml, /android:allowBackup="true"/, "o resto do manifesto continua igual");

  const segunda = aplicarPatch(primeira.xml);
  assert.equal(segunda.mudou, false, "rodar de novo não duplica o atributo");
  assert.equal(segunda.xml, primeira.xml);

  const semApplication = aplicarPatch("<manifest></manifest>");
  assert.equal(semApplication.mudou, false, "manifesto inesperado não é alterado");
});

test("o app web sabe voltar para a tela de endereço do APK", () => {
  const componente = ler("src/components/TrocarServidor.tsx");
  assert.match(componente, /CardaAjudaApp/, "só aparece dentro do APK (user agent)");
  assert.match(componente, /localhost\/index\.html\?trocar=1/, "e leva para a tela local de configuração");
});

test("ninguém reativa o endereço de exemplo nos arquivos que vão para o APK", () => {
  // ANDROID.md e scripts/android-config.mjs falam do endereço antigo de propósito
  // (explicam o problema e como ele foi corrigido), então ficam fora da lista.
  const alvos = [
    "capacitor.config.json",
    "www/index.html",
    "www/config.js",
    "README.md",
    ".github/workflows/build-android-apk.yml",
  ];
  for (const alvo of alvos) {
    assert.doesNotMatch(ler(alvo), /seu-servidor-production/, `${alvo} voltou a citar o domínio inexistente`);
  }
});

test("a tela de configuração funciona fora do app (sem Capacitor)", () => {
  // A página é HTML puro servido pelo Capacitor; o teste só garante que o
  // fallback existe, porque `www/index.html` também é aberto em navegador
  // durante o desenvolvimento.
  const html = ler("www/index.html");
  assert.match(html, /typeof AbortController !== "undefined"/);
  assert.match(html, /mode: "no-cors"/);
  // Caminho normal do app: plugin nativo.
  assert.match(html, /Capacitor\.Plugins/);
  // Nada de dependência externa: o APK precisa funcionar sem internet no primeiro load.
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i);
  assert.doesNotMatch(html, /fonts\.googleapis|cdn\./i);

  // Diretório temporário só para deixar explícito que nada é escrito no repo.
  assert.ok(fs.existsSync(os.tmpdir()));
});
