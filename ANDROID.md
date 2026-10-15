# Android: interface local + Supabase Edge Function

O APK **exige internet** para autenticação e dados. Não precisa de Next.js publicado,
Vercel, domínio próprio, URL digitada nem configuração pelo paciente. A WebView abre
`www/index.html` local; erros de rede aparecem na interface, sem navegar para página
remota de erro do Android.

## Arquitetura e compatibilidade

- `mobile/app.tsx`: interface React independente do Next, compilada em `www/app.js`.
- `edge/api.ts`: API com operações explícitas. Compila as actions, validações,
  transações Drizzle e queries existentes; adapters de cookies/cache/navigation ficam
  **somente no servidor**, em `edge/runtime.ts`. Não se copiam Server Actions para o APK.
- `supabase/functions/mobile-api`: executa a API no Supabase (Deno + dependências npm).
- `profiles.password_hash` (bcrypt), IDs, papéis e `sessions` são preservados. Não se usa
  Supabase Auth, não há reset de senha ou migração de contas. Contas novas também
  funcionam no login web. Sessão do APK é bearer própria, mantida apenas em memória;
  fechar/reabrir o app exige login. Logout revoga a sessão no banco.
- A Edge Function acessa PostgreSQL com `DATABASE_URL` **privada do servidor**. O APK
  nunca recebe conexão PostgreSQL, senha, hash, service role ou chave anon.
- PostgREST não é utilizado: RLS fica ligado e grants públicos são revogados. Nenhuma
  política de leitura pública é necessária. Autorização é feita pela API (sessão,
  papel, propriedade e vínculo). `verify_jwt=false` significa que a função valida a
  sessão própria, **não** que as operações de dados sejam anônimas.

### Fluxos implementados

| Web dependente de servidor | Operação Android |
| --- | --- |
| Login/cadastros e sessão | login, signupPaciente, signupMedico, me, logout |
| Início, perfil, lembretes e cardápio | home, profile |
| Consultas e histórico | appointment, appointmentStatus, home |
| Medições e histórico de saúde | measurement, patient, home |
| Lista de médicos, planos e assinatura | home, subscribe |
| Pacientes, prontuário, triagens, alertas e pendências do médico | home, patient, triage, pending |

A interface Android é própria, não uma cópia visual de todas as páginas Next.
Lista apenas pacientes vinculados ao médico por consulta (incluindo histórico);
não oferece busca irrestrita de prontuários. O primeiro vínculo é estabelecido pelo
paciente ao escolher o médico no agendamento. O médico pode criar novas consultas e
triagens **para pacientes já vinculados**. Alertas sem médico só aparecem para médicos
vinculados ao paciente; alertas atribuídos só para seu médico. O cadastro público de
médico não concede acesso clínico automaticamente.

## 1. Conferir o Supabase real (antes de qualquer SQL de alteração)

Nesta implementação não havia `.env.local` ou acesso ao seu banco. **O banco real não
foi inspecionado nem alterado.** Os testes foram em PostgreSQL local descartável.

1. Faça backup pelo procedimento do seu projeto.
2. Copie `.env.example` para `.env.local`; preencha `DATABASE_URL` (Session pooler em
   **Connect / Database**, senha somente no arquivo) e execute `npm run db:check`.
3. Execute `supabase/preflight.sql` no SQL Editor. É somente leitura: colunas,
   constraints, índices, RLS, grants, views e funções SECURITY DEFINER. Compare com
   `src/db/schema.ts` e `supabase/schema.sql`. Não compartilhe credenciais ou linhas
   de pacientes. O seed é demonstração e **não deve ser aplicado no banco real**.
4. Se houver divergências, interrompa a implantação e revise-as. Verifique também
   views, RPCs SECURITY DEFINER e grants herdados que exponham as tabelas: a migração
   não remove objetos desconhecidos. Não publique até eliminar essas rotas de acesso.
5. Confirme que a conexão web/Edge usa owner/BYPASSRLS (a conexão `postgres` existente),
   e não `anon`/`authenticated`. RLS não deve ser desativado para fazer o web funcionar.

Não use `reset.sql`, `db:push`, `db:seed` ou reaplicação indiscriminada de schema para
corrigir o projeto existente.

## 2. Aplicar a fronteira de segurança e aprovar médicos

Revise e execute **somente** `supabase/migrations/20261015_mobile_boundary.sql` no SQL
Editor, após a conferência acima. Ela é transacional e reexecutável:

- exige as 13 tabelas existentes; não recria nem modifica suas linhas;
- liga RLS e revoga acesso de `PUBLIC`, `anon`, `authenticated` (inclusive grants de colunas);
- adiciona schema privado com aprovação médica e contagem de tentativas de login;
- não altera senhas, sessões existentes, papéis, IDs ou prontuários.

Confirme cada médico, inclusive os já cadastrados, antes de liberar o acesso Android:

```sql
-- Substitua pelo UUID real obtido no cadastro, após validar identidade/CRM.
insert into mobile_private.approved_doctors (medico_id)
values ('<uuid-real-do-medico>') on conflict do nothing;
```

Isso é aprovação adicional, não mudança do papel existente. Sem ela, o médico consegue
entrar, mas vê aviso de aprovação pendente. Nenhuma conta é invalidada. Para revogar,
remova apenas sua linha de aprovação (operação administrativa deliberada).
As telas/actions web não foram migradas para esse fluxo de aprovação: a política de
acesso clínico do web continua a anterior e deve ser revisada separadamente se for
publicado para cadastros médicos abertos. Login/cadastro web foram preservados.

## 3. Publicar a API no Supabase

Use a CLI Supabase instalada ou `npx supabase`. Autentique **localmente**; não cole tokens
no chat nem versione arquivos de credenciais.

```bash
npm ci
npm run edge:build
npx supabase login
npx supabase functions deploy mobile-api --project-ref <ref-do-projeto>
```

`supabase/config.toml` define `verify_jwt=false` para a sessão própria. O deploy precisa
incluir os arquivos gerados por `edge:build`; não edite o bundle gerado. Alterou actions
ou API? Recompile e faça deploy novamente.

No painel **Edge Functions → Secrets**, configure `DATABASE_URL` com a conexão
PostgreSQL do pooler, TLS (`sslmode=require`) e senha. Essa variável fica **só no
servidor**. Não é necessário `SUPABASE_SERVICE_ROLE_KEY`. Não envie `.env.local` inteiro
para o bundle, para artifacts ou para o repositório. Mantenha `DB_DEBUG_ERRORS` desligado.

## 4. Gerar APK localmente

Requisitos: Node 22, JDK 21, Android SDK com as plataformas/build tools solicitadas
pelo Capacitor 8, licenças aceitas e `ANDROID_HOME` configurado.

Em `.env.local`:

```dotenv
# Público: Dashboard → Project Settings → Data API → Project URL
MOBILE_SUPABASE_URL=https://<ref-do-projeto>.supabase.co
# Privado, apenas para web/diagnóstico local:
DATABASE_URL=<connection-string-postgresql-do-pooler>
```

```bash
npm ci
npm run android:build
```

O script gera o bundle, cria/sincroniza Android, bloqueia HTTP/backup e executa Gradle.
Saída: `android/app/build/outputs/apk/debug/app-debug.apk`.
O build falha sem URL válida; não há fallback para perguntar endereço. Só
`MOBILE_SUPABASE_URL` é injetada no JavaScript. A chave anon **não é necessária**.
O endereço público muda somente reconstruindo o APK.

## 5. GitHub Actions

Em **Settings → Secrets and variables → Actions → Variables**, crie:

| Nome | Valor/origem |
| --- | --- |
| `MOBILE_SUPABASE_URL` | Project URL HTTPS do seu Supabase |

Não configure `APP_SERVER_URL`, `DATABASE_URL`, senha ou service role para o job Android.
Execute **Actions → Build Android APK → Run workflow**; baixe o artifact `app-debug`,
extraia e instale o `.apk`. A função deve estar publicada/configurada previamente; o
workflow compila o cliente e **não** aplica SQL nem faz deploy de backend.

O artifact é **debug**, instalável para testes. Distribuição final deve usar build
release assinado e guardar o keystore fora do Git; a assinatura é necessária também
para futuras atualizações sem desinstalar.

## Validação e limites

```bash
npm test
npm run typecheck
npm run lint
npm run build             # web
npm run edge:build
npm run mobile:build      # exige MOBILE_SUPABASE_URL real
# Só PostgreSQL LOCAL descartável, nunca seu Supabase:
TEST_DATABASE_URL=<url-do-postgres-local> npm test
```

`scripts/mobile-integration.test.mjs` cria banco isolado `_mobile`, aplica schema/seed,
simula grants Supabase e testa bloqueio por role, coluna, aprovação, IDOR, vínculo,
login legado, cadastro, persistência, concorrência, logout e limite de tentativas.
As outras suítes testam transações/rollback e compatibilidade web. Sem banco, testes
de integração são marcados como ignorados, não considerados validação de produção.

Antes de distribuir, teste no **seu Supabase e em um Android real**: contas antigas e
novas dos dois papéis; medições/alertas; agendamento e mudança de status; triagem;
perfil; planos; tentativa de ler outro paciente; logout; rede desligada e retorno.
Confirme também que REST com anon/authenticated não lê nenhuma das 13 tabelas e que
views/RPCs não oferecem caminho alternativo. Nunca use usuários reais nos testes
que alteram registros. O CI não substitui esta homologação.

Há limite persistente de dez tentativas de autenticação por email em quinze minutos.
Para produção aberta, acrescente proteção de abuso por origem/CAPTCHA no gateway e
rotina de expiração dos contadores antigos (não envolvem dados clínicos).

**Validação desta entrega:** 85 testes passaram em PostgreSQL local descartável;
typecheck, lint e build Next passaram. API gerada executou login legado/home em Deno.
Não houve acesso ao Supabase real, compilação Gradle/SDK nem teste em dispositivo;
não há APK compilado nesta sessão.
