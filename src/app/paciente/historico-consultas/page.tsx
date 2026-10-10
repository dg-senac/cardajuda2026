import Header from "@/components/Header";
import Card from "@/components/Card";
import { requireProfile } from "@/lib/actions/auth";
import { listConsultasByPaciente } from "@/lib/queries";
import { formatDate } from "@/lib/validations";

export const dynamic = "force-dynamic";

export default async function HistoricoConsultasPage() {
  const profile = await requireProfile();
  const consultas = await listConsultasByPaciente(profile.id);

  return (
    <>
      <Header title="Histórico" backHref="/paciente/inicio" />
      <main className="flex-1 px-4 pb-8 pt-4">
        {consultas.length === 0 ? (
          <Card>
            <p className="text-sm text-texto/60">Nenhuma consulta registrada ainda.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {consultas.map((consulta) => (
              <Card key={consulta.id}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-primaria-escura">{consulta.profissional}</p>
                  <span className="text-xs font-semibold capitalize text-texto/60">{consulta.status}</span>
                </div>
                <p className="mt-1 text-xs text-texto/70">{consulta.especialidade}</p>
                <p className="mt-1 text-xs text-texto/70">
                  {formatDate(consulta.data)} às {consulta.horario}
                </p>
                <p className="mt-1 text-xs text-texto/70">Motivo: {consulta.motivo}</p>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
