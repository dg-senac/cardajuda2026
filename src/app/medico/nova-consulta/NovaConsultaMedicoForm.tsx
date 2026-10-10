"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Input from "@/components/Input";
import PacienteSelect from "@/components/PacienteSelect";
import { createConsultaMedicoAction } from "@/lib/actions/consultas";

export default function NovaConsultaMedicoForm({
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
      const result = await createConsultaMedicoAction(formData);
      if (!result.success) {
        setError(result.error ?? "Não foi possível agendar.");
        toast.error(result.error ?? "Não foi possível agendar.");
        return;
      }
      toast.success("Consulta registrada com sucesso!");
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
        <Input label="Profissional" name="profissional" placeholder="Nome do profissional" required />
        <Input label="Especialidade" name="especialidade" placeholder="Ex: Cardiologia" required />
        <div>
          <label className="mb-1 block text-sm font-semibold text-primaria-escura" htmlFor="motivo">
            Motivo da consulta
          </label>
          <textarea
            id="motivo"
            name="motivo"
            rows={3}
            placeholder="Informe o motivo da consulta"
            required
            className="w-full rounded-xl border-2 border-primaria bg-fundo-rosa px-4 py-2.5 text-sm text-texto outline-none focus:ring-2 focus:ring-primaria"
          />
        </div>

        {error ? <p className="text-xs font-semibold text-status-alerta">{error}</p> : null}

        <Button type="submit" loading={isPending}>
          Salvar consulta
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
      </form>
    </div>
  );
}
