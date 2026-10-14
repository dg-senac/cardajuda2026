import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import SectionTitle from "@/components/SectionTitle";
import { ButtonLink } from "@/components/Button";
import { requireProfile } from "@/lib/actions/auth";
import { listConsultasByMedico, listTriagensByMedico } from "@/lib/queries";
import { formatDate } from "@/lib/validations";
import ConsultaActions from "./ConsultaActions";

export const dynamic = "force-dynamic";

export default async function MedicoConsultasPage() {
  const profile = await requireProfile();
  const [consultas, triagens] = await Promise.all([
    listConsultasByMedico(profile.id),
    listTriagensByMedico(profile.id),
  ]);

  const agendadas = consultas
    .filter((c) => c.status === "agendada")
    .sort((a, b) => (a.data < b.data ? -1 : 1));

  return (
    <>
      <Header title="Consultas" avatarName={profile.nome} avatarHref="/medico/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-5 grid grid-cols-2 gap-3">
          <Card variant="primary" className="shadow-[0_8px_24px_rgba(139,0,139,0.35)]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Icon name="stethoscope" size={20} />
            </span>
            <p className="mt-2 text-sm font-bold">Triagens</p>
            <p className="text-2xl font-extrabold">{triagens.length}</p>
            <p className="text-[11px] text-white/75">Atendimentos de triagem</p>
          </Card>
          <Card variant="primary" className="shadow-[0_8px_24px_rgba(139,0,139,0.35)]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Icon name="calendar" size={20} />
            </span>
            <p className="mt-2 text-sm font-bold">Agendadas</p>
            <p className="text-2xl font-extrabold">{agendadas.length}</p>
            <p className="text-[11px] text-white/75">Consultas agendadas</p>
          </Card>
        </div>

        <SectionTitle>Ações rápidas</SectionTitle>
        <div className="mb-5 flex flex-col gap-2.5">
          <ButtonLink href="/medico/nova-triagem">
            <Icon name="stethoscope" size={18} />
            Atendimento de triagem
          </ButtonLink>
          <ButtonLink href="/medico/nova-consulta">
            <Icon name="plus" size={18} />
            Nova consulta
          </ButtonLink>
          <ButtonLink href="/medico/historico" variant="secondary">
            <Icon name="clock" size={18} />
            Ver histórico
          </ButtonLink>
        </div>

        <SectionTitle>Próximas consultas ({agendadas.length})</SectionTitle>
        {agendadas.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Nenhuma consulta agendada"
            description="Registre uma nova consulta ou triagem para começar."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {agendadas.slice(0, 5).map((consulta) => (
              <Card key={consulta.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-primaria-escura">{consulta.nomePaciente}</p>
                    <p className="text-xs text-texto-suave">
                      {formatDate(consulta.data)} às {consulta.horario}
                    </p>
                    <p className="text-xs text-texto-suave">{consulta.especialidade}</p>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primaria/10 text-primaria">
                    <Icon name="calendar" size={17} />
                  </span>
                </div>
                <ConsultaActions consultaId={consulta.id} />
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav role="medico" />
    </>
  );
}
