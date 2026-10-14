import type { ReactNode } from "react";
import Icon, { type IconName } from "@/components/Icon";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function EmptyState({ icon = "sparkles", title, description, children }: EmptyStateProps) {
  return (
    <div className="flex animate-fade-in flex-col items-center gap-2 rounded-2xl border border-dashed border-borda-forte bg-white/70 px-6 py-9 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primaria/10 text-primaria">
        <Icon name={icon} size={24} />
      </span>
      <p className="text-sm font-bold text-primaria-escura">{title}</p>
      {description ? <p className="max-w-[15rem] text-xs leading-relaxed text-texto-suave">{description}</p> : null}
      {children ? <div className="mt-2 w-full max-w-[14rem]">{children}</div> : null}
    </div>
  );
}
