"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Card from "@/components/Card";
import { togglePendenciaAction } from "@/lib/actions/misc";
import type { Pendencia } from "@/types";

export default function PendenciaItem({ pendencia }: { pendencia: Pendencia & { pacienteNome: string } }) {
  const [concluida, setConcluida] = useState(pendencia.concluida);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !concluida;
    setConcluida(next);
    startTransition(async () => {
      const result = await togglePendenciaAction(pendencia.id, next);
      if (!result.success) {
        setConcluida(!next);
        toast.error(result.error ?? "Não foi possível atualizar.");
      }
    });
  }

  return (
    <Card className={`!p-3.5 transition-opacity ${concluida ? "opacity-60" : ""}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={concluida}
          onChange={handleToggle}
          disabled={isPending}
          className="mt-0.5 h-4.5 w-4.5 accent-[var(--color-primaria)]"
        />
        <div>
          <p className={`text-sm font-bold ${concluida ? "text-texto-suave line-through" : "text-primaria-escura"}`}>
            {pendencia.titulo}
          </p>
          <p className="text-xs text-texto-suave">{pendencia.pacienteNome}</p>
        </div>
      </label>
    </Card>
  );
}
