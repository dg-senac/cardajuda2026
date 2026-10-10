"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Logo from "@/components/Logo";
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
    <div className="w-full max-w-sm animate-fade-in rounded-2xl bg-white p-6 shadow-[0_4px_12px_rgba(139,0,139,0.15)]">
      <div className="mb-6 flex flex-col items-center gap-1">
        <Logo size={26} />
        <h1 className="text-base font-extrabold text-primaria-escura">Cadastro de médico(a)</h1>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-3">
        <Input label="Nome completo" name="nome" placeholder="Digite seu nome completo" required />
        <Input label="CRM" name="crm" placeholder="Ex: CRM/SP 123456" required />
        <Input label="Especialidade" name="especialidade" placeholder="Ex: Cardiologia" required />
        <Input label="Formação" name="formacao" placeholder="Ex: USP - 2010" required />
        <Input label="Telefone" name="telefone" placeholder="(00) 00000-0000" required />
        <Input label="Email" type="email" name="email" placeholder="seuemail@exemplo.com" required />
        <Input label="Senha" type="password" name="senha" placeholder="Mínimo 6 caracteres" required />

        <div>
          <label className="mb-1 block text-sm font-semibold text-primaria-escura" htmlFor="genero">
            Gênero
          </label>
          <select
            id="genero"
            name="genero"
            required
            className="w-full rounded-xl border-2 border-primaria bg-fundo-rosa px-4 py-2.5 text-sm text-texto outline-none focus:ring-2 focus:ring-primaria"
            defaultValue=""
          >
            <option value="" disabled>
              Selecione
            </option>
            <option value="Feminino">Feminino</option>
            <option value="Masculino">Masculino</option>
            <option value="Outro">Outro</option>
          </select>
        </div>

        {error ? <p className="text-xs font-semibold text-status-alerta">{error}</p> : null}

        <Button type="submit" loading={isPending} className="mt-2">
          Criar conta
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-1 text-sm">
        <Link href="/login" className="font-bold text-link hover:underline">
          Já tenho conta
        </Link>
        <Link href="/cadastro-paciente" className="text-primaria-escura/70 hover:underline">
          Sou paciente
        </Link>
      </div>
    </div>
  );
}
