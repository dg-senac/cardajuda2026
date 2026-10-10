# Build Android APK com Capacitor

## Configuração Inicial

O projeto está configurado com Capacitor para gerar APK Android.

### Importante: Server Actions

Este app usa **Server Actions** (autenticação, formulários, etc.), que requerem um servidor backend. O APK não funciona como app estático - ele precisa se conectar a um servidor.

### Atualizar URL do Servidor

No arquivo `capacitor.config.json`, atualize a URL do seu servidor de produção:

```json
{
  "server": {
    "url": "https://seu-servidor-production.com"
  }
}
```

Para desenvolvimento local, use:
```json
{
  "server": {
    "url": "http://localhost:3000",
    "cleartext": true
  }
}
```

## GitHub Actions

O workflow `.github/workflows/build-android-apk.yml` gera automaticamente o APK quando:
- Fizer push para `main` ou `master`
- Abrir um pull request
- Disparar manualmente (workflow_dispatch)

### Configurar Secrets no GitHub

Vá em **Settings → Secrets and variables → Actions** e adicione:

- `DATABASE_URL`: Connection string do Supabase

## Build Local

Para construir o APK localmente:

```bash
# 1. Build do Next.js
npm run build

# 2. Sincronizar com Capacitor
npx cap sync android

# 3. Abrir o projeto Android (opcional)
npx cap open android

# 4. Build do APK
cd android
./gradlew assembleDebug
```

O APK será gerado em: `android/app/build/outputs/apk/debug/app-debug.apk`

## Estrutura de Arquivos

- `capacitor.config.json` - Configuração do Capacitor
- `android/` - Projeto Android nativo (ignorado no git)
- `.github/workflows/build-android-apk.yml` - Workflow de CI/CD

## Próximos Passos

1. Hospedar o backend (Vercel, Railway, Render, etc)
2. Atualizar a URL no `capacitor.config.json`
3. Configurar a secret `DATABASE_URL` no GitHub
4. Fazer push para gerar o primeiro APK
