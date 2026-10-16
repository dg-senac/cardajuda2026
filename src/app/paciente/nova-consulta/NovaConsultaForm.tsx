"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import type { Medico } from "@/types";
import Button from "@/components/Button";
import Input from "@/components/Input";
import SectionTitle from "@/components/SectionTitle";
import Textarea from "@/components/Textarea";
import { createConsultaPacienteAction } from "@/lib/actions/consultas";

export default function NovaConsultaForm({ nomePaciente, medicos }: { nomePaciente: string; medicos: Medico[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const medico = medicos.find(m => m.id === selected);
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
          <label>Médico<select className="w-full rounded-xl border p-3" name="medico_id" value={selected} onChange={e => setSelected(e.target.value)} required><option value="">Selecione</option>{medicos.map(m => <option key={m.id} value={m.id}>{m.nome} · {m.especialidade}</option>)}</select></label>
          <input type="hidden" name="profissional" value={medico?.nome ?? ""} />
          <input type="hidden" name="especialidade" value={medico?.especialidade ?? ""} />
          <p>A agenda não verifica disponibilidade de horários. Confirme com o profissional.</p>
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
