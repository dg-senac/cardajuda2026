import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import Icon from "@/components/Icon";
import SectionTitle from "@/components/SectionTitle";
import { requireProfile } from "@/lib/actions/auth";
import { listConsultasByMedico, listTriagensByMedico, listAlertas } from "@/lib/queries";

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

  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <Header avatarName={profile.nome} avatarHref="/medico/perfil" />
      <main className="flex-1 px-4 pb-6 pt-5">
        <div className="mb-5 animate-fade-in">
          <p className="text-xs font-semibold capitalize text-texto-suave">{dataFormatada}</p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-primaria-escura">Bem-vindo(a), Doutor(a)</h1>
          <p className="mt-1 text-sm text-texto-suave">Dr(a). {profile.nome}</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <Link href="/medico/consultas" className="block">
            <Card variant="primary" hover className="shadow-[0_8px_24px_rgba(139,0,139,0.35)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <Icon name="calendar" size={20} />
              </span>
              <p className="mt-2 text-sm font-bold">Consultas hoje</p>
              <p className="text-2xl font-extrabold">{consultasHoje}</p>
            </Card>
          </Link>
          <Link href="/medico/pacientes" className="block">
            <Card variant="primary" hover className="shadow-[0_8px_24px_rgba(139,0,139,0.35)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <Icon name="clipboard" size={20} />
              </span>
              <p className="mt-2 text-sm font-bold">Triagens</p>
              <p className="text-2xl font-extrabold">{triagens.length}</p>
            </Card>
          </Link>
        </div>

        <SectionTitle>Acesso rápido</SectionTitle>
        <div className="flex flex-col gap-2.5">
          <Link href="/medico/alertas" className="block">
            <Card hover className="!flex !items-center !gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  alertasAtivos > 0 ? "bg-status-alerta-claro text-status-alerta" : "bg-primaria/10 text-primaria"
                }`}
              >
                <Icon name="bell" size={19} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-primaria-escura">Alertas dos pacientes</p>
                <p className="text-xs text-texto-suave">
                  {alertasAtivos > 0
                    ? `${alertasAtivos} paciente(s) precisam de atenção`
                    : "Veja a situação dos seus pacientes"}
                </p>
              </div>
              <Icon name="chevron-right" size={17} className="text-texto-suave" />
            </Card>
          </Link>
          <Link href="/medico/historico" className="block">
            <Card hover className="!flex !items-center !gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaria/10 text-primaria">
                <Icon name="clock" size={19} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-primaria-escura">Histórico de consultas</p>
                <p className="text-xs text-texto-suave">Visualize suas últimas consultas realizadas</p>
              </div>
              <Icon name="chevron-right" size={17} className="text-texto-suave" />
            </Card>
          </Link>
          <Link href="/medico/perfil" className="block">
            <Card hover className="!flex !items-center !gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaria/10 text-primaria">
                <Icon name="star" size={19} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-primaria-escura">Meu perfil profissional</p>
                <p className="text-xs text-texto-suave">Dados profissionais e preferências</p>
              </div>
              <Icon name="chevron-right" size={17} className="text-texto-suave" />
            </Card>
          </Link>
        </div>
      </main>
      <BottomNav role="medico" />
    </>
  );
}
