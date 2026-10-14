"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

const BASE =
  "inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]";

const VARIANTS: Record<string, string> = {
  primary:
    "bg-primaria text-white shadow-[0_6px_16px_rgba(139,0,139,0.35)] hover:bg-primaria-hover hover:shadow-[0_8px_22px_rgba(139,0,139,0.45)] hover:-translate-y-0.5",
  secondary:
    "bg-white text-primaria border-2 border-primaria/25 hover:border-primaria hover:bg-fundo-rosa hover:-translate-y-0.5",
  danger:
    "bg-white text-status-alerta border-2 border-status-alerta/30 hover:border-status-alerta hover:bg-status-alerta-claro hover:-translate-y-0.5",
  ghost: "bg-transparent text-texto-suave hover:bg-primaria/10 hover:text-primaria-escura",
};

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
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
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? (
        <>
          <Spinner />
          Aguarde...
        </>
      ) : (
        children
      )}
    </button>
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  children: ReactNode;
}

export function ButtonLink({ href, variant = "primary", children, className = "", ...rest }: ButtonLinkProps) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}
