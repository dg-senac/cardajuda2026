"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import SearchInput from "@/components/SearchInput";
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
  { key: "alerta", label: "Atenção" },
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
      result = result.filter(
        (item) => item.nome.toLowerCase().includes(q) || String(item.idade).includes(q),
      );
    }
    return result;
  }, [items, query, filtro]);

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Buscar paciente pelo nome..." />

      <div className="segmented">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltro(f.key)}
            className={`segmented-btn ${filtro === f.key ? "segmented-btn-active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhum paciente encontrado"
          description="Tente buscar por outro nome ou limpar os filtros."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((item) => (
            <Card key={item.id} className="!p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primaria to-primaria-escura text-sm font-bold text-white">
                    {item.nome.trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primaria-escura">{item.nome}</p>
                    <p className="text-xs text-texto-suave">
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
                className="mt-2.5 flex items-center justify-end gap-1 text-xs font-bold text-link hover:underline"
              >
                Ver detalhes
                <Icon name="chevron-right" size={13} />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
