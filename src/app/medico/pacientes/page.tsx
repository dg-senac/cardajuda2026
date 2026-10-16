import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { requireProfile } from "@/lib/actions/auth";
import { listPacientesComUltimaMedicao } from "@/lib/queries";
import PacientesSearch from "./PacientesSearch";

export const dynamic = "force-dynamic";

export default async function MedicoPacientesPage() {
  const profile = await requireProfile();
  // Uma chamada em vez de 1 + N (era uma query de medição por paciente listado).
  const pacientes = await listPacientesComUltimaMedicao();

  const items = pacientes.map((paciente) => ({
    id: paciente.id,
    nome: paciente.nome,
    idade: paciente.idade,
    genero: paciente.genero,
    sistolica: paciente.ultima?.sistolica ?? null,
    diastolica: paciente.ultima?.diastolica ?? null,
    glicemia: paciente.ultima?.glicemia ?? null,
    status: paciente.ultima?.status ?? null,
  }));

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
