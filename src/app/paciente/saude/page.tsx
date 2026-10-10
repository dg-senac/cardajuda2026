import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { requireProfile } from "@/lib/actions/auth";
import { listMedicoesByPaciente } from "@/lib/queries";
import SaudeClient from "./SaudeClient";

export const dynamic = "force-dynamic";

export default async function SaudePage() {
  const profile = await requireProfile();
  const medicoes = await listMedicoesByPaciente(profile.id, 10);

  return (
    <>
      <Header title="Minha Saúde" avatarName={profile.nome} avatarHref="/paciente/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <SaudeClient medicoes={medicoes} />
      </main>
      <BottomNav role="paciente" />
    </>
  );
}
