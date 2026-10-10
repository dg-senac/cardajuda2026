import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import LogoutButton from "@/components/LogoutButton";
import { requireProfile } from "@/lib/actions/auth";
import { getMedicoById } from "@/lib/queries";
import MedicoPerfilEditClient from "./MedicoPerfilEditClient";

export const dynamic = "force-dynamic";

export default async function MedicoPerfilPage() {
  const profile = await requireProfile();
  const medico = await getMedicoById(profile.id);

  return (
    <>
      <Header title="Meu Perfil" backHref="/medico/inicio" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-4 animate-fade-in rounded-2xl bg-primaria p-5 text-white shadow-[0_4px_12px_rgba(139,0,139,0.15)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-bold text-primaria">
              {profile.nome.trim().charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-extrabold">Dr(a). {profile.nome}</p>
              <p className="text-xs text-white/80">📧 {profile.email}</p>
              <p className="text-xs text-white/80">📞 {profile.telefone}</p>
            </div>
          </div>
          {medico ? (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/15 py-2">
                <p className="font-bold">★ {medico.avaliacao.toFixed(1)}</p>
                <p className="text-white/80">Avaliação</p>
              </div>
              <div className="rounded-xl bg-white/15 py-2">
                <p className="font-bold">{medico.consultasFeitas}</p>
                <p className="text-white/80">Consultas</p>
              </div>
              <div className="rounded-xl bg-white/15 py-2">
                <p className="font-bold">{medico.crm}</p>
                <p className="text-white/80">CRM</p>
              </div>
            </div>
          ) : null}
        </div>

        {medico ? (
          <Card className="mb-4">
            <p className="mb-2 text-sm font-bold text-primaria-escura">Dados profissionais</p>
            <ul className="flex flex-col gap-1 text-xs text-texto/70">
              <li>Especialidade: {medico.especialidade}</li>
              <li>Formação: {medico.formacao}</li>
              <li>Gênero: {medico.genero}</li>
            </ul>
          </Card>
        ) : null}

        <MedicoPerfilEditClient
          nome={profile.nome}
          telefone={profile.telefone}
          especialidade={medico?.especialidade ?? ""}
          formacao={medico?.formacao ?? ""}
        />

        <LogoutButton />
      </main>
      <BottomNav role="medico" />
    </>
  );
}
