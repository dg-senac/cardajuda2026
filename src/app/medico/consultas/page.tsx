import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import Button from "@/components/Button";
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

  const agendadas = consultas.filter((c) => c.status === "agendada");

  return (
    <>
      <Header title="Consultas" avatarName={profile.nome} avatarHref="/medico/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card variant="primary">
            <p className="text-2xl">🩺</p>
            <p className="mt-1 text-sm font-bold">Triagem</p>
            <p className="text-2xl font-extrabold">{triagens.length}</p>
            <p className="text-[11px] text-white/80">Atendimento de Triagem</p>
          </Card>
          <Card variant="primary">
            <p className="text-2xl">💜</p>
            <p className="mt-1 text-sm font-bold">Consulta</p>
            <p className="text-2xl font-extrabold">{agendadas.length}</p>
            <p className="text-[11px] text-white/80">Registro de Consulta</p>
          </Card>
        </div>

        <h2 className="mb-2 text-sm font-bold text-primaria-escura">Ações Rápidas</h2>
        <div className="flex flex-col gap-3">
          <Link href="/medico/nova-triagem">
            <Button>🩺 Atendimento de triagem</Button>
          </Link>
          <Link href="/medico/nova-consulta">
            <Button>❤️ Nova Consulta</Button>
          </Link>
          <Link href="/medico/historico">
            <Button variant="secondary">📜 Ver Histórico</Button>
          </Link>
        </div>

        {agendadas.length > 0 ? (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-bold text-primaria-escura">Próximas consultas</h2>
            <div className="flex flex-col gap-2">
              {agendadas.slice(0, 5).map((consulta) => (
                <Card key={consulta.id}>
                  <p className="text-sm font-bold text-primaria-escura">{consulta.nomePaciente}</p>
                  <p className="text-xs text-texto/60">
                    {formatDate(consulta.data)} às {consulta.horario} — {consulta.especialidade}
                  </p>
                  <ConsultaActions consultaId={consulta.id} />
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </main>
      <BottomNav role="medico" />
    </>
  );
}
