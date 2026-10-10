"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Logo from "@/components/Logo";
import { loginAction } from "@/lib/actions/auth";

export default function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (!result.success) {
        setError(result.error ?? "Não foi possível entrar.");
        toast.error(result.error ?? "Não foi possível entrar.");
        return;
      }
      toast.success("Login realizado com sucesso!");
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-sm animate-fade-in rounded-2xl bg-white p-6 shadow-[0_4px_12px_rgba(139,0,139,0.15)]">
      <div className="mb-6 flex flex-col items-center gap-1">
        <Logo size={30} />
        <p className="text-sm font-medium text-primaria-escura/70">Cuidado cardíaco contínuo</p>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-4">
        <Input label="Email" type="email" name="email" placeholder="seuemail@exemplo.com" required />
        <Input label="Senha" type="password" name="password" placeholder="Sua senha" required />

        {error ? <p className="text-xs font-semibold text-status-alerta">{error}</p> : null}

        <Button type="submit" loading={isPending}>
          Entrar
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-sm">
        <p className="text-primaria-escura/70">Ainda não tem conta?</p>
        <Link href="/cadastro-paciente" className="font-bold text-link hover:underline">
          Cadastrar como paciente
        </Link>
        <Link href="/cadastro-medico" className="font-bold text-link hover:underline">
          Cadastrar como médico
        </Link>
      </div>
    </div>
  );
}
