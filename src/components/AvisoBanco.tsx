import Link from "next/link";
import type { DbStatus } from "@/lib/db-ready";

/**
 * Aviso de banco de dados indisponível (Server Component).
 *
 * Aparece em /login, /cadastro-* e nas telas que dependem de sessão quando
 * `checkDatabase()` não está ok. Existe para o app parar de mostrar a tela de
 * erro do Next (ou, no APK, "página da web não disponível") e passar a dizer o
 * que está errado e como resolver -- é o cenário mais comum em quem está
 * começando: DATABASE_URL ausente ou `supabase/schema.sql` não aplicado.
 */
export default function AvisoBanco({ status }: { status: DbStatus }) {
  const tom = status.kind === "schema" ? "atencao" : "alerta";

  return (
    <div
      className={`w-full max-w-sm animate-fade-in rounded-3xl border-2 p-4 text-left ${
        tom === "atencao"
          ? "border-status-atencao/60 bg-status-atencao-claro"
          : "border-status-alerta/50 bg-status-alerta-claro"
      }`}
      role="status"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-base leading-none">
          {tom === "atencao" ? "🔧" : "⚠️"}
        </span>
        <div className="flex-1">
          <p
            className={`text-[13px] font-extrabold ${
              tom === "atencao" ? "text-status-atencao" : "text-status-alerta"
            }`}
          >
            {status.title}
          </p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-texto-suave">{status.message}</p>
        </div>
      </div>

      {status.missingTables.length > 0 ? (
        <p className="mt-2.5 rounded-xl bg-white/70 px-3 py-2 text-[11px] font-semibold text-texto-suave">
          Faltando: {status.missingTables.join(", ")}
        </p>
      ) : null}

      {status.columnDrift.length > 0 ? (
        <ul className="mt-2.5 flex flex-col gap-1">
          {status.columnDrift.map((item) => (
            <li
              key={item.table}
              className="rounded-xl bg-white/70 px-3 py-2 text-[11px] font-semibold text-texto-suave"
            >
              <strong>{item.table}</strong> sem: {item.missing.join(", ")}
            </li>
          ))}
        </ul>
      ) : null}

      <details className="mt-2.5">
        <summary className="cursor-pointer text-[11px] font-bold text-primaria">Como resolver</summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-white/80 p-3 text-[11px] leading-relaxed text-texto-suave">
          {status.hint}
        </pre>
        {status.detailsEnabled ? (
          <p className="mt-2 text-[10.5px] leading-relaxed text-texto-suave">
            <strong>Detalhe técnico:</strong> {status.code ?? "sem código"} — {status.message}
            <br />
            <strong>Banco em uso:</strong> {status.targetSummary}
          </p>
        ) : null}
      </details>

      <Link
        href="/diagnostico"
        className="mt-3 inline-block text-[11px] font-bold text-primaria underline"
      >
        Ver diagnóstico completo
      </Link>
    </div>
  );
}
