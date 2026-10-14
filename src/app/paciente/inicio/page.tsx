import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { requireProfile } from "@/lib/actions/auth";
import {
  getAssinaturaAtual,
  getCardapioDoDia,
  getDiaSemanaAtual,
  listLembretesByPaciente,
  listPlanos,
} from "@/lib/queries";
import InicioClient from "./InicioClient";

export const dynamic = "force-dynamic";

export default async function PacienteInicioPage() {
  const profile = await requireProfile();
  const diaSemana = getDiaSemanaAtual();

  const [cardapio, lembretes, assinatura, planos] = await Promise.all([
    getCardapioDoDia(diaSemana),
    listLembretesByPaciente(profile.id),
    getAssinaturaAtual(profile.id),
    listPlanos(),
  ]);

  const dataFormatada = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <Header avatarName={profile.nome} avatarHref="/paciente/perfil" />
      <main className="flex-1 px-4 pb-6 pt-5">
        <div className="mb-5 animate-fade-in">
          <p className="text-xs font-semibold capitalize text-texto-suave">{dataFormatada}</p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-primaria-escura">
            Olá, {profile.nome.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-texto-suave">Cuide do seu coração todos os dias.</p>
        </div>

        <InicioClient
          diaSemana={diaSemana}
          cardapio={cardapio}
          lembretes={lembretes}
          assinatura={assinatura}
          planos={planos}
        />
      </main>
      <BottomNav role="paciente" />
    </>
  );
}
