"use client";

import { useId, useState } from "react";

interface PacienteOption {
  id: string;
  nome: string;
  cpf: string;
}

export default function PacienteSelect({ pacientes }: { pacientes: PacienteOption[] }) {
  const listId = useId();
  const [nome, setNome] = useState("");
  const [pacienteId, setPacienteId] = useState("");

  function handleChange(value: string) {
    setNome(value);
    const match = pacientes.find(
      (p) => p.nome.toLowerCase() === value.toLowerCase() || p.cpf === value.replace(/\D/g, ""),
    );
    setPacienteId(match?.id ?? "");
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-primaria-escura" htmlFor="nome_paciente">
        Nome do paciente
      </label>
      <input
        id="nome_paciente"
        name="nome_paciente"
        list={listId}
        value={nome}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Digite o nome ou CPF do paciente"
        required
        autoComplete="off"
        className="w-full rounded-xl border-2 border-primaria bg-fundo-rosa px-4 py-2.5 text-sm text-texto outline-none focus:ring-2 focus:ring-primaria"
      />
      <datalist id={listId}>
        {pacientes.map((p) => (
          <option key={p.id} value={p.nome} />
        ))}
      </datalist>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      {nome && !pacienteId ? (
        <p className="mt-1 text-xs font-semibold text-status-atencao">
          Paciente não encontrado. Selecione um nome da lista.
        </p>
      ) : null}
    </div>
  );
}
