"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import { updateProfileAction } from "@/lib/actions/misc";

interface Props {
  nome: string;
  telefone: string;
  especialidade: string;
  formacao: string;
}

export default function MedicoPerfilEditClient({ nome, telefone, especialidade, formacao }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (!result.success) {
        setError(result.error ?? "Não foi possível atualizar.");
        toast.error(result.error ?? "Não foi possível atualizar.");
        return;
      }
      toast.success("Perfil atualizado!");
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <Card className="mb-4" hover onClick={() => setEditing(true)}>
        <p className="text-sm font-bold text-primaria-escura">✏️ Editar dados profissionais</p>
        <p className="text-xs text-texto/60">Atualize seu nome, telefone, especialidade e formação</p>
      </Card>
    );
  }

  return (
    <div className="mb-4 animate-fade-in rounded-2xl bg-white p-4 shadow-[0_4px_12px_rgba(139,0,139,0.15)]">
      <form action={handleSubmit} className="flex flex-col gap-3">
        <Input label="Nome completo" name="nome" defaultValue={nome} required />
        <Input label="Telefone" name="telefone" defaultValue={telefone} required />
        <Input label="Especialidade" name="especialidade" defaultValue={especialidade} />
        <Input label="Formação" name="formacao" defaultValue={formacao} />
        {error ? <p className="text-xs font-semibold text-status-alerta">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" loading={isPending}>
            Salvar
          </Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
