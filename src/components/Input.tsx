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
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-bold text-primaria-escura">
          {label}
        </label>
      ) : null}
      <input id={inputId} className={`field ${error ? "border-status-alerta" : ""} ${className}`} {...rest} />
      {error ? <p className="mt-1 text-xs font-semibold text-status-alerta">{error}</p> : null}
    </div>
  );
}
