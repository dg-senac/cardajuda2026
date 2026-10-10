"use client";

import { useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import StatusIcon from "@/components/StatusIcon";
import { createMedicaoAction } from "@/lib/actions/medicoes";
import { formatDateTime } from "@/lib/validations";
import type { Medicao } from "@/types";

export default function SaudeClient({ medicoes }: { medicoes: Medicao[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createMedicaoAction(formData);
      if (!result.success) {
        setError(result.error ?? "Não foi possível registrar.");
        toast.error(result.error ?? "Não foi possível registrar.");
        return;
      }
      toast.success("Medição registrada com sucesso!");
      formRef.current?.reset();
    });
  }

  function handleClear() {
    formRef.current?.reset();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="animate-fade-in rounded-2xl bg-white p-5 shadow-[0_4px_12px_rgba(139,0,139,0.15)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-primaria-escura">Registrar medição</h2>
          <button
            type="button"
            onClick={handleClear}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-fundo-rosa text-sm font-bold text-primaria"
            aria-label="Limpar campos"
          >
            ✕
          </button>
        </div>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Sistólica (mmHg)" type="number" name="sistolica" placeholder="120" required />
            <Input label="Diastólica (mmHg)" type="number" name="diastolica" placeholder="80" required />
          </div>
          <Input label="Glicemia (mg/dL)" type="number" name="glicemia" placeholder="90" required />

          {error ? <p className="text-xs font-semibold text-status-alerta">{error}</p> : null}

          <Button type="submit" loading={isPending}>
            Salvar medição
          </Button>
        </form>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-primaria-escura">Últimas medições</h2>
        {medicoes.length === 0 ? (
          <Card>
            <p className="text-sm text-texto/60">Você ainda não registrou nenhuma medição.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {medicoes.map((medicao) => (
              <Card key={medicao.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={medicao.status} />
                    <div>
                      <p className="text-sm font-bold text-primaria-escura">
                        {medicao.sistolica}/{medicao.diastolica} mmHg
                      </p>
                      <p className="text-xs text-texto/60">Glicemia: {medicao.glicemia} mg/dL</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-texto/50">{formatDateTime(medicao.createdAt)}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
