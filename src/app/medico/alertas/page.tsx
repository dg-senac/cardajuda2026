import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import { requireProfile } from "@/lib/actions/auth";
import { getPacienteById, listAlertas, listPendenciasByMedico } from "@/lib/queries";
import { timeAgo } from "@/lib/validations";
import PendenciaItem from "./PendenciaItem";

export const dynamic = "force-dynamic";

export default async function MedicoAlertasPage() {
  const profile = await requireProfile();
  const [alertas, pendencias] = await Promise.all([listAlertas(), listPendenciasByMedico(profile.id)]);

  const alertasAtivos = alertas.filter((a) => a.status === "alerta");
  const pendentes = pendencias.filter((p) => !p.concluida);
  const emDia = alertas.filter((a) => a.status === "em_dia").length;

  const nomesPendencias = await Promise.all(
    pendencias.map(async (p) => ({ ...p, pacienteNome: (await getPacienteById(p.pacienteId))?.nome ?? "Paciente" })),
  );

  return (
    <>
      <Header title="Alertas e pendências" subtitle="Priorize o que precisa de atenção" avatarName={profile.nome} avatarHref="/medico/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <Card variant="primary" className="py-3">
            <p className="text-xl font-extrabold">{alertasAtivos.length}</p>
            <p className="text-[11px] text-white/80">Alertas</p>
          </Card>
          <Card className="py-3">
            <p className="text-xl font-extrabold text-primaria-escura">{pendentes.length}</p>
            <p className="text-[11px] text-texto/60">Pendências</p>
          </Card>
          <Card className="py-3">
            <p className="text-xl font-extrabold text-status-normal">{emDia}</p>
            <p className="text-[11px] text-texto/60">Em dia</p>
          </Card>
        </div>

        <h2 className="mb-2 text-sm font-bold text-primaria-escura">Alertas recentes</h2>
        {alertas.length === 0 ? (
          <Card className="mb-4">
            <p className="text-sm text-texto/60">Nenhum alerta registrado.</p>
          </Card>
        ) : (
          <div className="mb-4 flex flex-col gap-2">
            {alertas.slice(0, 6).map((alerta) => (
              <Card key={alerta.id}>
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      backgroundColor:
                        alerta.status === "alerta"
                          ? "var(--color-status-alerta)"
                          : alerta.status === "pendente"
                            ? "var(--color-status-atencao)"
                            : "var(--color-status-normal)",
                    }}
                  >
                    !
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-primaria-escura">{alerta.titulo}</p>
                    <p className="text-xs text-texto/60">{alerta.descricao}</p>
                    <p className="text-[11px] text-texto/40">{timeAgo(alerta.createdAt)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <h2 className="mb-2 text-sm font-bold text-primaria-escura">Pendências</h2>
        {nomesPendencias.length === 0 ? (
          <Card>
            <p className="text-sm text-texto/60">Você não possui pendências cadastradas.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {nomesPendencias.map((pendencia) => (
              <PendenciaItem key={pendencia.id} pendencia={pendencia} />
            ))}
          </div>
        )}
      </main>
      <BottomNav role="medico" />
    </>
  );
}
