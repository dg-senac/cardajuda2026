"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Card from "@/components/Card";
import StatusIcon from "@/components/StatusIcon";
import type { StatusMedicao } from "@/types";

interface PacienteItem {
  id: string;
  nome: string;
  idade: number;
  genero: string;
  sistolica: number | null;
  diastolica: number | null;
  glicemia: number | null;
  status: StatusMedicao | null;
}

const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "alerta", label: "Alertas" },
] as const;

export default function PacientesSearch({ items }: { items: PacienteItem[] }) {
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["key"]>("todos");

  const filtered = useMemo(() => {
    let result = items;
    if (filtro === "alerta") {
      result = result.filter((item) => item.status === "alerta" || item.status === "atencao");
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((item) => item.nome.toLowerCase().includes(q));
    }
    return result;
  }, [items, query, filtro]);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome, CPF ou prontuário"
        className="w-full rounded-xl border-2 border-primaria bg-fundo-rosa px-4 py-2.5 text-sm text-texto outline-none focus:ring-2 focus:ring-primaria"
      />

      <div className="flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${
              filtro === f.key ? "bg-primaria text-white" : "bg-white text-primaria border-2 border-primaria"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-texto/60">Nenhum paciente encontrado.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => (
            <Card key={item.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primaria text-sm font-bold text-white">
                    {item.nome.trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primaria-escura">{item.nome}</p>
                    <p className="text-xs text-texto/60">
                      {item.idade} anos {item.genero.charAt(0)}
                      {item.sistolica ? ` · PA ${item.sistolica}/${item.diastolica}` : ""}
                      {item.glicemia ? ` · Glic. ${item.glicemia}` : ""}
                    </p>
                  </div>
                </div>
                {item.status ? <StatusIcon status={item.status} /> : null}
              </div>
              <Link
                href={`/medico/paciente/${item.id}`}
                className="mt-2 block text-right text-xs font-bold text-link hover:underline"
              >
                Ver detalhes →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
