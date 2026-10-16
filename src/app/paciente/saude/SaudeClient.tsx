"use client";

import { useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import Input from "@/components/Input";
import SectionTitle from "@/components/SectionTitle";
import StatusBadge from "@/components/StatusBadge";
import StatusIcon from "@/components/StatusIcon";
import { createMedicaoAction } from "@/lib/actions/medicoes";
import { formatDateTime } from "@/lib/validations";
import type { Medicao } from "@/types";

export default function SaudeClient({ medicoes }: { medicoes: Medicao[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const ultima = medicoes[0] ?? null;

  const requestId = useRef<string>("");
  function handleSubmit(formData: FormData) {
    if (!requestId.current) requestId.current = crypto.randomUUID();
    formData.set("request_id", requestId.current);
    setError(null);
    startTransition(async () => {
      const result = await createMedicaoAction(formData);
      if (!result.success) {
        setError(result.error ?? "Não foi possível registrar.");
        toast.error(result.error ?? "Não foi possível registrar.");
        return;
      }
      requestId.current = "";
      toast.success("Medição registrada com sucesso!");
      formRef.current?.reset();
    });
  }

  function handleClear() {
    formRef.current?.reset();
    setError(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {ultima ? (
        <div className="animate-fade-in rounded-3xl border border-borda bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-primaria-escura">Última medição</h2>
            <StatusBadge status={ultima.status} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-fundo-rosa px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-texto-suave">
                Pressão arterial
              </p>
              <p className="mt-0.5 text-xl font-extrabold text-primaria-escura">
                {ultima.sistolica}/{ultima.diastolica}
                <span className="ml-1 text-xs font-semibold text-texto-suave">mmHg</span>
              </p>
            </div>
            <div className="rounded-2xl bg-fundo-rosa px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-texto-suave">Glicemia</p>
              <p className="mt-0.5 text-xl font-extrabold text-primaria-escura">
                {ultima.glicemia}
                <span className="ml-1 text-xs font-semibold text-texto-suave">mg/dL</span>
              </p>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] text-texto-suave">Registrada em {formatDateTime(ultima.createdAt)}</p>
        </div>
      ) : null}

      <div className="animate-fade-in rounded-3xl border border-borda bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-primaria-escura">Registrar medição</h2>
          <button
            type="button"
            onClick={handleClear}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-fundo-rosa text-primaria transition hover:bg-primaria/15 active:scale-95"
            aria-label="Limpar campos"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Sistólica (mmHg)" type="number" name="sistolica" placeholder="120" required />
            <Input label="Diastólica (mmHg)" type="number" name="diastolica" placeholder="80" required />
          </div>
          <Input label="Glicemia (mg/dL)" type="number" name="glicemia" placeholder="90" required />

          {error ? (
            <p className="rounded-xl bg-status-alerta-claro px-3 py-2 text-xs font-semibold text-status-alerta">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={isPending}>
            Salvar medição
          </Button>
        </form>
      </div>

      <div>
        <SectionTitle>Últimas medições</SectionTitle>
        {medicoes.length === 0 ? (
          <EmptyState
            icon="heart"
            title="Nenhuma medição registrada"
            description="Registre sua pressão e glicemia para acompanhar sua saúde."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {medicoes.map((medicao) => (
              <Card key={medicao.id} className="!p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={medicao.status} />
                    <div>
                      <p className="text-sm font-bold text-primaria-escura">
                        {medicao.sistolica}/{medicao.diastolica} mmHg
                      </p>
                      <p className="text-xs text-texto-suave">Glicemia: {medicao.glicemia} mg/dL</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-texto-suave">{formatDateTime(medicao.createdAt)}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
