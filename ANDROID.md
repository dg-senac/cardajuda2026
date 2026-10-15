# APK Android (Capacitor)

O aplicativo Android é um **casco**: ele abre o sistema web (Next.js + banco de dados) que está
publicado num servidor. Ele **não** guarda pacientes, médicos nem consultas no celular — isso fica
no Postgres (Supabase) do outro lado do servidor. Por isso, **sem um servidor no ar e sem o
endereço dele, o APK não tem o que mostrar**.

> **Se você instalou o APK e apareceu "Página da web não disponível — net::ERR_NAME_NOT_RESOLVED"**:
> a versão antiga do `capacitor.config.json` trazia fixo o endereço `https://seu-servidor-production.com`,
> que não existe. Hoje o endereço vem de fora do código (variável `APP_SERVER_URL`) e, quando não é
> informado, o próprio aplicativo pergunta o endereço na primeira tela e guarda no aparelho. Gere o
> APK de novo (Actions → Build Android APK) e reinstale.

## Resumo do fluxo

```
GitHub Actions ─┬─► npm ci
                ├─► node scripts/android-config.mjs   →  www/config.js  (endereço do servidor)
                ├─► npx cap add android / cap sync    →  copia www/ para dentro do APK
                ├─► node scripts/android-patch.mjs    →  libera http:// (teste na rede local)
                └─► ./gradlew assembleDebug           →  app-debug.apk (artifact)
```

Ao abrir, o APK carrega `www/index.html` (arquivo local, sempre disponível). Essa tela:

1. se já existe endereço salvo (ou definido no build), testa `/api/health` e abre o sistema;
2. se o endereço não responde ou não existe, mostra o campo para corrigir — em vez da tela de erro
   do Android;
3. se nunca foi configurado, mostra o campo, explica onde achar o endereço e guarda o que for digitado.

Depois de entrar, o link **"Trocar servidor"** (na tela de login, aparece só dentro do APK) volta
para essa tela de configuração.

## Definir o endereço do servidor

**Opção A — variável no GitHub (recomendado).** O APK já vem apontado para o seu servidor:

`Settings → Secrets and variables → Actions → Variables → New repository variable`

| Nome | Valor | Para que serve |
| --- | --- | --- |
| `APP_SERVER_URL` | `https://seu-app.vercel.app` | Endereço onde o sistema está publicado (só domínio, sem caminho). |
| `APP_SERVER_URL_CHECK` | `1` (padrão) | Confere se o endereço responde antes de gerar o APK. `0` desliga. |

Se `APP_SERVER_URL` não responder, o build **falha** com a explicação — de propósito: um APK que
abre num endereço morto só dá dor de cabeça depois de instalado.

**Opção B — na hora de rodar o workflow.** `Actions → Build Android APK → Run workflow → server_url`.

**Opção C — nada configurado.** O build passa normalmente e o APK pergunta o endereço na primeira
execução (fica salvo no aparelho).

> **Atenção:** o APK **não** precisa da `DATABASE_URL`. Ela pertence ao servidor (Vercel/Render),
> nunca ao celular — colocar o banco dentro do app significaria entregar a senha do banco para quem
> instalar o APK.

## Gerar o APK

1. Publique o sistema web e confirme que ele abre no navegador (veja `README.md`, seção "Publicar").
2. Rode o workflow **Build Android APK** (push na `main`, ou manualmente em Actions).
3. Baixe o artifact `app-debug` (arquivo `app-debug.apk`) e instale no celular.
4. Abra o app e informe o endereço do servidor, se ele pedir.

## Build local

```bash
npm ci
npm run android:config     # opcional: APP_SERVER_URL=https://... npm run android:config
npm run android:build      # gera o APK em android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android:build` faz tudo: gera o `www/config.js`, adiciona/sincroniza o projeto Android,
aplica os ajustes do manifesto e roda o Gradle. Requer **JDK 21** e o **Android SDK**.

Para testar contra o servidor rodando na sua máquina:

```bash
npm run dev -- -H 0.0.0.0                # o celular precisa estar na mesma rede Wi-Fi
npm run android:build                    # e informe http://SEU-IP:3000 no app
```

No primeiro uso, o endereço `http://` é aceito e testado igual ao `https://` (o manifesto gerado
permite tráfego sem TLS, o que o Android bloqueia por padrão desde o Android 9).

## O que cada arquivo faz

| Arquivo | Papel |
| --- | --- |
| `capacitor.config.json` | Configuração do Capacitor. **Sem `server.url`**: o app abre em `www/` (local). `allowNavigation: ["*"]` mantém a navegação para o servidor dentro do app; `appendUserAgent` marca as requisições como vindas do APK. |
| `www/index.html` | Tela de "endereço do servidor" + teste de conexão. HTML puro, sem dependências externas. |
| `www/config.js` | Endereço padrão, **gerado** por `scripts/android-config.mjs` (o repositório guarda a versão vazia). |
| `scripts/android-config.mjs` | Valida `APP_SERVER_URL`, confere se responde e grava o `www/config.js`. |
| `scripts/android-patch.mjs` | Ajusta o `AndroidManifest.xml` gerado (libera `http://` para testes locais). Idempotente. |
| `.github/workflows/build-android-apk.yml` | Gera o APK no CI. |
| `android/` | Projeto Android gerado pelo Capacitor. Ignorado no git (recriado a cada build). |

## Problemas comuns

| Sintoma no celular | Causa | O que fazer |
| --- | --- | --- |
| "Página da web não disponível — ERR_NAME_NOT_RESOLVED" | Endereço do servidor não existe (domínio errado ou deploy nunca feito). | Confira o endereço no navegador do computador e informe de novo no app ("Trocar servidor"). |
| "Não consegui falar com https://…" na tela do app | Servidor fora do ar, endereço com caminho (`/login`) ou celular sem internet. | Teste o endereço no navegador; use só o domínio, sem caminho. |
| App abre, mas o login diz "não foi possível acessar o banco" | O servidor está no ar, o banco não. | Abra `https://SEU-ENDERECO/diagnostico` — ele lista o que falta (normalmente `npm run db:setup`). |
| Tela branca ao abrir | `www/` vazio no APK (sync não rodou). | Rode `npx cap sync android` e gere de novo. |
| `http://192.168.x.x:3000` não carrega | Tráfego sem TLS bloqueado. | Rode `node scripts/android-patch.mjs` e gere o APK de novo (o workflow já faz isso). |
| Login "funciona" mas volta para a tela de login | O servidor precisa de HTTPS: cookies `Secure` não viajam em `http://` fora de `localhost`. | Use o endereço publicado (`https://`). Para teste local, use um túnel (ngrok/cloudflared). |
