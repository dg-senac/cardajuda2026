import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
}

export default function Select({
  label,
  error,
  placeholder = "Selecione",
  className = "",
  id,
  children,
  ...rest
}: SelectProps) {
  const selectId = id ?? rest.name;
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={selectId} className="mb-1.5 block text-[13px] font-bold text-primaria-escura">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={`field ${error ? "border-status-alerta" : ""} ${className}`}
        defaultValue=""
        {...rest}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {children}
      </select>
      {error ? <p className="mt-1 text-xs font-semibold text-status-alerta">{error}</p> : null}
    </div>
  );
}
