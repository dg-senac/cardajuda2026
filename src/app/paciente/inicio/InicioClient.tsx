"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { assinarPlanoAction } from "@/lib/actions/misc";
import type { Assinatura, CardapioItem, Lembrete, Plano } from "@/types";

const DICAS = [
  "Beba pelo menos 2 litros de água por dia para ajudar seu coração a bombear sangue com mais facilidade.",
  "Reduza o consumo de sal: o excesso está diretamente ligado à pressão alta.",
  "30 minutos de caminhada por dia reduzem significativamente o risco cardiovascular.",
  "Durma de 7 a 8 horas por noite. O sono ruim está associado a arritmias e hipertensão.",
  "Evite o cigarro: ele é um dos principais fatores de risco para doenças do coração.",
  "Inclua frutas, verduras e grãos integrais na sua alimentação diária.",
  "Controle o estresse com respiração profunda, meditação ou atividades relaxantes.",
];

function dicaDoDia(): string {
  const dayIndex = new Date().getDate() % DICAS.length;
  return DICAS[dayIndex];
}

interface InicioClientProps {
  diaSemana: string;
  cardapio: CardapioItem[];
  lembretes: Lembrete[];
  assinatura: (Assinatura & { planoNome?: string }) | null;
  planos: Plano[];
}

export default function InicioClient({ diaSemana, cardapio, lembretes, assinatura, planos }: InicioClientProps) {
  const [modal, setModal] = useState<"lembretes" | "info" | "planos" | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssinar(planoId: string) {
    startTransition(async () => {
      const result = await assinarPlanoAction(planoId);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível assinar o plano.");
        return;
      }
      toast.success("Plano atualizado com sucesso!");
      setModal(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setModal("lembretes")} className="text-left">
          <Card hover>
            <p className="text-2xl">⏰</p>
            <p className="mt-1 text-sm font-bold text-primaria-escura">Lembretes</p>
            <p className="text-xs text-texto/60">{lembretes.length} ativo(s)</p>
          </Card>
        </button>
        <button onClick={() => setModal("info")} className="text-left">
          <Card hover>
            <p className="text-2xl">💡</p>
            <p className="mt-1 text-sm font-bold text-primaria-escura">Dica do dia</p>
            <p className="text-xs text-texto/60">Informações de saúde</p>
          </Card>
        </button>
      </div>

      <Card variant="primary">
        <p className="text-xs uppercase tracking-wide text-white/70">Cardápio de {diaSemana}</p>
        {cardapio.length === 0 ? (
          <p className="mt-2 text-sm text-white/90">Nenhum cardápio cadastrado para hoje.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {cardapio.map((item) => (
              <li key={item.id} className="rounded-xl bg-white/10 px-3 py-2">
                <p className="text-sm font-bold">{item.refeicao}</p>
                <p className="text-xs text-white/85">{item.descricao}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-primaria-escura/70">Seu plano</p>
            <p className="text-base font-bold text-primaria-escura">{assinatura?.planoNome ?? "Nenhum plano ativo"}</p>
          </div>
          <Button variant="secondary" className="w-auto px-4 py-2 text-xs" onClick={() => setModal("planos")}>
            {assinatura ? "Mudar plano" : "Assinar plano"}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        <Link href="/paciente/historico-consultas">
          <Card hover>
            <p className="text-sm font-bold text-primaria-escura">📋 Histórico de consultas</p>
            <p className="text-xs text-texto/60">Veja suas consultas anteriores</p>
          </Card>
        </Link>
        <Link href="/paciente/medicos">
          <Card hover>
            <p className="text-sm font-bold text-primaria-escura">👨‍⚕️ Médicos disponíveis</p>
            <p className="text-xs text-texto/60">Conheça nossos profissionais</p>
          </Card>
        </Link>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-0 sm:items-center" onClick={() => setModal(null)}>
          <div
            className="w-full max-w-md animate-fade-in rounded-t-3xl bg-white p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {modal === "lembretes" ? (
              <>
                <h2 className="mb-3 text-base font-extrabold text-primaria-escura">Lembretes diários</h2>
                {lembretes.length === 0 ? (
                  <p className="text-sm text-texto/60">Você ainda não tem lembretes cadastrados.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {lembretes.map((lembrete) => (
                      <li key={lembrete.id} className="rounded-xl bg-fundo-rosa px-3 py-2 text-sm">
                        <span className="font-bold text-primaria-escura">{lembrete.horario}</span> — {lembrete.texto}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}

            {modal === "info" ? (
              <>
                <h2 className="mb-3 text-base font-extrabold text-primaria-escura">Dica de saúde do dia</h2>
                <p className="text-sm text-texto/80">{dicaDoDia()}</p>
              </>
            ) : null}

            {modal === "planos" ? (
              <>
                <h2 className="mb-3 text-base font-extrabold text-primaria-escura">Planos disponíveis</h2>
                <div className="flex flex-col gap-2">
                  {planos.map((plano) => (
                    <div key={plano.id} className="flex items-center justify-between rounded-xl bg-fundo-rosa px-3 py-2">
                      <div>
                        <p className="text-sm font-bold text-primaria-escura">{plano.nome}</p>
                        <p className="text-xs text-texto/60">{plano.descricao}</p>
                        <p className="text-xs font-semibold text-primaria">R$ {plano.preco.toFixed(2)}/mês</p>
                      </div>
                      <Button
                        className="w-auto px-3 py-1.5 text-xs"
                        disabled={isPending}
                        onClick={() => handleAssinar(plano.id)}
                      >
                        Assinar
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <Button variant="secondary" className="mt-4" onClick={() => setModal(null)}>
              Fechar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
