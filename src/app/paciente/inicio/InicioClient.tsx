"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Card from "@/components/Card";
import Button, { ButtonLink } from "@/components/Button";
import Icon from "@/components/Icon";
import Modal from "@/components/Modal";
import SectionTitle from "@/components/SectionTitle";
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
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Card hover onClick={() => setModal("lembretes")} className="flex flex-col gap-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primaria/10 text-primaria">
            <Icon name="clock" size={20} />
          </span>
          <p className="text-sm font-bold text-primaria-escura">Lembretes</p>
          <p className="text-xs text-texto-suave">{lembretes.length} ativo(s)</p>
        </Card>
        <Card hover onClick={() => setModal("info")} className="flex flex-col gap-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-atencao/15 text-status-atencao">
            <Icon name="lightbulb" size={20} />
          </span>
          <p className="text-sm font-bold text-primaria-escura">Dica do dia</p>
          <p className="text-xs text-texto-suave">Dicas para seu coração</p>
        </Card>
      </div>

      <div>
        <SectionTitle>Cardápio de {diaSemana.toLowerCase()}</SectionTitle>
        <Card variant="primary" className="shadow-[0_8px_24px_rgba(139,0,139,0.35)]">
          {cardapio.length === 0 ? (
            <p className="text-sm text-white/90">Nenhum cardápio cadastrado para hoje.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cardapio.map((item) => (
                <li key={item.id} className="rounded-xl bg-white/12 px-3 py-2.5">
                  <p className="text-sm font-bold">{item.refeicao}</p>
                  <p className="text-xs leading-relaxed text-white/85">{item.descricao}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div>
        <SectionTitle>Seu plano</SectionTitle>
        <Card>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primaria/10 text-primaria">
                <Icon name="wallet" size={20} />
              </span>
              <div>
                <p className="text-sm font-bold text-primaria-escura">{assinatura?.planoNome ?? "Nenhum plano ativo"}</p>
                <p className="text-xs text-texto-suave">
                  {assinatura ? "Assinatura vigente" : "Escolha um plano para aproveitar tudo"}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="w-full shrink-0 !px-4 !py-2 text-xs sm:w-auto sm:max-w-fit"
              onClick={() => setModal("planos")}
            >
              {assinatura ? "Mudar" : "Assinar"}
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Atalhos</SectionTitle>
        <div className="flex flex-col gap-2.5">
          <ButtonLink href="/paciente/historico-consultas" variant="secondary" className="!justify-between !rounded-2xl">
            <span className="flex items-center gap-3">
              <Icon name="clipboard" size={19} />
              Histórico de consultas
            </span>
            <Icon name="chevron-right" size={17} />
          </ButtonLink>
          <ButtonLink href="/paciente/medicos" variant="secondary" className="!justify-between !rounded-2xl">
            <span className="flex items-center gap-3">
              <Icon name="stethoscope" size={19} />
              Médicos disponíveis
            </span>
            <Icon name="chevron-right" size={17} />
          </ButtonLink>
        </div>
      </div>

      <Modal open={modal === "lembretes"} title="Lembretes diários" onClose={() => setModal(null)}>
        {lembretes.length === 0 ? (
          <p className="text-sm text-texto-suave">Você ainda não tem lembretes cadastrados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lembretes.map((lembrete) => (
              <li
                key={lembrete.id}
                className="flex items-center gap-3 rounded-2xl border border-borda bg-fundo-rosa px-3 py-2.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primaria">
                  <Icon name="clock" size={17} />
                </span>
                <div>
                  <p className="text-sm font-bold text-primaria-escura">{lembrete.horario}</p>
                  <p className="text-xs text-texto-suave">{lembrete.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal open={modal === "info"} title="Dica de saúde do dia" onClose={() => setModal(null)}>
        <div className="flex items-start gap-3 rounded-2xl bg-status-atencao-claro px-4 py-4">
          <span className="mt-0.5 text-status-atencao">
            <Icon name="lightbulb" size={22} />
          </span>
          <p className="text-sm leading-relaxed text-texto">{dicaDoDia()}</p>
        </div>
      </Modal>

      <Modal open={modal === "planos"} title="Planos disponíveis" onClose={() => setModal(null)}>
        <div className="flex flex-col gap-2.5">
          {planos.map((plano) => (
            <div
              key={plano.id}
              className={`flex flex-col items-start gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                assinatura?.planoId === plano.id ? "border-primaria bg-primaria/5" : "border-borda bg-white"
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-bold text-primaria-escura">{plano.nome}</p>
                <p className="text-xs text-texto-suave">{plano.descricao}</p>
                <p className="mt-1 text-sm font-extrabold text-primaria">
                  R$ {plano.preco.toFixed(2)}
                  <span className="text-xs font-semibold text-texto-suave">/mês</span>
                </p>
              </div>
              <Button
                className="w-full shrink-0 !px-4 !py-2 text-xs sm:w-auto sm:max-w-fit"
                loading={isPending}
                onClick={() => handleAssinar(plano.id)}
              >
                {assinatura?.planoId === plano.id ? "Atual" : "Assinar"}
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
