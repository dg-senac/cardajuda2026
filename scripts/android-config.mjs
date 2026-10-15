#!/usr/bin/env node
/**
 * Gera o `www/config.js` do APK (endereço padrão do servidor).
 *
 * Por que isto existe
 * -------------------
 * O `capacitor.config.json` trazia, fixo, `"url": "https://seu-servidor-production.com"`.
 * Esse domínio NÃO EXISTE: o APK baixado do GitHub Actions abria a WebView nesse
 * endereço e o Android mostrava
 *
 *     Página da web não disponível
 *     net::ERR_NAME_NOT_RESOLVED
 *
 * Ou seja: o app nunca chegou a carregar. Aqui o endereço vem de fora do código
 * (variável APP_SERVER_URL) e, quando não é informado, o APK abre a tela de
 * configuração embutida (`www/index.html`) em vez de um endereço morto.
 *
 * Uso:
 *   node scripts/android-config.mjs
 *   APP_SERVER_URL=https://cardiajuda.vercel.app node scripts/android-config.mjs
 *
 * Variáveis:
 *   APP_SERVER_URL        endereço público do servidor (opcional; vazio = perguntar no app)
 *   APP_SERVER_URL_CHECK  1 (padrão) verifica se o endereço responde antes de gravar; 0 desliga
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = path.join(RAIZ, "www", "config.js");

const CHECAR = !["0", "false", "no", "nao", "não"].includes(
  (process.env.APP_SERVER_URL_CHECK ?? "1").trim().toLowerCase(),
);

/**
 * Aceita "meu-app.vercel.app", "https://meu-app.vercel.app/" e até
 * "http://192.168.0.10:3000" (teste na rede local).
 *
 * @returns {{ valor?: string, erro?: string }}
 */
export function normalizarEndereco(bruto) {
  let texto = (bruto ?? "").trim().replace(/\s+/g, "");
  if (!texto) return { erro: "vazio" };

  if (!/^https?:\/\//i.test(texto)) texto = `https://${texto}`;
  texto = texto.replace(/\/+$/, "");

  let url;
  try {
    url = new URL(texto);
  } catch {
    return { erro: `"${bruto}" não é um endereço válido. Exemplo: https://seu-app.vercel.app` };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { erro: "o endereço precisa começar com http:// ou https://" };
  }
  if (!url.hostname || url.hostname.indexOf(".") === -1) {
    return { erro: `"${bruto}" não tem um domínio (ex.: seu-app.vercel.app)` };
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return {
      erro: `informe apenas o domínio, sem caminho: "${url.protocol}//${url.host}" em vez de "${texto}"`,
    };
  }

  return { valor: `${url.protocol}//${url.host}` };
}

/**
 * O servidor responde? Qualquer resposta HTTP serve -- inclusive 500, porque o
 * /api/health responde 500 justamente quando o banco não está pronto, e nesse
 * caso o app PRECISA abrir para mostrar o diagnóstico na tela.
 */
async function verificar(endereco) {
  const alvo = `${endereco}/api/health`;
  try {
    const resposta = await fetch(alvo, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "cardiajuda-android-build/1.0" },
    });
    return { ok: true, status: resposta.status };
  } catch (error) {
    return { ok: false, motivo: error instanceof Error ? error.message : String(error) };
  }
}

function escrever(valor) {
  const conteudo = `/**
 * Endereço padrão do servidor usado pelo APK (gerado por scripts/android-config.mjs).
 *
 * Vazio = o aplicativo pergunta o endereço na primeira vez que é aberto e guarda
 * a resposta no aparelho. Para já vir preenchido, defina a variável
 * APP_SERVER_URL antes de rodar o build (no GitHub: Settings -> Secrets and
 * variables -> Actions -> Variables -> New repository variable).
 */
window.CARDAJUDA_SERVER_URL = ${JSON.stringify(valor)};
`;
  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.writeFileSync(DESTINO, conteudo, "utf8");
}

async function principal() {
  const bruto = process.env.APP_SERVER_URL ?? "";
  console.log("android:config -- endereço do servidor no APK");
  console.log(`  variável APP_SERVER_URL: ${bruto.trim() ? bruto.trim() : "(não definida)"}`);

  if (!bruto.trim()) {
    escrever("");
    console.log("  resultado: APK SEM endereço fixo.");
    console.log("  O app abre a tela \"Endereço do servidor\" e guarda o que a pessoa digitar.");
    console.log("  Para já vir apontado para um servidor, defina APP_SERVER_URL e rode de novo.");
    return;
  }

  const { valor, erro } = normalizarEndereco(bruto);
  if (erro) {
    console.error(`\n[erro] APP_SERVER_URL inválida: ${erro}`);
    console.error("       Corrija a variável (ou apague para gerar um APK que pergunta o endereço).");
    process.exitCode = 1;
    return;
  }

  console.log(`  endereço normalizado: ${valor}`);

  if (CHECAR) {
    const resultado = await verificar(valor);
    if (!resultado.ok) {
      console.error(`\n[erro] ${valor} não respondeu (${resultado.motivo}).`);
      console.error(
        [
          "       Um APK apontando para um endereço que não responde abre com",
          '       "Página da web não disponível / ERR_NAME_NOT_RESOLVED" -- foi exatamente',
          "       o problema que esta checagem existe para impedir. Antes de gerar o APK:",
          "         1) confirme que o site abre no navegador;",
          "         2) confira se o deploy mais recente terminou;",
          "         3) se quiser ignorar a checagem e gerar mesmo assim, use",
          "            APP_SERVER_URL_CHECK=0 (ou a variável APP_SERVER_URL_CHECK=0 no GitHub).",
          "       Para um APK que pergunta o endereço dentro do próprio app, apague a variável",
          "       APP_SERVER_URL e rode de novo.",
        ].join("\n"),
      );
      process.exitCode = 1;
      return;
    }
    console.log(`  verificação: respondeu HTTP ${resultado.status} em /api/health`);
  } else {
    console.log("  verificação: desligada (APP_SERVER_URL_CHECK=0)");
  }

  escrever(valor);
  console.log(`  gravado em: ${path.relative(RAIZ, DESTINO)}`);
}

// Só roda quando chamado direto (o `import` do normalizarEndereco nos testes não executa nada).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await principal();
}
