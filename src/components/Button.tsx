"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const base =
    "w-full rounded-full px-6 py-3 text-sm font-bold transition-all duration-200 shadow-[0_4px_12px_rgba(139,0,139,0.15)] disabled:cursor-not-allowed disabled:opacity-60";
  const variants: Record<string, string> = {
    primary: "bg-primaria text-white hover:bg-primaria-hover hover:-translate-y-0.5",
    secondary: "bg-white text-primaria border-2 border-primaria hover:bg-fundo-rosa hover:-translate-y-0.5",
    danger: "bg-status-alerta text-white hover:brightness-95 hover:-translate-y-0.5",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? "Carregando..." : children}
    </button>
  );
}
