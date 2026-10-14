import { notFound } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import SectionTitle from "@/components/SectionTitle";
import StatusBadge from "@/components/StatusBadge";
import StatusIcon from "@/components/StatusIcon";
import { requireProfile } from "@/lib/actions/auth";
import { getPacienteById, listConsultasByPaciente, listMedicoesByPaciente } from "@/lib/queries";
import { formatDateTime } from "@/lib/validations";
import PacienteChart from "./PacienteChart";

export const dynamic = "force-dynamic";

function InfoRow({ icon, label, value }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-2.5 text-xs text-texto-suave">
        <Icon name={icon} size={16} className="text-primaria/70" />
        {label}
      </span>
      <span className="text-right text-xs font-semibold text-texto">{value}</span>
    </li>
  );
}

export default async function DetalhePacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const paciente = await getPacienteById(id);
  if (!paciente) notFound();

  const [medicoes, consultas] = await Promise.all([
    listMedicoesByPaciente(id, 20),
    listConsultasByPaciente(id),
  ]);

  const ultimaMedicao = medicoes[0] ?? null;
  const chartData = [...medicoes]
    .reverse()
    .map((m) => ({
      data: formatDateTime(m.createdAt).slice(0, 5),
      sistolica: m.sistolica,
      diastolica: m.diastolica,
      glicemia: m.glicemia,
    }));

  return (
    <>
      <Header
        title="Relatório do paciente"
        backHref="/medico/pacientes"
        avatarName={profile.nome}
        avatarHref="/medico/perfil"
      />
      <main className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-5 animate-fade-in overflow-hidden rounded-3xl bg-gradient-to-br from-primaria to-primaria-escura p-5 text-white shadow-[0_10px_28px_rgba(139,0,139,0.35)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-xl font-bold text-white ring-2 ring-white/40">
              {paciente.nome.trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold">{paciente.nome}</p>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <Icon name="mail" size={13} /> {paciente.email}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <Icon name="phone" size={13} /> {paciente.telefone}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-2xl bg-white/12 px-2 py-2.5">
              <p className="text-base font-extrabold">{paciente.idade}</p>
              <p className="text-white/75">Idade</p>
            </div>
            <div className="rounded-2xl bg-white/12 px-2 py-2.5">
              <p className="text-base font-extrabold">{paciente.tipoSanguineo}</p>
              <p className="text-white/75">Tipo sang.</p>
            </div>
            <div className="rounded-2xl bg-white/12 px-2 py-2.5">
              <p className="text-base font-extrabold">{paciente.altura} m</p>
              <p className="text-white/75">Altura</p>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <SectionTitle>Dados do paciente</SectionTitle>
          <Card className="divide-y divide-borda !py-1">
            <ul>
              <InfoRow
                icon="heart"
                label="Doenças crônicas"
                value={paciente.doencasCronicas.length > 0 ? paciente.doencasCronicas.join(", ") : "Nenhuma"}
              />
              <InfoRow icon="clipboard" label="Consultas feitas" value={String(consultas.length)} />
              <InfoRow icon="users" label="Gênero" value={paciente.genero} />
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2.5 text-xs text-texto-suave">
                  <Icon name="alert" size={16} className="text-primaria/70" />
                  Atenção necessária
                </span>
                {ultimaMedicao ? (
                  <StatusBadge status={ultimaMedicao.status} />
                ) : (
                  <span className="text-xs font-semibold text-texto-suave">Sem dados</span>
                )}
              </li>
            </ul>
          </Card>
        </div>

        {chartData.length > 0 ? (
          <div className="mb-5">
            <SectionTitle>Histórico de medições</SectionTitle>
            <Card>
              <PacienteChart data={chartData} />
            </Card>
          </div>
        ) : null}

        <div>
          <SectionTitle>Últimas medições</SectionTitle>
          {medicoes.length === 0 ? (
            <EmptyState icon="heart" title="Nenhuma medição registrada" description="As medições do paciente aparecerão aqui." />
          ) : (
            <div className="flex flex-col gap-2">
              {medicoes.slice(0, 5).map((medicao) => (
                <Card key={medicao.id} className="!p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={medicao.status} />
                      <div>
                        <p className="text-sm font-bold text-primaria-escura">
                          {medicao.sistolica}/{medicao.diastolica} mmHg
                        </p>
                        <p className="text-xs text-texto-suave">Glicemia: {medicao.glicemia} mg/dL</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-texto-suave">{formatDateTime(medicao.createdAt)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav role="medico" />
    </>
  );
}
