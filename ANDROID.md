# Carda Ajuda — Android local + Supabase

## O que é entregue e o que ainda exige homologação

A UI React está em `mobile/`, é compilada em `www/` e copiada pelo Capacitor
para o APK (`com.cardajuda.app`, nome “Carda Ajuda”). Não é um site remoto na
WebView. **Exige internet** para autenticar, consultar e salvar no Supabase.
Não há escolha de servidor, chave anon, PostgreSQL no cliente ou Supabase Auth.

O PR #7 foi consultado: estava fechado, **não mesclado**. Seu código foi recuperado
como base nesta branch. O banco real não foi acessado, migrado ou homologado.
**Nenhum APK compilado foi produzido neste ambiente**: não há Java/JDK nem Android SDK.
A geração do projeto Capacitor e dos assets foi testada; não equivale a compilar APK.

## 1. Configuração inicial do responsável

Faça backup pelo mecanismo do seu projeto antes de qualquer migração. Não use
`reset.sql`, `db:push`, `db:seed` ou `db:setup` no banco existente. Não cole segredos
em chat, issues, commits, artifacts ou capturas de tela.

| Variável | Onde obter | Onde configurar | Classificação |
|---|---|---|---|
| `MOBILE_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL HTTPS | GitHub → Settings → Secrets and variables → Actions → **Variables** | Pública, embutida no APK |
| `SUPABASE_PROJECT_REF` | Supabase → Settings → General → Reference ID | GitHub → Actions → **Variables** | Identificador público, apenas deploy |
| `SUPABASE_ACCESS_TOKEN` | Conta Supabase → Account → Access Tokens | GitHub → Actions → **Secrets** (ou environment `production`) | Secreta, apenas workflow de deploy |
| `DATABASE_URL` | Supabase → Connect → Session pooler, PostgreSQL com senha e `sslmode=require` | Supabase → Edge Functions → Secrets; também `.env.local`/ambiente privado do web se usar web | Secreta, somente backend |
| `TEST_DATABASE_URL` | PostgreSQL local descartável próprio | Terminal de testes; CI já define banco de serviço local | Somente teste; nunca usar produção |

Use a conexão de backend proprietária das tabelas ou com BYPASSRLS, nunca `anon`
ou `authenticated`. Não desative RLS. Não é necessário cadastrar nenhuma dessas
variáveis no celular. Sem URL pública configurada, o build **falha**, não produz
um APK que pede endereço ao paciente.

No GitHub, configure o environment `production`, preferencialmente com aprovação
obrigatória e restrição de branches confiáveis. Não execute deploy de código de
PR externo. O deploy é manual, separado da compilação do APK.

## 2. SQL Editor — abra, copie e execute nesta ordem

Os nomes abaixo são os arquivos canônicos completos; não há scripts duplicados
com a mesma migração. SQL **não publica** a Edge Function.

1. **`supabase/preflight.sql`** — somente leitura, equivalente ao `00_verificar_banco`.
   Confira as 13 tabelas, colunas/tipos, índices, constraints, papel da conexão,
   RLS/policies, grants de tabela/coluna, schemas, views e funções/RPCs.
   Compare com `src/db/schema.ts` e `supabase/schema.sql`. Não publique resultados
   contendo definições que tenham segredos legados.
2. **`supabase/migrations/20261015_mobile_boundary.sql`** — migração e segurança
   unidas em uma transação (equivalente a `01` + `02`). Aditiva/reexecutável,
   preserva registros, hashes, papéis e FKs. Ativa RLS, revoga grants diretos das
   tabelas e colunas de PUBLIC/anon/authenticated e cria `mobile_private` com
   aprovação médica, limitação de tentativas e recibos de idempotência.
   Se detectar views públicas legíveis ou RPCs SECURITY DEFINER públicas não
   pertencentes a extensões, **interrompe para revisão**, em vez de alterar objetos
   desconhecidos. Revise também funções de extensões e schemas expostos no painel
   Data API; deixe `mobile_private` fora dos schemas expostos. O schema do arquivo
   não comprova o schema de produção. Em falha, execute ROLLBACK se a sessão do
   editor continuar na transação, corrija a incompatibilidade e reexecute.
3. **`supabase/03_aprovar_medico.sql`** — após verificar identidade e CRM/UF fora do
   aplicativo, substitua o marcador pelo **UUID real** de `medicos`. Sem substituição,
   o script falha sem alterar dados. Execute individualmente. CRM digitado não é
   prova de habilitação. **Médicos antigos também precisam de aprovação explícita**;
   nenhuma aprovação em massa ou reset de senha é executado. O modelo atual preserva
   CRM como texto único (pode incluir UF no texto); não há verificação em conselho.
4. **`supabase/04_validar_seguranca.sql`** — somente leitura, sem prontuários/hashes.
   Grants clínicos diretos e caminhos alternativos não justificados devem retornar
   zero linhas. Revise qualquer resultado inesperado antes de publicar.

`supabase/seed.sql` é **opcional, somente demonstração descartável**, contém contas
conhecidas e nunca é aplicado pelo build/deploy. Não use em produção. Não altera
contas existentes como mecanismo de instalação.

A política exige backend que fiscalize o acesso; a chave pública do Supabase não
autoriza ler tabelas. Não foram criadas policies de acesso direto com Supabase Auth.

## 3. Publicar API (uma vez, e sempre que mudar backend)

1. Configure `DATABASE_URL` nos **Secrets da Edge Function** no painel Supabase.
2. Configure as Variables/Secrets da tabela acima no GitHub.
3. Actions → **Publicar API Supabase** → Run workflow → selecione esta branch ou,
   após integrar, a branch confiável de distribuição. Aprove o environment se exigido.
4. Aguarde a publicação de `mobile-api`. O workflow compila o código compartilhado,
   resolve dependências Deno com lockfile e executa `supabase functions deploy`.
   Não aplica SQL, seed ou migração e não passa senha de banco em linha de comando.
5. Valide com contas suas de teste antes de distribuição.

`supabase/config.toml` usa `verify_jwt=false`: desativa **apenas a validação JWT do
gateway**. O handler valida o bearer da sessão própria em `sessions` para toda
operação autenticada. Não use `supabase-js`/Supabase Auth como se já estivesse
configurado. Login/cadastro são públicos, validados e limitados por conta (10
pedidos por janela de 15 minutos). Acrescente limites globais de infraestrutura,
monitoramento de abuso e retenção dos buckets em produção; CORS não é autorização.

Não é necessário publicar Next.js para o Android funcionar. O web é independente;
se publicado, também precisa da migração de segurança e da versão nova do backend.

## 4. Gerar, baixar e instalar

1. Actions → **Gerar APK Android** → Run workflow.
2. No job concluído, abra **Artifacts → Carda-Ajuda-Android-debug**.
3. Baixe o ZIP, extraia **`app-debug.apk`**, transfira ao Android e autorize a
   instalação dessa origem quando o sistema solicitar.
4. Abra **Carda Ajuda**. A primeira tela é login local, sem pedir endereço.

O workflow usa Node 22, JDK 21, Android SDK e Gradle do Capacitor. Executa testes
contra PostgreSQL descartável, typecheck, lint, bundle local com allowlist pública,
sync, patch de segurança e `assembleDebug`. Falha se o APK não existir. Caminho:
`android/app/build/outputs/apk/debug/app-debug.apk`. Não há publicação automática
em loja nem implantação de banco. Em PRs sem Variable disponível, o build falha
explicitamente por falta de configuração pública.

**Debug é para teste, não release.** O keystore debug de jobs distintos não é garantia
de identidade estável; uma versão assinada por outra chave pode exigir desinstalar
(perde apenas sessão local; dados no banco permanecem). Para distribuição contínua,
provisione um keystore release privado, senhas em Secrets, assinatura Gradle revisada,
aumente `versionCode` a cada atualização e defina `versionName` em `app/build.gradle`
por um patch versionado de build. Guarde backup seguro do keystore; não o versione ou
publique em artifacts. O projeto Android é gerado e ignorado no Git.

## 5. Sessão, autorização e regras explícitas

- Bcrypt/perfis existentes são preservados. Novas senhas: mínimo 6 caracteres e
  máximo 72 bytes, sem truncamento silencioso. Não existe recuperação de senha;
  não há link fingindo funcionalidade.
- No APK, sessão **somente em memória**, expira no backend em 30 dias e exige novo
  login ao encerrar/reabrir o processo. Não grava senha, token ou prontuário em
  localStorage. Logout remove dados locais mesmo em falha; nesse caso informa que
  a revogação remota não foi confirmada e o token pode continuar válido até expirar.
- Aprovação e vínculo são exigidos no código compartilhado do web e da Edge.
  Médicos sem aprovação recebem aviso, sem dados clínicos. O web manteve login e
  cadastro; o agendamento web agora exige seleção de UUID, não nome aproximado.
- Uma consulta cria o vínculo paciente↔médico por iniciativa do paciente. O vínculo
  continua após consulta realizada/cancelada; o paciente não tem botão de revogação.
  Para revogação, contate o responsável: remova a aprovação médica para suspender
  todo acesso do profissional e revogue suas sessões. Revogação individual de vínculo
  requer evolução de modelo de consentimento antes de distribuição ampla; não apague
  consultas como procedimento de revogação.
- Consultas agendadas podem virar realizadas ou canceladas pelo médico responsável;
  estados finais não são reversíveis. Repetições não incrementam contador novamente.
  Não há grade, bloqueio concorrente de horários ou disponibilidade garantida.
- Medição/alerta e triagem vermelha/alerta são transações. O formulário envia UUID
  de pedido, reaproveitado em retry até sucesso, para não duplicar essas operações.
  Trocas de plano serializam por paciente em transação, sem cobrança integrada.
- Histórico do paciente carrega mais registros por página; prontuário do médico
  mostra as últimas 100 medições e apenas consultas/triagens próprias. Não é exportação
  completa de prontuário. Alertas não possuem ação fictícia de resolução.
- Lembretes são registros, **não push/alarmes**. Cardápio é semanal geral. Dicas e
  faixas simplificadas de medição não são diagnóstico validado; exigem revisão clínica.
  O app não chama socorro: **em emergência, ligue 192**.
- Permissão Android: internet. Backup e transferência de dados excluídos, HTTPS sem
  mixed content, ícone e splash vetoriais locais. Não há acesso a câmera/contatos/GPS.
- Há dados identificadores, contato e saúde; defina consentimento, acesso administrativo,
  backups, retenção, resposta a incidentes e suporte. Isto **não certifica LGPD ou uso clínico**.

## 6. Testes e homologação

Veja [`docs/ENTREGA.md`](docs/ENTREGA.md) para resultados reais, comandos e pendências.
Testes destrutivos só podem usar PostgreSQL local descartável, nunca o Supabase real.

Roteiro de homologação com contas novas próprias:
1. Cadastre paciente com CPF válido de teste autorizado e email controlado; saia/entre.
2. Cadastre médico com identificação de teste; confirme que acesso fica pendente.
3. Aprove somente esse UUID em banco de homologação após conferência do responsável.
4. Como paciente, selecione esse médico, agende uma consulta futura; confirme nas duas contas.
5. Registre medição; confira histórico/alerta pelo médico vinculado e negação por outro médico.
6. Faça triagem vermelha; confira alerta. Marque consulta realizada duas vezes e confira contador.
7. Troque plano, edite perfil, saia/entre; confirme persistência, sem pagamento fictício.
8. Teste modo avião, sessão expirada, erro ao salvar, teclado, botão voltar, fonte ampliada
   e tela pequena em aparelho real. Não use dados de terceiros.
