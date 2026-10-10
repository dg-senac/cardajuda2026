import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { requireProfile } from "@/lib/actions/auth";
import { listConsultasByPaciente } from "@/lib/queries";
import { formatDate } from "@/lib/validations";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

const STATUS_COLOR: Record<string, string> = {
  agendada: "var(--color-status-atencao)",
  realizada: "var(--color-status-normal)",
  cancelada: "var(--color-status-alerta)",
};

export default async function PacienteConsultasPage() {
  const profile = await requireProfile();
  const consultas = await listConsultasByPaciente(profile.id);
  const agendadas = consultas.filter((c) => c.status === "agendada");

  return (
    <>
      <Header title="Consultas" avatarName={profile.nome} avatarHref="/paciente/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <Link href="/paciente/nova-consulta">
          <Button className="mb-4">+ Agendar nova consulta</Button>
        </Link>

        <h2 className="mb-2 text-sm font-bold text-primaria-escura">Próximas consultas ({agendadas.length})</h2>

        {consultas.length === 0 ? (
          <Card>
            <p className="text-sm text-texto/60">Você ainda não possui consultas registradas.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {consultas.map((consulta) => (
              <Card key={consulta.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-primaria-escura">{consulta.profissional}</p>
                    <p className="text-xs text-texto/60">{consulta.especialidade}</p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                    style={{ backgroundColor: STATUS_COLOR[consulta.status] }}
                  >
                    {STATUS_LABEL[consulta.status]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-texto/70">
                  📅 {formatDate(consulta.data)} às {consulta.horario}
                </p>
                <p className="mt-1 text-xs text-texto/70">Motivo: {consulta.motivo}</p>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav role="paciente" />
    </>
  );
}
