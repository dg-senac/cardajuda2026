"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Input from "@/components/Input";
import PacienteSelect from "@/components/PacienteSelect";
import { createTriagemAction } from "@/lib/actions/triagens";

export default function NovaTriagemForm({
  pacientes,
}: {
  pacientes: { id: string; nome: string; cpf: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTriagemAction(formData);
      if (!result.success) {
        setError(result.error ?? "Não foi possível salvar.");
        toast.error(result.error ?? "Não foi possível salvar.");
        return;
      }
      toast.success("Triagem salva com sucesso!");
      router.push("/medico/consultas");
      router.refresh();
    });
  }

  return (
    <div className="animate-fade-in rounded-2xl bg-white p-5 shadow-[0_4px_12px_rgba(139,0,139,0.15)]">
      <form action={handleSubmit} className="flex flex-col gap-3">
        <PacienteSelect pacientes={pacientes} />
        <Input label="Data" type="date" name="data" required />
        <Input label="Horário" type="time" name="horario" required />
        <Input label="Profissional" name="profissional" placeholder="Nome do Profissional" required />
        <div>
          <label className="mb-1 block text-sm font-semibold text-primaria-escura" htmlFor="queixa_principal">
            Queixa Principal
          </label>
          <textarea
            id="queixa_principal"
            name="queixa_principal"
            rows={3}
            placeholder="Descreva sua queixa"
            required
            className="w-full rounded-xl border-2 border-primaria bg-fundo-rosa px-4 py-2.5 text-sm text-texto outline-none focus:ring-2 focus:ring-primaria"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-primaria-escura" htmlFor="classificacao">
            Classificação
          </label>
          <select
            id="classificacao"
            name="classificacao"
            required
            defaultValue=""
            className="w-full rounded-xl border-2 border-primaria bg-fundo-rosa px-4 py-2.5 text-sm text-texto outline-none focus:ring-2 focus:ring-primaria"
          >
            <option value="" disabled>
              Classificação da triagem
            </option>
            <option value="verde">🟢 Verde — pouco urgente</option>
            <option value="amarela">🟡 Amarela — urgente</option>
            <option value="vermelha">🔴 Vermelha — muito urgente</option>
          </select>
        </div>

        {error ? <p className="text-xs font-semibold text-status-alerta">{error}</p> : null}

        <Button type="submit" loading={isPending}>
          Salvar Triagem
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
      </form>
    </div>
  );
}
