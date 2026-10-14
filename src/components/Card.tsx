import type { ReactNode } from "react";

interface CardProps {
  variant?: "default" | "primary" | "muted";
  hover?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

const VARIANTS: Record<string, string> = {
  default: "bg-white text-texto border border-borda",
  primary: "bg-gradient-to-br from-primaria to-primaria-escura text-white border border-primaria-escura",
  muted: "bg-fundo-rosa text-texto border border-borda",
};

export default function Card({
  variant = "default",
  hover = false,
  onClick,
  className = "",
  children,
}: CardProps) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={`w-full rounded-2xl p-4 text-left shadow-card transition-all duration-200 ${VARIANTS[variant]} ${
        hover || onClick
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.98]"
          : ""
      } ${className}`}
    >
      {children}
    </Component>
  );
}
