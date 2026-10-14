"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Input from "@/components/Input";
import SectionTitle from "@/components/SectionTitle";
import Textarea from "@/components/Textarea";
import { createConsultaPacienteAction } from "@/lib/actions/consultas";

export default function NovaConsultaForm({ nomePaciente }: { nomePaciente: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createConsultaPacienteAction(formData);
      if (!result.success) {
        setError(result.error ?? "Não foi possível agendar.");
        toast.error(result.error ?? "Não foi possível agendar.");
        return;
      }
      toast.success("Consulta agendada com sucesso!");
      router.push("/paciente/consultas");
      router.refresh();
    });
  }

  return (
    <div className="animate-fade-in rounded-3xl border border-borda bg-white p-5 shadow-card">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <SectionTitle>Detalhes da consulta</SectionTitle>
          <Input label="Nome do paciente" defaultValue={nomePaciente} readOnly disabled />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" name="data" required />
            <Input label="Horário" type="time" name="horario" required />
          </div>
          <Input label="Profissional" name="profissional" placeholder="Nome do profissional" required />
          <Input label="Especialidade" name="especialidade" placeholder="Ex: Cardiologia" required />
          <Textarea
            label="Motivo da consulta"
            name="motivo"
            placeholder="Informe o motivo da consulta"
            required
          />
        </div>

        {error ? (
          <p className="rounded-xl bg-status-alerta-claro px-3 py-2 text-xs font-semibold text-status-alerta">
            {error}
          </p>
        ) : null}

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
