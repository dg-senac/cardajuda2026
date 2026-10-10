import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import { requireProfile } from "@/lib/actions/auth";
import { listMedicos } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PacienteMedicosPage() {
  const profile = await requireProfile();
  const medicos = await listMedicos();

  return (
    <>
      <Header title="Médicos" avatarName={profile.nome} avatarHref="/paciente/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        {medicos.length === 0 ? (
          <Card>
            <p className="text-sm text-texto/60">Nenhum médico cadastrado no momento.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {medicos.map((medico) => (
              <Card key={medico.id}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primaria text-base font-bold text-white">
                    {medico.nome.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-primaria-escura">{medico.nome}</p>
                    <p className="text-xs text-texto/60">{medico.especialidade}</p>
                    <p className="text-xs text-texto/60">CRM: {medico.crm}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primaria">★ {medico.avaliacao.toFixed(1)}</p>
                    <p className="text-[11px] text-texto/50">{medico.consultasFeitas} consultas</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav role="paciente" />
    </>
  );
}
