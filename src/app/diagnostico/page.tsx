import type { Metadata } from "next";
import Link from "next/link";
import AvisoBanco from "@/components/AvisoBanco";
import Icon from "@/components/Icon";
import { APP_TABLES } from "@/lib/db-diagnosis.mjs";
import { SETUP_COMMANDS, checkDatabase } from "@/lib/db-ready";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Diagnóstico do banco — cardiajuda",
};

/**
 * /diagnostico -- a tela que responde "por que meu login/cadastro não funciona?".
 *
 * É pública de propósito: quando o banco está sem schema não existe login, e é
 * justamente nesse momento que a pessoa precisa ler a explicação. O que aparece
 * aqui é host:porta/banco (sem usuário e sem senha) e a lista de tabelas que
 * faltam -- nada que permita acessar o banco.
 */
export default async function DiagnosticoPage() {
  // force: a pessoa chega aqui justamente para "verificar agora", depois de
  // rodar o db:setup -- o cache de 15s atrapalharia essa conferência.
  const status = await checkDatabase(true);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">cardiajuda</p>
        <h1 className="mt-0.5 text-2xl font-extrabold text-primaria-escura">Diagnóstico do banco</h1>
        <p className="mt-1 text-sm text-texto-suave">
          O que o servidor deste app está usando para conectar, e o que falta para login e cadastro
          funcionarem.
        </p>
      </div>

      {status.ok ? (
        <div className="rounded-3xl border-2 border-status-normal/40 bg-status-normal-claro p-4">
          <p className="text-[13px] font-extrabold text-status-normal">✅ Tudo certo</p>
          <p className="mt-1 text-xs font-medium text-texto-suave">{status.message}</p>
        </div>
      ) : (
        <AvisoBanco status={status} />
      )}

      <section className="rounded-3xl border border-borda bg-white p-5 shadow-card">
        <h2 className="text-sm font-bold text-primaria-escura">Conexão em uso</h2>
        <dl className="mt-2 flex flex-col gap-1 text-xs text-texto-suave">
          <div className="flex justify-between gap-3">
            <dt className="font-semibold">Host / banco</dt>
            <dd className="text-right">{status.targetSummary}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold">DATABASE_URL</dt>
            <dd className="text-right">{status.target.present ? "definida" : "não definida"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold">SSL</dt>
            <dd className="text-right">{status.target.sslmode ?? "(padrão)"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold">Verificado em</dt>
            <dd className="text-right">{new Date(status.checkedAt).toLocaleString("pt-BR")}</dd>
          </div>
        </dl>
        {status.target.warnings.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {status.target.warnings.map((warning) => (
              <li key={warning} className="rounded-xl bg-status-atencao-claro px-3 py-2 text-[11px] text-status-atencao">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
        {status.detailsEnabled && status.code ? (
          <p className="mt-3 rounded-xl bg-fundo-rosa px-3 py-2 text-[11px] text-texto-suave">
            <strong>Código:</strong> {status.code} — {status.message}
          </p>
        ) : null}
      </section>

      {status.columnDrift.length > 0 ? (
        <section className="rounded-3xl border border-borda bg-white p-5 shadow-card">
          <h2 className="text-sm font-bold text-primaria-escura">Colunas que faltam</h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-[11px]">
            {status.columnDrift.map((item) => (
              <li key={item.table} className="rounded-xl bg-status-atencao-claro px-3 py-2 text-status-atencao">
                <strong>{item.table}</strong> — faltam: {item.missing.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-3xl border border-borda bg-white p-5 shadow-card">
        <h2 className="text-sm font-bold text-primaria-escura">
          Tabelas do app ({APP_TABLES.length - status.missingTables.length}/{APP_TABLES.length})
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
          {APP_TABLES.map((table) => {
            const faltando = status.missingTables.includes(table);
            return (
              <li
                key={table}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold ${
                  faltando ? "bg-status-alerta-claro text-status-alerta" : "bg-status-normal-claro text-status-normal"
                }`}
              >
                <span aria-hidden="true">{faltando ? "✕" : "✓"}</span>
                {table}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-3xl border border-borda bg-white p-5 shadow-card">
        <h2 className="text-sm font-bold text-primaria-escura">Como resolver</h2>
        <p className="mt-1 text-xs text-texto-suave">
          No seu computador, com a mesma <code className="font-bold">DATABASE_URL</code> que o app usa:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-fundo-rosa p-3 text-[11px] leading-relaxed text-texto-suave">
          {SETUP_COMMANDS}
        </pre>
        <p className="mt-3 text-xs text-texto-suave">
          Ou pelo painel do Supabase: <strong>SQL Editor → New query</strong> → cole o conteúdo de{" "}
          <code className="font-bold">supabase/schema.sql</code> → <strong>Run</strong>. As tabelas
          existentes não são apagadas.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-fundo-rosa p-3 text-[11px] leading-relaxed text-texto-suave">
          {`# o mesmo diagnóstico pela linha de comando\nnpm run db:check`}
        </pre>
      </section>

      <div className="flex flex-wrap gap-3 text-xs font-bold">
        <Link href="/diagnostico" className="inline-flex items-center gap-1.5 text-primaria underline">
          <Icon name="clock" size={14} />
          Verificar de novo
        </Link>
        <a href="/api/health" className="inline-flex items-center gap-1.5 text-primaria underline">
          <Icon name="info" size={14} />
          Ver JSON do /api/health
        </a>
        <Link href="/login" className="inline-flex items-center gap-1.5 text-primaria underline">
          <Icon name="arrow-left" size={14} />
          Voltar ao login
        </Link>
      </div>
    </main>
  );
}
