import Header from "@/components/Header";
import { requireProfile } from "@/lib/actions/auth";
import NovaConsultaForm from "./NovaConsultaForm";

export const dynamic = "force-dynamic";

export default async function NovaConsultaPage() {
  const profile = await requireProfile();

  return (
    <>
      <Header title="Consulta" backHref="/paciente/consultas" />
      <main className="flex-1 px-4 pb-8 pt-4">
        <NovaConsultaForm nomePaciente={profile.nome} />
      </main>
    </>
  );
}
