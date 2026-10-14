import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export default function Textarea({ label, error, className = "", id, rows = 3, ...rest }: TextareaProps) {
  const textareaId = id ?? rest.name;
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={textareaId} className="mb-1.5 block text-[13px] font-bold text-primaria-escura">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        rows={rows}
        className={`field resize-none ${error ? "border-status-alerta" : ""} ${className}`}
        {...rest}
      />
      {error ? <p className="mt-1 text-xs font-semibold text-status-alerta">{error}</p> : null}
    </div>
  );
}
