"use client";

import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className = "", id, ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="mb-1 block text-sm font-semibold text-primaria-escura">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={`w-full rounded-xl border-2 border-primaria bg-fundo-rosa px-4 py-2.5 text-sm text-texto outline-none transition focus:ring-2 focus:ring-primaria focus:ring-offset-1 ${className}`}
        {...rest}
      />
      {error ? <p className="mt-1 text-xs font-semibold text-status-alerta">{error}</p> : null}
    </div>
  );
}
