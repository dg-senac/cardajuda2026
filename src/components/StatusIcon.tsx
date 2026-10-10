import type { StatusMedicao } from "@/types";

const CONFIG: Record<StatusMedicao, { icon: string; bg: string; label: string }> = {
  normal: { icon: "✓", bg: "var(--color-status-normal)", label: "Normal" },
  atencao: { icon: "⚠", bg: "var(--color-status-atencao)", label: "Atenção" },
  alerta: { icon: "!", bg: "var(--color-status-alerta)", label: "Alerta" },
};

export default function StatusIcon({
  status,
  showLabel = false,
  size = 28,
}: {
  status: StatusMedicao;
  showLabel?: boolean;
  size?: number;
}) {
  const config = CONFIG[status];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="flex items-center justify-center rounded-full font-bold text-white"
        style={{ backgroundColor: config.bg, width: size, height: size, fontSize: size * 0.55 }}
        aria-label={config.label}
      >
        {config.icon}
      </span>
      {showLabel ? (
        <span className="text-xs font-semibold" style={{ color: config.bg }}>
          {config.label}
        </span>
      ) : null}
    </span>
  );
}
