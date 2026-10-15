import { redirect } from "next/navigation";
import { lookupCurrentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // lookupCurrentProfile não lança com o banco fora do ar: manda para /login,
  // que mostra o AvisoBanco com o que fazer (antes a home virava erro 500).
  const { profile } = await lookupCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  redirect(profile.role === "paciente" ? "/paciente/inicio" : "/medico/inicio");
}
