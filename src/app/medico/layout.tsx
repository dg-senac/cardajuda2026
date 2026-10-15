import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { lookupCurrentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MedicoLayout({ children }: { children: ReactNode }) {
  // Nao lanca com o banco fora do ar: cai no /login, que mostra o aviso com o
  // diagnostico (AvisoBanco) em vez da tela de erro 500.
  const { profile, failure } = await lookupCurrentProfile();
  if (!profile) {
    if (failure) console.error(`[layout] banco indisponível (${failure.code ?? "sem código"}): ${failure.message}`);
    redirect("/login");
  }
  if (profile.role !== "medico") redirect("/paciente/inicio");

  return <div className="flex flex-1 flex-col pb-4">{children}</div>;
}
