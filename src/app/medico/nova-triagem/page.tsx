import Header from "@/components/Header";
import { requireProfile } from "@/lib/actions/auth";
import { listPacientes } from "@/lib/queries";
import NovaTriagemForm from "./NovaTriagemForm";

export const dynamic = "force-dynamic";

export default async function MedicoNovaTriagemPage() {
  await requireProfile();
  const pacientes = await listPacientes();

  return (
    <>
      <Header title="Triagem" backHref="/medico/consultas" />
      <main className="flex-1 px-4 pb-8 pt-4">
        <NovaTriagemForm pacientes={pacientes.map((p) => ({ id: p.id, nome: p.nome, cpf: p.cpf }))} />
      </main>
    </>
  );
}
