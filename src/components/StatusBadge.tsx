import type {
  ClassificacaoTriagem,
  StatusAlerta,
  StatusConsulta,
  StatusMedicao,
} from "@/types";

type AnyStatus = StatusConsulta | StatusMedicao | ClassificacaoTriagem | StatusAlerta;

const CONFIG: Record<AnyStatus, { label: string; className: string }> = {
  /* Consultas */
  agendada: { label: "Agendada", className: "bg-status-atencao-claro text-status-atencao" },
  realizada: { label: "Realizada", className: "bg-status-normal-claro text-status-normal" },
  cancelada: { label: "Cancelada", className: "bg-status-alerta-claro text-status-alerta" },
  /* Medições */
  normal: { label: "Normal", className: "bg-status-normal-claro text-status-normal" },
  atencao: { label: "Atenção", className: "bg-status-atencao-claro text-status-atencao" },
  alerta: { label: "Alerta", className: "bg-status-alerta-claro text-status-alerta" },
  /* Triagem */
  verde: { label: "Verde", className: "bg-status-normal-claro text-status-normal" },
  amarela: { label: "Amarela", className: "bg-status-atencao-claro text-status-atencao" },
  vermelha: { label: "Vermelha", className: "bg-status-alerta-claro text-status-alerta" },
  /* Alertas */
  pendente: { label: "Pendente", className: "bg-status-atencao-claro text-status-atencao" },
  em_dia: { label: "Em dia", className: "bg-status-normal-claro text-status-normal" },
};

export default function StatusBadge({ status, className = "" }: { status: AnyStatus; className?: string }) {
  const config = CONFIG[status] ?? CONFIG.normal;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}
