"use client";

import { useMemo, useState } from "react";
import Card from "@/components/Card";

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
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sem consultas e triagens salvas..."
        className="w-full rounded-xl border-2 border-primaria bg-fundo-rosa px-4 py-2.5 text-sm text-texto outline-none focus:ring-2 focus:ring-primaria"
      />

      <div className="flex flex-col gap-2">
        {filtered.map((item) => (
          <Card key={`${item.tipo}-${item.id}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-primaria-escura">
                {item.tipo === "Consulta" ? "💜" : "🩺"} {item.nome}
              </p>
              <span className="text-[10px] font-bold uppercase text-primaria">{item.tipo}</span>
            </div>
            <p className="mt-1 text-xs text-texto/60">
              {item.dataFormatada} às {item.horario}
            </p>
            <p className="text-xs text-texto/60">{item.detalhe}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
