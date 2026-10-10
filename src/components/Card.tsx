import type { ReactNode } from "react";

interface CardProps {
  variant?: "primary" | "light";
  hover?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export default function Card({ variant = "light", hover = false, onClick, className = "", children }: CardProps) {
  const variants: Record<string, string> = {
    primary: "bg-primaria text-white border border-primaria-escura",
    light: "bg-fundo-rosa text-texto border border-primaria/30",
  };

  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={`w-full rounded-2xl p-4 text-left shadow-[0_4px_12px_rgba(139,0,139,0.15)] transition-all duration-200 ${variants[variant]} ${
        hover || onClick ? "hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(139,0,139,0.25)] cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </Component>
  );
}
