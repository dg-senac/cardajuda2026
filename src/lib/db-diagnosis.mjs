/**
 * Diagnóstico de erros de banco de dados.
 *
 * Por que este arquivo existe
 * ---------------------------
 * O Drizzle embrulha qualquer falha do driver numa `DrizzleQueryError` com uma
 * mensagem sempre igual:
 *
 *     Failed query: select "id", "role", ... from "profiles" where ... = $1 limit $2
 *     params: alguem@email.com,1
 *
 * Essa mensagem não diz nada sobre a causa. A causa real (tabela inexistente,
 * senha errada, DNS, TLS, banco pausado, ...) fica escondida na cadeia de
 * `error.cause`. Enquanto o app mostra só a mensagem do Drizzle, TODOS os
 * problemas de banco têm a mesma cara -- por isso este módulo desembrulha a
 * cadeia e traduz cada código para uma explicação e um próximo passo.
 *
 * Sem `import` de propósito: este arquivo é consumido tanto pelo app Next
 * (via `src/db/index.ts`) quanto pelos scripts `npm run db:check` e
 * `npm run db:setup`, que rodam em Node puro, sem build e sem alias `@/`.
 * Os tipos ficam em `db-diagnosis.d.mts`.
 */

/** As 13 tabelas que o app espera encontrar (ver supabase/schema.sql). */
export const APP_TABLES = [
  "profiles",
  "pacientes",
  "medicos",
  "sessions",
  "consultas",
  "triagens",
  "medicoes",
  "alertas",
  "pendencias",
  "lembretes",
  "cardapio_semanal",
  "planos",
  "assinaturas",
];

/** Tabelas sem as quais login/cadastro não funcionam de jeito nenhum. */
export const AUTH_TABLES = ["profiles", "sessions", "pacientes", "medicos"];

const MAX_CAUSE_DEPTH = 9;

/**
 * Percorre `error.cause` até o fim e devolve o erro mais fundo que tiver um
 * `code` (o erro do driver/Postgres costuma ser o último), ou o mais fundo que
 * existir.
 *
 * @param {unknown} error
 * @returns {{ name: string, code: string | null, message: string, depth: number } | null}
 */
export function getDbRootCause(error) {
  let current = error;
  let deepest = null;
  let deepestWithCode = null;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (!(current instanceof Error)) break;

    const rawCode = /** @type {{ code?: unknown }} */ (current).code;
    const rawConstraint = /** @type {{ constraint?: unknown }} */ (current).constraint;
    const rawDetail = /** @type {{ detail?: unknown }} */ (current).detail;
    const node = {
      name: current.name,
      code: typeof rawCode === "string" && rawCode.length > 0 ? rawCode : null,
      message: current.message,
      /** Nome do índice/constraint violado, quando o Postgres manda (ex.: pacientes_cpf_unique). */
      constraint: typeof rawConstraint === "string" ? rawConstraint : null,
      /** Detalhe extra do Postgres (ex.: Key (email)=(x@y.com) already exists.). */
      detail: typeof rawDetail === "string" ? rawDetail : null,
      depth,
    };

    deepest = node;
    if (node.code) deepestWithCode = node;

    current = /** @type {{ cause?: unknown }} */ (current).cause;
  }

  return deepestWithCode ?? deepest;
}

/**
 * Igual a `getDbRootCause`, mas devolve a trilha completa (do erro do Drizzle
 * até a causa raiz) -- útil no log do servidor.
 *
 * @param {unknown} error
 * @returns {string[]}
 */
export function getDbErrorChain(error) {
  const chain = [];
  let current = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (!(current instanceof Error)) break;

    const rawCode = /** @type {{ code?: unknown }} */ (current).code;
    const code = typeof rawCode === "string" && rawCode.length > 0 ? ` ${rawCode}` : "";
    const firstLine = current.message.split("\n")[0];
    chain.push(`${current.name}${code}: ${firstLine}`);

    current = /** @type {{ cause?: unknown }} */ (current).cause;
  }

  return chain;
}

/**
 * Lê a DATABASE_URL e descreve o alvo sem nunca vazar a senha.
 * Nunca lança: uma URL inválida vira `{ parsed: false, ... }` com avisos.
 *
 * @param {string | undefined | null} rawUrl
 * @returns {import("./db-diagnosis.d.mts").DatabaseTarget}
 */
export function describeDatabaseTarget(rawUrl) {
  const raw = typeof rawUrl === "string" ? rawUrl : "";
  const warnings = [];
  const trimmed = raw.trim();

  if (!raw) {
    return {
      parsed: false,
      present: false,
      redacted: "(DATABASE_URL não definida)",
      warnings: ["A variável DATABASE_URL não chegou ao processo."],
    };
  }

  if (raw !== trimmed) {
    warnings.push(
      "A DATABASE_URL tem espaço/quebra de linha sobrando no começo ou no fim. Isso muda o nome do banco ou do host e derruba a conexão (o app já faz trim; corrija o .env mesmo assim).",
    );
  }

  if (/^\s*DATABASE_URL\s*=/i.test(trimmed)) {
    warnings.push(
      'O valor começa com "DATABASE_URL=". Provavelmente a linha inteira do .env foi colada como valor -- o correto é DATABASE_URL=postgresql://... (uma vez só).',
    );
  }

  if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
    warnings.push(
      'A URL não começa com "postgresql://" (ou "postgres://"). Sem isso o driver assume host "base"/localhost e o erro que aparece é ENOTFOUND/ECONNREFUSED sem relação com o banco real.',
    );
  }

  if (trimmed.includes("#")) {
    warnings.push(
      'A URL tem "#" (mesmo dentro da senha). Tudo depois do "#" é tratado como fragmento e ignorado -- o driver chega a lançar "Invalid URL". Codifique o caractere como %23.',
    );
  }

  const userInfoMatch = trimmed.match(/^[a-z]+:\/\/([^/?#]*)/i);
  const userInfo = userInfoMatch ? userInfoMatch[1] : "";
  if (userInfo.split("@").length > 2) {
    warnings.push(
      'A senha tem "@" não codificado. Use %40 para que o driver saiba onde termina a senha e começa o host.',
    );
  }
  if (/:[^:@/]*[^:@/0-9a-zA-Z._~%!$&'()*+,;=-][^:@/]*@/.test(userInfo)) {
    warnings.push(
      "A senha contém caracteres especiais. Codifique-os (%40 para @, %23 para #, %2F para /, %3A para :) ou troque a senha por uma só com letras e números.",
    );
  }

  let sslmode = null;
  try {
    const parsed = new URL(trimmed);
    sslmode = parsed.searchParams.get("sslmode");
    const host = parsed.hostname;
    const isLocal = ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host);

    if (!isLocal && !sslmode) {
      warnings.push(
        "Host remoto sem sslmode na URL. Provedores gerenciados (Supabase, Neon, RDS...) exigem TLS: acrescente ?sslmode=require no fim da DATABASE_URL.",
      );
    }
    if (sslmode === "require") {
      warnings.push(
        "sslmode=require: no pg 8.16+ isso passou a valer como verify-full (verificação completa do certificado). Se aparecer erro de certificado, use ?sslmode=require&uselibpqcompat=true.",
      );
    }

    return {
      parsed: true,
      present: true,
      protocol: parsed.protocol.replace(":", ""),
      user: decodeURIComponent(parsed.username || ""),
      passwordIsSet: Boolean(parsed.password),
      host,
      port: parsed.port ? Number(parsed.port) : 5432,
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres",
      sslmode,
      isLocal,
      isSupabasePooler: host.endsWith("pooler.supabase.com"),
      isSupabaseDirect: /^db\..+\.supabase\.co$/.test(host),
      isSupabase: host.endsWith("supabase.co") || host.endsWith("supabase.com"),
      redacted: `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}${parsed.search}`,
      warnings,
    };
  } catch (error) {
    return {
      parsed: false,
      present: true,
      redacted: trimmed.replace(/:\/\/([^:@/]+):[^@/]*@/, "://$1:***@"),
      warnings: [
        ...warnings,
        `A DATABASE_URL não pôde ser interpretada como URL: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

/**
 * @typedef {{ match: (cause: { name: string, code: string | null, message: string }) => boolean, summary: string, hint: string }} ErrorRule
 */

/** @type {ErrorRule[]} */
const ERROR_RULES = [
  // ---------------------------------------------------------------- Postgres
  // A regra 42703 (coluna inexistente) vem ANTES da de tabela inexistente porque
  // esta tambem casa por mensagem, e "column ... of relation ... does not exist"
  // conteria o padrao dela -- a pessoa receberia o conselho errado (rodar
  // db:setup) para um problema de nome de coluna entre schema.ts e banco.
  {
    match: (c) =>
      c.code === "42703" ||
      /column .* does not exist|column ".*" of relation ".*" does not exist/i.test(c.message),
    summary:
      "O app consultou uma coluna que não existe neste banco -- schema do banco e src/db/schema.ts estão em versões diferentes.",
    hint: "Rode `npm run db:setup` (ele adiciona o que falta sem apagar nada) e confira o resultado com `npm run db:check`. Se a coluna foi renomeada à mão, o `supabase/reset.sql` só deve ser usado com backup: ele recria as 13 tabelas.",
  },
  {
    match: (c) => c.code === "42P01" || /relation ".*" does not exist/i.test(c.message),
    summary:
      'A tabela não existe no banco em que o app se conectou. O SQL do app está certo -- o banco é que não tem (ou não tem neste schema) a tabela "profiles".',
    hint: "Aponte a DATABASE_URL para o banco certo e crie as tabelas nele: rode `npm run db:setup` (script supabase/schema.sql). Se preferir o painel do Supabase: SQL Editor -> New query -> cole supabase/schema.sql -> Run. Depois rode `npm run db:check` para confirmar. Cuidado: `npx drizzle-kit push` usa a DATABASE_URL do momento -- se rodou apontando para um Postgres local, as tabelas foram para lá, não para o Supabase.",
  },
  {
    match: (c) => c.code === "3D000" || /database ".*" does not exist/i.test(c.message),
    summary: 'O banco (database) informado na DATABASE_URL não existe no servidor.',
    hint: 'No Supabase o banco se chama "postgres". Confira também se não sobrou um espaço no fim do valor no .env (o erro costuma vir como database "postgres " does not exist). Rode `npm run db:check` para ver o host/banco que o app está usando.',
  },
  {
    match: (c) => c.code === "28P01" || /password authentication failed/i.test(c.message),
    summary: "O usuário existe, mas a senha está errada (o Postgres recusou a autenticação).",
    hint: 'Confira a senha em Project Settings -> Database do Supabase e, se ela tiver @ # / : ? &, codifique (%40, %23, %2F, %3A, %3F, %26) -- senão a URL é cortada no lugar errado. Se você reiniciou/resetou a senha, atualize a DATABASE_URL do arquivo .env.local e também a do host (Vercel/GitHub Actions secret).',
  },
  {
    match: (c) => /Tenant or user not found/i.test(c.message),
    summary:
      "O Supabase não reconheceu esse usuário no pooler. É o erro clássico de connection string do pooler montada com o usuário errado.",
    hint: 'No pooler o usuário PRECISA ter o ref do projeto: postgres.<ref-do-projeto> (e o host precisa ser aws-0-<região>.pooler.supabase.com). Copie a string inteira em Project Settings -> Database -> Connection string -> Session pooler (porta 5432) e cole no .env.local sem editar nada além de [YOUR-PASSWORD].',
  },
  {
    match: (c) => c.code === "28000" && /no pg_hba\.conf entry/i.test(c.message),
    summary: "O servidor recusou a conexão sem TLS (criptografia).",
    hint: "Provedores gerenciados só aceitam conexão criptografada. Acrescente ?sslmode=require no fim da DATABASE_URL.",
  },
  {
    match: (c) => c.code === "28000",
    summary: "Usuário/role inválido ou sem permissão de conexão neste host.",
    hint: "Confira o usuário da DATABASE_URL. Na conexão direta do Supabase ele é postgres; no pooler é postgres.<ref-do-projeto>.",
  },
  {
    match: (c) => c.code === "42501",
    summary: "O usuário conectou, mas não tem permissão para ler/criar a tabela.",
    hint: 'Use o usuário "postgres" (dono do schema), ou conceda acesso: GRANT USAGE ON SCHEMA public TO <usuario>; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO <usuario>;',
  },
  {
    match: (c) => c.code === "53300" || /too many clients|remaining connection slots/i.test(c.message),
    summary: "O servidor atingiu o limite de conexões.",
    hint: "Feche outras instâncias do app/dev server e use a porta 6543 (transaction pooler) do Supabase em ambiente serverless. O app já reaproveita um pool de conexões; reinicie o `npm run dev` se ficou alguma instância pendurada.",
  },
  {
    match: (c) => c.code === "57P03" || /the database system is starting up/i.test(c.message),
    summary: "O banco está subindo (ou o projeto do Supabase estava pausado e acabou de acordar).",
    hint: "Espere de 10 a 30 segundos e tente de novo. No plano gratuito do Supabase o projeto pausa por inatividade e a primeira conexão demora mais.",
  },
  {
    match: (c) => c.code === "23505",
    summary: "O banco recusou a gravação porque já existe uma linha com esse valor (email/CPF/CRM duplicado).",
    hint: "Verifique se a conta já foi criada antes: tente entrar com esse email em /login. Se a linha antiga ficou incompleta, remova-a pelo SQL Editor do Supabase (select * from profiles where email = '...') e cadastre de novo.",
  },
  {
    match: (c) => c.code === "23503" || /violates foreign key constraint/i.test(c.message),
    summary:
      'A gravação foi recusada porque a linha dependente não existe (ex.: uma consulta apontando para um paciente que não está em "pacientes").',
    hint: 'Neste projeto o caso clássico é cadastro salvo pela metade: existe a linha em "profiles" e falta a de "pacientes"/"medicos". Rode `npm run db:check` -- ele lista essas contas órfãs e o SQL para corrigir. Os cadastros agora gravam as duas tabelas numa transação só, então isto só aparece em dados antigos.',
  },
  {
    match: (c) => c.code === "23502" || /null value in column .* violates not-null constraint/i.test(c.message),
    summary: "Uma coluna obrigatória (NOT NULL) chegou vazia.",
    hint: "Se o formulário tem o campo preenchido, a divergência é entre o schema do banco e o de src/db/schema.ts (coluna nova exigida sem default). Rode `npm run db:setup` para adicionar o que falta e confira no `npm run db:check` se sobrou alguma tabela com colunas a menos.",
  },
  {
    match: (c) => c.code === "23514" || /violates check constraint/i.test(c.message),
    summary:
      "O valor viola um CHECK do banco (as listas fechadas de status, classificação, papel, altura e idade).",
    hint: "Os CHECK estão em supabase/schema.sql e em src/db/schema.ts: status de consulta é agendada/realizada/cancelada, o de medição é normal/atencao/alerta, o de alerta é alerta/pendente/em_dia, classificação de triagem é verde/amarela/vermelha e role é paciente/medico. Se o valor vier de um seed ou do SQL Editor, ajuste o dado -- não apague o CHECK.",
  },
  {
    match: (c) =>
      c.code === "22003" ||
      /numeric field overflow|integer out of range|value too large for type/i.test(c.message),
    summary:
      'O número não cabe na coluna: "numeric field overflow" (numeric(5,2)) ou "integer out of range".',
    hint: "O caso mais comum aqui é altura digitada em centímetros (170 em vez de 1,70) ou pressão/glicemia com valor absurdo. As colunas são pacientes.altura numeric(5,2) e integer para as medições. O app já valida a faixa antes do insert; se você vir isto, confira se o schema do banco é o mesmo de src/db/schema.ts.",
  },
  {
    match: (c) =>
      c.code === "22P02" ||
      /invalid input syntax for type/i.test(c.message),
    summary:
      "O Postgres recebeu um valor num formato que a coluna não aceita (uuid, date ou numeric mal formados).",
    hint: 'uuid: os ids vêm de <input type=\"hidden\"> nas telas do médico -- se o paciente não foi escolhido na lista, o campo vai vazio/texto e o insert quebra (o app agora confere antes). date: as colunas pedem AAAA-MM-DD. numeric: use ponto, não vírgula (1.70, não \"1,70\").',
  },
  {
    match: (c) => c.code === "22007" || /invalid datetime field|date\/time field value out of range/i.test(c.message),
    summary: "Data ou hora fora do formato/intervalo que a coluna `date` aceita.",
    hint: 'As action de consulta e triagem só aceitam AAAA-MM-DD e HH:MM; qualquer outro texto (incluindo "hoje") é recusado antes de chegar ao banco.',
  },
  {
    match: (c) => c.code === "25P02" || /current transaction is aborted/i.test(c.message),
    summary:
      "Este erro é consequência: uma instrução anterior da mesma transação falhou e o Postgres abortou o resto.",
    hint: "Procure no log a linha [db] imediatamente ANTES desta -- é o erro de verdade. As actions do app agora fazem rollback inteiro, então nenhuma gravação parcial ficou no banco.",
  },
  {
    match: (c) => c.code === "42P05" || /prepared statement .* already exists/i.test(c.message),
    summary: "Statements preparados não funcionam no transaction pooler (porta 6543).",
    hint: "Use o Session pooler (porta 5432) ou a conexão direta. O app precisa de sessão consistente para as transações.",
  },
  {
    match: (c) => ["08000", "08001", "08003", "08004", "08006", "08007"].includes(c.code ?? ""),
    summary: "A conexão com o banco foi criada e caiu no meio (falha de rede/protocolo).",
    hint: "Costuma acontecer com o transaction pooler (porta 6543) ou proxy com timeout baixo. Use a porta 5432 (session pooler) na conexão direta do Supabase e verifique firewall/VPN.",
  },
  {
    match: (c) =>
      /connection terminated unexpectedly|socket hang up|connection closed|ssl connection has been closed normally/i.test(
        c.message,
      ),
    summary:
      "A conexão de rede com o host abriu e foi ENCERRADA antes do login terminar -- o Postgres nem respondeu (por isso não há código de erro).",
    hint: 'Quase sempre é o caminho entre você e o banco, não a senha: firewall/proxy corporativo ou da rede bloqueando a porta 5432, antivírus inspecionando TLS, ou saída restrita (CI/sandbox que só liberam HTTPS). Testes: `npm run db:check` em outra rede (4G resolve o mesmo host?), e `psql \"<DATABASE_URL>\"` para ver se o erro é o mesmo. Em servidor que só fala com o Supabase via HTTPS, use o connection string direto com TLS no 5432 ou o pooler regional.',
  },
  // -------------------------------------------------------- Rede / DNS / TLS
  {
    match: (c) => c.code === "ENOTFOUND" || c.code === "EAI_AGAIN",
    summary:
      "O nome do host (DNS) não foi encontrado. O app não conseguiu nem chegar ao servidor -- a URL do banco não corresponde a um projeto existente.",
    hint: 'Veja o host que o app está usando com `npm run db:check`. Se for db.<ref>.supabase.co, esse endereço é IPv6-only e falha em muitas redes: troque por aws-0-<região>.pooler.supabase.com (Session pooler) copiando a string do painel. Se o host saiu como \"base\" ou \"localhost\", a DATABASE_URL está malformada (falta postgresql:// ou sobrou texto).',
  },
  {
    match: (c) => c.code === "ECONNREFUSED",
    summary: "O host existe, mas nada está escutando nessa porta.",
    hint: "Confira a porta: 5432 (session pooler / conexão direta) ou 6543 (transaction pooler). Projeto do Supabase pausado também recusa conexão -- abra o painel e reative. Firewall/VPN corporativa pode bloquear a saída.",
  },
  {
    match: (c) => c.code === "ETIMEDOUT" || /connection timeout|timeout expired/i.test(c.message),
    summary: "A conexão ficou pendurada até estourar o tempo limite.",
    hint: "Projeto do Supabase pausado, firewall/VPN bloqueando, ou host IPv6-only numa rede sem IPv6. Reative o projeto e use o Session pooler (IPv4). O app corta em DB_CONNECTION_TIMEOUT_MS (padrão 15s) para não travar a tela para sempre.",
  },
  {
    match: (c) => c.code === "ECONNRESET" || c.code === "EPIPE" || c.code === "EHOSTUNREACH" || c.code === "ENETUNREACH",
    summary: "A conexão caiu ou o host é inalcançável.",
    hint: "IPv6 sem rota é a causa mais comum com o host direto do Supabase (db.<ref>.supabase.co). Use o Session pooler em aws-0-<região>.pooler.supabase.com.",
  },
  {
    match: (c) =>
      [
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "SELF_SIGNED_CERT_IN_CHAIN",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        "CERT_HAS_EXPIRED",
        "ERR_TLS_CERT_ALTNAME_INVALID",
      ].includes(c.code ?? "") || /self-signed certificate|certificate/i.test(c.message),
    summary:
      "Falha ao validar o certificado TLS do servidor (o handshake criptografado foi recusado pelo cliente).",
    hint: "No pg 8.16+ o `sslmode=require` passou a exigir verificação completa do certificado. Use ?sslmode=require&uselibpqcompat=true na DATABASE_URL. Se a rede tiver antivírus/proxy inspecionando TLS, é ele que está quebrando o certificado.",
  },
  {
    match: (c) =>
      c.code === "57014" ||
      /canceling statement due to statement timeout|terminating connection due to/i.test(c.message),
    summary:
      "A query foi cancelada pelo limite de tempo (statement_timeout) ou por administracao do servidor.",
    hint: "O app limita cada query a DB_STATEMENT_TIMEOUT_MS (padrao 30s) justamente para a tela nao ficar pendurada. Se um upload/listagem legitima passou a estourar: aumente a variavel, e rode `npm run db:check` -- plano de execucao ruim neste projeto costuma significar indice ausente (falta `npm run db:setup`).",
  },
  {
    match: (c) => /does not support SSL connections/i.test(c.message),
    summary: "A URL pede SSL, mas o servidor não oferece SSL (típico de Postgres local).",
    hint: "Tire o ?sslmode=... da DATABASE_URL quando o alvo é um Postgres na sua máquina.",
  },
  {
    match: (c) => /Invalid URL|ERR_INVALID_URL/i.test(c.message) || c.code === "ERR_INVALID_URL",
    summary: "A própria DATABASE_URL está malformada.",
    hint: 'Caracteres especiais na senha (@ # / :) precisam ser codificados (%40, %23, %2F, %3A). Rode `npm run db:check` para ver o valor sem a senha.',
  },
  {
    match: (c) => /unsupported startup parameter|prepared statement .* already exists|bind message supplies/i.test(c.message),
    summary: "O servidor não aceitou parâmetros de sessão/statements preparados -- sintoma de pooler em modo transaction.",
    hint: "Use a porta 5432 (Session pooler) ou a conexão direta do Supabase, que mantêm a sessão completa.",
  },
  {
    match: (c) => /DATABASE_URL is required|DATABASE_URL não está definida/i.test(c.message),
    summary: "A variável DATABASE_URL não chegou ao processo que roda o app.",
    hint: "Crie o arquivo .env.local na raiz do projeto (não versione) com DATABASE_URL=postgresql://..., reinicie o `npm run dev`, e cadastre a mesma variável no host (Vercel: Settings -> Environment Variables; GitHub Actions: Settings -> Secrets).",
  },
];

const FALLBACK_RULE = {
  summary: "O banco recusou a operação, mas não é um dos casos conhecidos.",
  hint: "Copie a mensagem/código acima e rode `npm run db:check` para ver o host, o banco e as tabelas do alvo que o app está usando.",
};

/**
 * Traduz um erro (o do Drizzle, com a causa escondida) em causa raiz + o que fazer.
 *
 * @param {unknown} error
 * @returns {import("./db-diagnosis.d.mts").DbDiagnosis}
 */
export function diagnoseDbError(error) {
  const cause = getDbRootCause(error);
  const chain = getDbErrorChain(error);

  if (!cause) {
    return {
      code: null,
      name: "Error",
      message: error instanceof Error ? error.message : String(error),
      constraint: null,
      detail: null,
      summary: FALLBACK_RULE.summary,
      hint: FALLBACK_RULE.hint,
      chain,
    };
  }

  const rule = ERROR_RULES.find((candidate) =>
    candidate.match({ name: cause.name, code: cause.code, message: cause.message }),
  );

  return {
    code: cause.code,
    name: cause.name,
    message: cause.message,
    constraint: cause.constraint ?? null,
    detail: cause.detail ?? null,
    summary: (rule ?? FALLBACK_RULE).summary,
    hint: (rule ?? FALLBACK_RULE).hint,
    chain,
  };
}

/**
 * Diagnóstico em várias linhas, para o log do servidor.
 *
 * @param {import("./db-diagnosis.d.mts").DbDiagnosis} diagnosis
 * @returns {string}
 */
export function formatDbDiagnosis(diagnosis) {
  const lines = [
    `[db] causa: ${diagnosis.code ?? "sem código"} | ${diagnosis.message}`,
    `[db] o que é: ${diagnosis.summary}`,
    `[db] o que fazer: ${diagnosis.hint}`,
  ];
  if (diagnosis.chain.length > 1) {
    lines.push(`[db] trilha: ${diagnosis.chain.join(" <- ")}`);
  }
  return lines.join("\n");
}

/**
 * Mensagem curta para mostrar na tela. Fora de produção (ou com
 * DB_DEBUG_ERRORS=1) o detalhe técnico vai junto, porque é justamente ele que
 * permite descobrir a causa.
 *
 * @param {"cadastro" | "login"} purpose
 * @param {import("./db-diagnosis.d.mts").DbDiagnosis} diagnosis
 * @param {boolean} showDetails
 * @returns {string}
 */
export function userFacingDbMessage(purpose, diagnosis, showDetails) {
  const base =
    purpose === "login"
      ? "Não foi possível entrar: o servidor não conseguiu acessar o banco de dados."
      : "Não foi possível concluir o cadastro: o servidor não conseguiu acessar o banco de dados.";

  if (!showDetails) return base;

  return `${base} [${diagnosis.code ?? "sem código"}] ${diagnosis.message} | ${diagnosis.hint}`;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean} true quando vale a pena mostrar o detalhe técnico na tela.
 */
export function dbDetailsEnabled(env = process.env) {
  if (env.NODE_ENV === "production") return false;
  if (env.DB_DEBUG_ERRORS === "1" || env.DB_DEBUG_ERRORS === "true") return true;
  return env.NODE_ENV !== "production";
}
