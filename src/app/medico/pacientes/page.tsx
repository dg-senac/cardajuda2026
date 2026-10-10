import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { requireProfile } from "@/lib/actions/auth";
import { listPacientes, listMedicoesByPaciente } from "@/lib/queries";
import PacientesSearch from "./PacientesSearch";

export const dynamic = "force-dynamic";

export default async function MedicoPacientesPage() {
  const profile = await requireProfile();
  const pacientes = await listPacientes();

  const items = await Promise.all(
    pacientes.map(async (paciente) => {
      const ultima = (await listMedicoesByPaciente(paciente.id, 1))[0] ?? null;
      return {
        id: paciente.id,
        nome: paciente.nome,
        idade: paciente.idade,
        genero: paciente.genero,
        sistolica: ultima?.sistolica ?? null,
        diastolica: ultima?.diastolica ?? null,
        glicemia: ultima?.glicemia ?? null,
        status: ultima?.status ?? null,
      };
    }),
  );

  return (
    <>
      <Header title="Pacientes" avatarName={profile.nome} avatarHref="/medico/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <PacientesSearch items={items} />
      </main>
      <BottomNav role="medico" />
    </>
  );
}
