import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import SectionTitle from "@/components/SectionTitle";
import { requireProfile } from "@/lib/actions/auth";
import { listMedicos } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PacienteMedicosPage() {
  const profile = await requireProfile();
  const medicos = await listMedicos();

  return (
    <>
      <Header title="Médicos" subtitle="Nossa equipe de especialistas" avatarName={profile.nome} avatarHref="/paciente/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <SectionTitle>Disponíveis ({medicos.length})</SectionTitle>
        {medicos.length === 0 ? (
          <EmptyState
            icon="stethoscope"
            title="Nenhum médico cadastrado"
            description="Em breve novos profissionais estarão disponíveis."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {medicos.map((medico) => (
              <Card key={medico.id}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primaria to-primaria-escura text-base font-bold text-white">
                    {medico.nome.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-primaria-escura">{medico.nome}</p>
                    <p className="text-xs text-texto-suave">{medico.especialidade}</p>
                    <p className="text-[11px] text-texto-suave">CRM: {medico.crm}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-atencao-claro px-2 py-0.5 text-xs font-extrabold text-status-atencao">
                      <Icon name="star" size={12} className="fill-current" />
                      {medico.avaliacao.toFixed(1)}
                    </span>
                    <p className="text-[10px] text-texto-suave">{medico.consultasFeitas} consultas</p>
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
