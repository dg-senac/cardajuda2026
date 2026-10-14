import Header from "@/components/Header";
import SectionTitle from "@/components/SectionTitle";
import { ButtonLink } from "@/components/Button";
import Icon from "@/components/Icon";
import { requireProfile } from "@/lib/actions/auth";
import { listConsultasByMedico, listTriagensByMedico } from "@/lib/queries";
import { formatDate } from "@/lib/validations";
import HistoricoSearch from "./HistoricoSearch";

export const dynamic = "force-dynamic";

export default async function MedicoHistoricoPage() {
  const profile = await requireProfile();
  const [consultas, triagens] = await Promise.all([
    listConsultasByMedico(profile.id),
    listTriagensByMedico(profile.id),
  ]);

  const items = [
    ...consultas.map((c) => ({
      id: c.id,
      tipo: "Consulta" as const,
      nome: c.nomePaciente,
      data: c.data,
      horario: c.horario,
      detalhe: `${c.especialidade} — ${c.status}`,
    })),
    ...triagens.map((t) => ({
      id: t.id,
      tipo: "Triagem" as const,
      nome: t.nomePaciente,
      data: t.data,
      horario: t.horario,
      detalhe: `Classificação: ${t.classificacao}`,
    })),
  ].sort((a, b) => (a.data < b.data ? 1 : -1));

  return (
    <>
      <Header title="Histórico" subtitle="Consultas e triagens realizadas" backHref="/medico/consultas" />
      <main className="flex-1 px-4 pb-8 pt-4">
        <HistoricoSearch items={items.map((i) => ({ ...i, dataFormatada: formatDate(i.data) }))} />

        <div className="mt-6">
          <SectionTitle>Registrar novo atendimento</SectionTitle>
          <div className="flex flex-col gap-2.5">
            <ButtonLink href="/medico/nova-triagem">
              <Icon name="stethoscope" size={18} />
              Nova triagem
            </ButtonLink>
            <ButtonLink href="/medico/nova-consulta" variant="secondary">
              <Icon name="plus" size={18} />
              Nova consulta
            </ButtonLink>
          </div>
        </div>
      </main>
    </>
  );
}
