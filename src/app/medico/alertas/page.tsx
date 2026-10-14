import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import SectionTitle from "@/components/SectionTitle";
import { requireProfile } from "@/lib/actions/auth";
import { listAlertas, listPendenciasComPaciente } from "@/lib/queries";
import { timeAgo } from "@/lib/validations";
import PendenciaItem from "./PendenciaItem";

export const dynamic = "force-dynamic";

const ALERTA_CORES: Record<string, { border: string; bg: string; text: string; label: string }> = {
  alerta: {
    border: "border-l-status-alerta",
    bg: "bg-status-alerta-claro",
    text: "text-status-alerta",
    label: "Alerta",
  },
  pendente: {
    border: "border-l-status-atencao",
    bg: "bg-status-atencao-claro",
    text: "text-status-atencao",
    label: "Pendente",
  },
  em_dia: {
    border: "border-l-status-normal",
    bg: "bg-status-normal-claro",
    text: "text-status-normal",
    label: "Em dia",
  },
};

export default async function MedicoAlertasPage() {
  const profile = await requireProfile();
  const [alertas, nomesPendencias] = await Promise.all([
    listAlertas(),
    listPendenciasComPaciente(profile.id),
  ]);

  const alertasAtivos = alertas.filter((a) => a.status === "alerta");
  const pendentes = nomesPendencias.filter((p) => !p.concluida);
  const emDia = alertas.filter((a) => a.status === "em_dia").length;


  return (
    <>
      <Header
        title="Alertas e pendências"
        subtitle="Priorize o que precisa de atenção"
        avatarName={profile.nome}
        avatarHref="/medico/perfil"
      />
      <main className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-status-alerta/25 bg-status-alerta-claro px-3 py-3 text-center">
            <p className="text-xl font-extrabold text-status-alerta">{alertasAtivos.length}</p>
            <p className="text-[10.5px] font-semibold text-texto-suave">Alertas</p>
          </div>
          <div className="rounded-2xl border border-status-atencao/25 bg-status-atencao-claro px-3 py-3 text-center">
            <p className="text-xl font-extrabold text-status-atencao">{pendentes.length}</p>
            <p className="text-[10.5px] font-semibold text-texto-suave">Pendências</p>
          </div>
          <div className="rounded-2xl border border-status-normal/25 bg-status-normal-claro px-3 py-3 text-center">
            <p className="text-xl font-extrabold text-status-normal">{emDia}</p>
            <p className="text-[10.5px] font-semibold text-texto-suave">Em dia</p>
          </div>
        </div>

        <div className="mb-5">
          <SectionTitle>Alertas recentes</SectionTitle>
          {alertas.length === 0 ? (
            <EmptyState icon="bell" title="Nenhum alerta registrado" description="Tudo em dia por aqui." />
          ) : (
            <div className="flex flex-col gap-2">
              {alertas.slice(0, 6).map((alerta) => {
                const cores = ALERTA_CORES[alerta.status] ?? ALERTA_CORES.em_dia;
                return (
                  <div
                    key={alerta.id}
                    className={`rounded-2xl border border-borda border-l-4 bg-white p-3.5 shadow-card ${cores.border}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cores.bg} ${cores.text}`}
                      >
                        <Icon name="alert" size={15} />
                      </span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-primaria-escura">{alerta.titulo}</p>
                          <span className={`shrink-0 text-[9.5px] font-extrabold uppercase ${cores.text}`}>
                            {cores.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-texto-suave">{alerta.descricao}</p>
                        <p className="mt-1 text-[10.5px] text-texto-suave/70">{timeAgo(alerta.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <SectionTitle>Pendências</SectionTitle>
          {nomesPendencias.length === 0 ? (
            <EmptyState icon="check" title="Nenhuma pendência" description="Você está com tudo em dia!" />
          ) : (
            <div className="flex flex-col gap-2">
              {nomesPendencias.map((pendencia) => (
                <PendenciaItem key={pendencia.id} pendencia={pendencia} />
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav role="medico" />
    </>
  );
}
