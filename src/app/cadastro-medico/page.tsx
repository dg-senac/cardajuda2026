import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import CadastroMedicoForm from "./CadastroMedicoForm";

export const dynamic = "force-dynamic";

export default async function CadastroMedicoPage() {
  const profile = await getCurrentProfile();
  if (profile) {
    redirect(profile.role === "paciente" ? "/paciente/inicio" : "/medico/inicio");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <CadastroMedicoForm />
    </main>
  );
}
