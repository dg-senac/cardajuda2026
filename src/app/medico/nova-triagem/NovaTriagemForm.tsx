"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Input from "@/components/Input";
import PacienteSelect from "@/components/PacienteSelect";
import SectionTitle from "@/components/SectionTitle";
import Select from "@/components/Select";
import Textarea from "@/components/Textarea";
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
    <div className="animate-fade-in rounded-3xl border border-borda bg-white p-5 shadow-card">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <SectionTitle>Dados da triagem</SectionTitle>
          <PacienteSelect pacientes={pacientes} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" name="data" required />
            <Input label="Horário" type="time" name="horario" required />
          </div>
          <Input label="Profissional" name="profissional" placeholder="Nome do profissional" required />
          <Textarea
            label="Queixa principal"
            name="queixa_principal"
            placeholder="Descreva a queixa do paciente"
            required
          />
          <Select label="Classificação" name="classificacao" placeholder="Classificação da triagem" required>
            <option value="verde">🟢 Verde — pouco urgente</option>
            <option value="amarela">🟡 Amarela — urgente</option>
            <option value="vermelha">🔴 Vermelha — muito urgente</option>
          </Select>
        </div>

        {error ? (
          <p className="rounded-xl bg-status-alerta-claro px-3 py-2 text-xs font-semibold text-status-alerta">
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={isPending}>
          Salvar triagem
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
      </form>
    </div>
  );
}
