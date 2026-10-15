import { redirect } from "next/navigation";
import AvisoBanco from "@/components/AvisoBanco";
import { checkDatabase } from "@/lib/db-ready";
import { lookupCurrentProfile } from "@/lib/session";
import CadastroPacienteForm from "./CadastroPacienteForm";

export const dynamic = "force-dynamic";

export default async function CadastroPacientePage() {
  // O banco precisa existir para o cadastro gravar. Mostrar o formulário sem
  // avisar (e só falhar no envio) é o que fazia o cadastro parecer "quebrado
  // sem motivo": a explicação agora aparece antes de digitar.
  const db = await checkDatabase();

  const profile = db.ok ? (await lookupCurrentProfile()).profile : null;
  if (profile) {
    redirect(profile.role === "paciente" ? "/paciente/inicio" : "/medico/inicio");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10">
      {db.ok ? null : <AvisoBanco status={db} />}
      <CadastroPacienteForm />
    </main>
  );
}
