"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Icon from "@/components/Icon";
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
      <Card hover onClick={() => setEditing(true)} className="!flex !items-center !gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaria/10 text-primaria">
          <Icon name="edit" size={19} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold text-primaria-escura">Editar dados profissionais</p>
          <p className="text-xs text-texto-suave">Atualize nome, telefone, especialidade e formação</p>
        </div>
        <Icon name="chevron-right" size={17} className="text-texto-suave" />
      </Card>
    );
  }

  return (
    <div className="animate-fade-in rounded-3xl border border-borda bg-white p-5 shadow-card">
      <form action={handleSubmit} className="flex flex-col gap-3">
        <Input label="Nome completo" name="nome" defaultValue={nome} required />
        <Input label="Telefone" name="telefone" defaultValue={telefone} required />
        <Input label="Especialidade" name="especialidade" defaultValue={especialidade} />
        <Input label="Formação" name="formacao" defaultValue={formacao} />
        {error ? (
          <p className="rounded-xl bg-status-alerta-claro px-3 py-2 text-xs font-semibold text-status-alerta">
            {error}
          </p>
        ) : null}
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
