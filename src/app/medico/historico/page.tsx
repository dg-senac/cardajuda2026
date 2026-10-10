import Link from "next/link";
import Header from "@/components/Header";
import Card from "@/components/Card";
import Button from "@/components/Button";
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
      <Header title="Histórico" backHref="/medico/consultas" />
      <main className="flex-1 px-4 pb-8 pt-4">
        <HistoricoSearch items={items.map((i) => ({ ...i, dataFormatada: formatDate(i.data) }))} />

        <div className="mt-4 flex flex-col gap-3">
          <Link href="/medico/nova-triagem">
            <Button>Nova Triagem</Button>
          </Link>
          <Link href="/medico/nova-consulta">
            <Button>Nova Consulta</Button>
          </Link>
        </div>

        {items.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-texto/60">Nenhum registro encontrado.</p>
          </Card>
        ) : null}
      </main>
    </>
  );
}
