"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { updateConsultaStatusAction } from "@/lib/actions/consultas";

export default function ConsultaActions({ consultaId }: { consultaId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handle(status: "realizada" | "cancelada") {
    startTransition(async () => {
      const result = await updateConsultaStatusAction(consultaId, status);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível atualizar.");
        return;
      }
      toast.success(status === "realizada" ? "Consulta marcada como realizada." : "Consulta cancelada.");
      router.refresh();
    });
  }

  return (
    <div className="mt-2 flex gap-2">
      <button
        disabled={isPending}
        onClick={() => handle("realizada")}
        className="flex-1 rounded-full bg-status-normal px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
      >
        Marcar realizada
      </button>
      <button
        disabled={isPending}
        onClick={() => handle("cancelada")}
        className="flex-1 rounded-full bg-status-alerta px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
      >
        Cancelar
      </button>
    </div>
  );
}
