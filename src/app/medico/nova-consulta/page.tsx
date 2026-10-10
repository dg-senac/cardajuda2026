import Header from "@/components/Header";
import { requireProfile } from "@/lib/actions/auth";
import { listPacientes } from "@/lib/queries";
import NovaConsultaMedicoForm from "./NovaConsultaMedicoForm";

export const dynamic = "force-dynamic";

export default async function MedicoNovaConsultaPage() {
  await requireProfile();
  const pacientes = await listPacientes();

  return (
    <>
      <Header title="Consulta" backHref="/medico/consultas" />
      <main className="flex-1 px-4 pb-8 pt-4">
        <NovaConsultaMedicoForm pacientes={pacientes.map((p) => ({ id: p.id, nome: p.nome, cpf: p.cpf }))} />
      </main>
    </>
  );
}
