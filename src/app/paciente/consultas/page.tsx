import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import SectionTitle from "@/components/SectionTitle";
import StatusBadge from "@/components/StatusBadge";
import { ButtonLink } from "@/components/Button";
import { requireProfile } from "@/lib/actions/auth";
import { listConsultasByPaciente } from "@/lib/queries";
import { formatDate } from "@/lib/validations";

export const dynamic = "force-dynamic";

export default async function PacienteConsultasPage() {
  const profile = await requireProfile();
  const consultas = await listConsultasByPaciente(profile.id);
  const hoje = new Date().toISOString().slice(0, 10);

  const proximas = consultas
    .filter((c) => c.status === "agendada")
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  const anteriores = consultas.filter((c) => c.status !== "agendada");

  return (
    <>
      <Header title="Consultas" avatarName={profile.nome} avatarHref="/paciente/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <ButtonLink href="/paciente/nova-consulta" className="mb-5">
          <Icon name="plus" size={18} />
          Agendar nova consulta
        </ButtonLink>

        <div className="mb-5">
          <SectionTitle>Próximas consultas ({proximas.length})</SectionTitle>
          {proximas.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Nenhuma consulta agendada"
              description="Agende sua próxima consulta e cuide do seu coração."
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {proximas.map((consulta) => (
                <Card key={consulta.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-primaria-escura">{consulta.profissional}</p>
                      <p className="text-xs text-texto-suave">{consulta.especialidade}</p>
                    </div>
                    <StatusBadge status={consulta.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-fundo-rosa px-3 py-2 text-xs font-semibold text-primaria-escura">
                    <Icon name="calendar" size={15} className="shrink-0 text-primaria" />
                    {formatDate(consulta.data)} às {consulta.horario}
                    {consulta.data === hoje ? (
                      <span className="ml-auto rounded-full bg-primaria px-2 py-0.5 text-[9px] font-extrabold uppercase text-white">
                        Hoje
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-texto-suave">
                    <span className="font-semibold text-texto">Motivo:</span> {consulta.motivo}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>

        {anteriores.length > 0 ? (
          <div>
            <SectionTitle>Histórico ({anteriores.length})</SectionTitle>
            <div className="flex flex-col gap-2.5">
              {anteriores.map((consulta) => (
                <Card key={consulta.id} className="opacity-90">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-primaria-escura">{consulta.profissional}</p>
                      <p className="text-xs text-texto-suave">{consulta.especialidade}</p>
                    </div>
                    <StatusBadge status={consulta.status} />
                  </div>
                  <p className="mt-2 text-xs text-texto-suave">
                    {formatDate(consulta.data)} às {consulta.horario}
                  </p>
                  <p className="mt-1 text-xs text-texto-suave">
                    <span className="font-semibold text-texto">Motivo:</span> {consulta.motivo}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </main>
      <BottomNav role="paciente" />
    </>
  );
}
