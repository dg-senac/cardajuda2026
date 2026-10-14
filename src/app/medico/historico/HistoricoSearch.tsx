"use client";

import { useMemo, useState } from "react";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import SearchInput from "@/components/SearchInput";

interface Item {
  id: string;
  tipo: "Consulta" | "Triagem";
  nome: string;
  data: string;
  dataFormatada: string;
  horario: string;
  detalhe: string;
}

export default function HistoricoSearch({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => item.nome.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Buscar paciente pelo nome..." />

      {filtered.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="Nenhum registro encontrado"
          description="Consultas e triagens realizadas aparecerão aqui."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => (
            <Card key={`${item.tipo}-${item.id}`} className="!p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-primaria-escura">{item.nome}</p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-wide ${
                    item.tipo === "Consulta"
                      ? "bg-primaria/10 text-primaria"
                      : "bg-status-atencao-claro text-status-atencao"
                  }`}
                >
                  {item.tipo}
                </span>
              </div>
              <p className="mt-1 text-xs text-texto-suave">
                {item.dataFormatada} às {item.horario}
              </p>
              <p className="text-xs text-texto-suave">{item.detalhe}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
