# Entrega técnica — 15/10/2026

## Estado verificável

Implementado nesta branch: `arena/6dc7b340-cardajuda2026`, sobre `82f60d5`.
Checkout inicialmente limpo. PR #7 estava **CLOSED**, `mergedAt=null`; seu commit
`8a6635b` foi recuperado como base, sem trocar de branch. Nenhuma migração de
produção, reset, deploy Supabase ou acesso a dados reais foi executado.

**Esta entrega não é homologação integral nem contém APK compilado.**
Há implementação funcional e testes reais locais; os itens pendentes abaixo não
podem ser apresentados como concluídos por existir código ou botão.

## Implementação e arquivos principais

| Área | Arquivos e resultado |
|---|---|
| UI local | `mobile/app.tsx`, `www/index.html`, `www/style.css`: login/cadastros, senha visível/oculta, home, consultas, medições, histórico, médicos/busca/agendamento, planos, perfil; médico com pacientes/busca/prontuário, consultas, triagens, alertas e pendências. Fontes de sistema, logo/ícones SVG compartilhados, roxo/rosa, botões confortáveis, safe areas e navegação inferior por papel. |
| API | `edge/api.ts`, `edge/runtime.ts`, `edge/policy.ts`, `scripts/edge-build.mjs`: operações HTTP com sessões próprias, contexto isolado via AsyncLocalStorage, body limitado, timeout de cliente, CORS restrito, mensagens sem detalhes SQL no cliente em produção. Código de servidor nunca empacotado na UI. |
| Regras compartilhadas | `src/lib/access.ts`, `throttle.ts`, `queries.ts`, `actions/*`, `session.ts`, `mappers.ts`: aprovação e vínculo também no web, escopo das consultas no banco, dados de identidade derivados do backend, senhas bcrypt existentes, limite de novas senhas, idade calculada, recibos de medição/triagem e lock de plano. |
| Web | Layout médico pendente, formulário paciente com seleção de médico por UUID, nome/especialidade conferidos no backend; nenhuma resolução por similaridade de nomes. Login e cadastro preservados. Next atualizado para 16.4.1. |
| Android | `capacitor.config.json`, `scripts/android-{config,build,patch}.mjs`: assets locais, sem seleção de servidor, sem HTTP/mixed content, backup e transferência excluídos, ícone/splash vetoriais e plugin App para voltar/minimizar. Projeto nativo gerado, não versionado. |
| Banco | `supabase/preflight.sql`, `migrations/20261015_mobile_boundary.sql`, `03_aprovar_medico.sql`, `04_validar_seguranca.sql`: inspeção, migração/segurança transacional, aprovação administrativa explícita e pós-validação. Scripts completos. |
| Automação | Workflows `Gerar APK Android`, `Publicar API Supabase`, CI web/Deno. Sem migração automática de produção, sem secrets do banco no job Android. |

### Arquitetura

```
APK: React + assets locais + Capacitor
                 │ HTTPS, bearer da sessão própria
                 ▼
Supabase Edge mobile-api (Deno, código de servidor compartilhado)
                 │ DATABASE_URL privada, autorização por request
                 ▼
PostgreSQL: profiles/sessions + tabelas existentes + mobile_private
```

O app precisa de internet. Nenhum domínio próprio ou Next.js remoto é necessário
para Android. Não houve migração para Supabase Auth.

## Testes executados

| Comando/validação | Resultado real |
|---|---|
| `npm test` sem banco | 54 testes: 51 passaram, 3 suites de banco puladas por falta de `TEST_DATABASE_URL` |
| `TEST_DATABASE_URL=<PostgreSQL local descartável> npm test` | **87 passaram, zero falhas, zero skips** (inclui subtestes); PostgreSQL 18.4 local, não Supabase |
| `npm run typecheck` | Passou |
| `npm run lint` | Passou |
| `npm run build` | Passou; rotas web geradas sem banco de produção |
| `MOBILE_SUPABASE_URL=<URL pública sintética de teste> npm run mobile:build` | Passou; somente compilação/teste, não configurou projeto real |
| `npm run edge:build` | Passou |
| `deno cache --frozen supabase/functions/mobile-api/index.ts` | Passou com dependências npm e lockfile |
| Deno 2.9.6, `deno test … runtime.deno.ts` | **1 passou**, login bcrypt real, consulta via pg, perfil, sessão revogada e senha inválida; banco local |
| `npx cap add android`, sync e patch repetido | Passaram, sem comprovar compilação Gradle |
| `MOBILE_SUPABASE_URL=<teste> npm run android:build` | **Não compilou**: `JAVA_HOME is not set and no 'java' command could be found`; ambiente também não tem Android SDK |
| Tentativa de browser/Playwright | Bloqueada: Chromium não inicia por falta de `libnspr4.so`. Sem screenshots ou homologação visual declarada |
| `git diff --check` | Passou |
| `npm audit --omit=dev` | Zero vulnerabilidades de produção conhecidas após atualização |

As falhas intermediárias de testes após mudança de autorização foram corrigidas:
as fixtures agora aplicam migração e aprovam explicitamente médicos apenas nos
bancos descartáveis; expectativas antigas que aceitavam nome solto foram substituídas
por exigência de UUID. Não se desativou autorização para fazer testes passarem.

### Cobertura real (não equivale a todas as combinações possíveis)

Testes existentes/estendidos executam cadastro/login compatível, duplicidade e rollback,
sessão expirada/revogada, contextos concorrentes, paciente de outra conta negado,
médico pendente e sem vínculo negados, escopo de pendências/consultas, payload de
papel ignorado, medição e triagem/alerta transacionais, contador idempotente,
assinatura/lock concorrente, grants de coluna/tabela e RLS, reexecução de migração,
recusa de views/RPCs inseguras, retry de medição sem duplicação e verificação do
bundle sem pg/bcrypt/credenciais. Há renderização estática de logo/SVG, não teste
visual interativo. O teste Deno usa `--no-check` porque o bundle de servidor é JS;
tipos são verificados separadamente pelo TypeScript do projeto.

Não foram executados testes em aparelho, APK extraído, Supabase remoto, infraestrutura
Edge hospedada ou matriz completa de erros UI. As suítes não provam segurança de
objetos/views/RPCs desconhecidos no seu banco real.

## Pendências e limites importantes

1. **Configurar e conferir Supabase/GitHub**, aplicar SQL revisado e publicar API.
   A integração GitHub retornou 403 ao consultar nomes de Variables/Secrets; não foi
   possível confirmar essa configuração. Nenhum valor secreto foi solicitado ou lido.
2. **Compilar o APK em Actions e instalar em aparelho**. JDK/SDK estão provisionados
   no workflow, mas esse job ainda precisa executar com a variável pública real.
3. **Homologar interface**, leitura, teclado, fontes grandes, safe areas, voltar,
   carregamento/retry, ambos os cadastros e papéis em aparelhos reais. Não há evidência
   visual; a identidade foi aplicada no código, não homologada visualmente.
4. Prontuário médico mostra últimas 100 medições; não oferece paginação completa
   de todo histórico médico. O paciente tem paginação de medições. Agenda/pacientes
   ainda são listagens sem paginação completa para grandes bases.
5. Não há recuperação de senha, push/alarmes, cobrança, agenda de disponibilidade,
   remarcação/cancelamento pelo paciente, resolução de alertas ou consentimento com
   revogação individual pelo paciente. Não há botões que simulem essas operações.
6. Vínculo atual por consulta permanece após finalização/cancelamento. Suspender
   aprovação bloqueia o profissional inteiro. Antes de escala/produção clínica,
   implementar e validar consentimento/revogação individual conforme política real.
7. Aprovação CRM é manual, sem consulta automática ao conselho. CRM/UF ainda é um
   campo textual, sem migração para colunas separadas. Médicos antigos precisam de
   aprovação explícita; senhas, dados e papéis não são resetados.
8. Regras clínicas são simplificadas e não validadas como diagnóstico. Necessárias
   revisão profissional e política clínica. Sem certificação clínica/LGPD declarada.
9. Auditoria de desenvolvimento ainda tem dependências vulneráveis de tooling
   (cadeias drizzle-kit/esbuild e eslint-config-next/fast-glob/braces). Não foi aplicado
   downgrade automático incompatível. Não exponha servidores dessas ferramentas à rede
   nem processe padrões/fontes de PRs não confiáveis com secrets. Auditoria não substitui
   revisão de segurança da aplicação/infraestrutura.
10. Contratos de APIs e autenticação reais precisam de homologação no projeto destino;
    um runtime Deno local não prova rede/TLS/pooler e limites da Edge hospedada.

## Próximas ações do responsável

Siga **`ANDROID.md`**, que contém a tabela exata de variáveis, ordem de SQL, deploy
separado, caminho do artifact, assinatura release e roteiro de teste sem terceiros.
O aplicativo não se instala/configura por SQL sozinho.

Ordem resumida: preflight → migração/segurança → aprovação individual → pós-validação
→ Secrets da função/Variables GitHub → Actions **Publicar API Supabase** → Actions
**Gerar APK Android** → artifact **Carda-Ajuda-Android-debug** → extrair
**app-debug.apk** → instalar e testar com contas próprias em homologação.
