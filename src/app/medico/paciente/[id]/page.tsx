import { notFound } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import StatusIcon from "@/components/StatusIcon";
import { requireProfile } from "@/lib/actions/auth";
import { getPacienteById, listConsultasByPaciente, listMedicoesByPaciente } from "@/lib/queries";
import { formatDateTime } from "@/lib/validations";
import PacienteChart from "./PacienteChart";

export const dynamic = "force-dynamic";

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
      <Header title="Relatório do paciente" backHref="/medico/pacientes" avatarName={profile.nome} avatarHref="/medico/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-4 animate-fade-in rounded-2xl bg-primaria p-5 text-white shadow-[0_4px_12px_rgba(139,0,139,0.15)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-bold text-primaria">
              {paciente.nome.trim().charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-extrabold">{paciente.nome}</p>
              <p className="text-xs text-white/80">📧 {paciente.email}</p>
              <p className="text-xs text-white/80">📞 {paciente.telefone}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-white/15 py-2">
              <p className="font-bold">{paciente.idade}</p>
              <p className="text-white/80">Idade</p>
            </div>
            <div className="rounded-xl bg-white/15 py-2">
              <p className="font-bold">{paciente.tipoSanguineo}</p>
              <p className="text-white/80">Tipo sang.</p>
            </div>
            <div className="rounded-xl bg-white/15 py-2">
              <p className="font-bold">{paciente.altura} m</p>
              <p className="text-white/80">Altura</p>
            </div>
          </div>
        </div>

        <Card className="mb-4">
          <p className="mb-2 text-sm font-bold text-primaria-escura">Dados do paciente</p>
          <ul className="flex flex-col gap-1.5 text-xs text-texto/70">
            <li className="flex justify-between">
              <span>Doenças crônicas</span>
              <span className="font-semibold text-texto">
                {paciente.doencasCronicas.length > 0 ? paciente.doencasCronicas.join(", ") : "Nenhuma"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Consultas feitas</span>
              <span className="font-semibold text-texto">{consultas.length}</span>
            </li>
            <li className="flex justify-between">
              <span>Gênero</span>
              <span className="font-semibold text-texto">{paciente.genero}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Atenção necessária</span>
              {ultimaMedicao ? <StatusIcon status={ultimaMedicao.status} showLabel /> : <span>Sem dados</span>}
            </li>
          </ul>
        </Card>

        {chartData.length > 0 ? (
          <Card className="mb-4">
            <p className="mb-3 text-sm font-bold text-primaria-escura">Histórico de medições</p>
            <PacienteChart data={chartData} />
          </Card>
        ) : null}

        <div>
          <h2 className="mb-2 text-sm font-bold text-primaria-escura">Últimas medições</h2>
          {medicoes.length === 0 ? (
            <Card>
              <p className="text-sm text-texto/60">Nenhuma medição registrada.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {medicoes.slice(0, 5).map((medicao) => (
                <Card key={medicao.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={medicao.status} />
                      <div>
                        <p className="text-sm font-bold text-primaria-escura">
                          {medicao.sistolica}/{medicao.diastolica} mmHg
                        </p>
                        <p className="text-xs text-texto/60">Glicemia: {medicao.glicemia} mg/dL</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-texto/50">{formatDateTime(medicao.createdAt)}</p>
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
