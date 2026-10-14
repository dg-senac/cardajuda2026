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
    <div className="mt-3 flex gap-2">
      <button
        disabled={isPending}
        onClick={() => handle("realizada")}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-status-normal px-3 py-2 text-[11px] font-bold text-white transition hover:brightness-95 disabled:opacity-60 active:scale-[0.98]"
      >
        Marcar realizada
      </button>
      <button
        disabled={isPending}
        onClick={() => handle("cancelada")}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-status-alerta/30 bg-white px-3 py-2 text-[11px] font-bold text-status-alerta transition hover:bg-status-alerta-claro disabled:opacity-60 active:scale-[0.98]"
      >
        Cancelar
      </button>
    </div>
  );
}
