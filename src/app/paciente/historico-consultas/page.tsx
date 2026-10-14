import Header from "@/components/Header";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import SectionTitle from "@/components/SectionTitle";
import StatusBadge from "@/components/StatusBadge";
import { requireProfile } from "@/lib/actions/auth";
import { listConsultasByPaciente } from "@/lib/queries";
import { formatDate } from "@/lib/validations";

export const dynamic = "force-dynamic";

export default async function HistoricoConsultasPage() {
  const profile = await requireProfile();
  const consultas = await listConsultasByPaciente(profile.id);

  return (
    <>
      <Header title="Histórico de consultas" subtitle="Tudo que já aconteceu" backHref="/paciente/inicio" />
      <main className="flex-1 px-4 pb-8 pt-4">
        <SectionTitle>Consultas ({consultas.length})</SectionTitle>
        {consultas.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title="Nenhuma consulta registrada"
            description="Suas consultas aparecerão aqui assim que forem agendadas."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {consultas.map((consulta) => (
              <Card key={consulta.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-primaria-escura">{consulta.profissional}</p>
                    <p className="text-xs text-texto-suave">{consulta.especialidade}</p>
                  </div>
                  <StatusBadge status={consulta.status} />
                </div>
                <div className="mt-2.5 flex items-center gap-2 text-xs text-texto-suave">
                  <Icon name="calendar" size={14} className="shrink-0 text-primaria/70" />
                  {formatDate(consulta.data)} às {consulta.horario}
                </div>
                <p className="mt-1.5 text-xs text-texto-suave">
                  <span className="font-semibold text-texto">Motivo:</span> {consulta.motivo}
                </p>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
