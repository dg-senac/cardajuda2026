"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Logo from "@/components/Logo";
import SectionTitle from "@/components/SectionTitle";
import Select from "@/components/Select";
import { signupMedicoAction } from "@/lib/actions/auth";

export default function CadastroMedicoForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signupMedicoAction(formData);
      if (!result.success) {
        setError(result.error ?? "Não foi possível concluir o cadastro.");
        toast.error(result.error ?? "Não foi possível concluir o cadastro.");
        return;
      }
      toast.success("Cadastro realizado com sucesso!");
      router.push("/medico/inicio");
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex animate-fade-in flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card">
          <Logo size={28} />
        </div>
        <h1 className="text-xl font-extrabold text-primaria-escura">Cadastro de médico(a)</h1>
        <p className="text-center text-sm text-texto-suave">Crie sua conta profissional para acompanhar pacientes.</p>
      </div>

      <div className="animate-fade-in rounded-3xl border border-borda bg-white p-6 shadow-card">
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <SectionTitle>Dados profissionais</SectionTitle>
            <Input label="Nome completo" name="nome" placeholder="Digite seu nome completo" required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="CRM" name="crm" placeholder="Ex: CRM/SP 123456" required />
              <Select label="Gênero" name="genero" required>
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
                <option value="Outro">Outro</option>
              </Select>
            </div>
            <Input label="Especialidade" name="especialidade" placeholder="Ex: Cardiologia" required />
            <Input label="Formação" name="formacao" placeholder="Ex: USP - 2010" required />
            <Input label="Telefone" name="telefone" placeholder="(00) 00000-0000" required />
          </div>

          <div className="divider my-1" />

          <div className="flex flex-col gap-3">
            <SectionTitle>Acesso</SectionTitle>
            <Input label="Email" type="email" name="email" placeholder="seuemail@exemplo.com" required />
            <Input label="Senha" type="password" name="senha" placeholder="Mínimo 6 caracteres" required />
          </div>

          {error ? (
            <p className="rounded-xl bg-status-alerta-claro px-3 py-2 text-xs font-semibold text-status-alerta">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={isPending} className="mt-1">
            Criar conta
          </Button>
        </form>
      </div>

      <div className="mt-5 mb-2 flex animate-fade-in flex-col items-center gap-2 text-sm">
        <Link href="/login" className="font-bold text-link hover:underline">
          Já tenho conta
        </Link>
        <Link href="/cadastro-paciente" className="text-texto-suave hover:underline">
          Sou paciente
        </Link>
      </div>
    </div>
  );
}
