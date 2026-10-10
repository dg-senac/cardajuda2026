import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import { requireProfile } from "@/lib/actions/auth";
import { listAlertas, listConsultasByMedico, listTriagensByMedico } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MedicoInicioPage() {
  const profile = await requireProfile();
  const [consultas, triagens, alertas] = await Promise.all([
    listConsultasByMedico(profile.id),
    listTriagensByMedico(profile.id),
    listAlertas(),
  ]);

  const hoje = new Date().toISOString().slice(0, 10);
  const consultasHoje = consultas.filter((c) => c.data === hoje && c.status === "agendada").length;
  const alertasAtivos = alertas.filter((a) => a.status === "alerta").length;

  return (
    <>
      <Header avatarName={profile.nome} avatarHref="/medico/perfil" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <h1 className="mb-1 text-lg font-extrabold text-primaria-escura">Bem-Vindo(a), Doutor(a)</h1>
        <p className="mb-4 text-sm text-texto/70">{profile.nome}</p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <Link href="/medico/consultas">
            <Card variant="primary" hover>
              <p className="text-2xl">📅</p>
              <p className="mt-1 text-sm font-bold">Consulta para hoje</p>
              <p className="text-xs text-white/80">{consultasHoje} agendada(s)</p>
            </Card>
          </Link>
          <Link href="/medico/pacientes">
            <Card variant="primary" hover>
              <p className="text-2xl">📋</p>
              <p className="mt-1 text-sm font-bold">Histórico de pacientes</p>
              <p className="text-xs text-white/80">{triagens.length} triagem(ns)</p>
            </Card>
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/medico/alertas">
            <Card hover>
              <p className="text-sm font-bold text-primaria-escura">🚨 Alerta do Paciente</p>
              <p className="text-xs text-texto/60">
                {alertasAtivos > 0 ? `${alertasAtivos} paciente(s) precisam de atenção` : "Veja a situação dos seus pacientes"}
              </p>
            </Card>
          </Link>
          <Link href="/medico/historico">
            <Card hover>
              <p className="text-sm font-bold text-primaria-escura">🕓 Histórico de consultas</p>
              <p className="text-xs text-texto/60">Visualize suas últimas consultas realizadas</p>
            </Card>
          </Link>
          <Link href="/medico/perfil">
            <Card hover>
              <p className="text-sm font-bold text-primaria-escura">⭐ Planos e Assinaturas</p>
              <p className="text-xs text-texto/60">Gerencie seus planos e assinaturas</p>
            </Card>
          </Link>
        </div>
      </main>
      <BottomNav role="medico" />
    </>
  );
}
