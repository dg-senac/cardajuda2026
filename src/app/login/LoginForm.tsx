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
    <div className="flex w-full max-w-sm flex-col items-center">
      <div className="mb-7 flex animate-fade-in flex-col items-center gap-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-white shadow-card">
          <Logo size={34} />
        </div>
        <h1 className="mt-1 text-2xl font-extrabold text-primaria-escura">Bem-vindo(a)!</h1>
        <p className="text-sm text-texto-suave">Seu cuidado cardíaco, todos os dias.</p>
      </div>

      <div className="w-full animate-fade-in rounded-3xl border border-borda bg-white p-6 shadow-card">
        <form action={handleSubmit} className="flex flex-col gap-4">
          <Input label="Email" type="email" name="email" placeholder="seuemail@exemplo.com" required />
          <Input label="Senha" type="password" name="password" placeholder="Sua senha" required />

          {error ? (
            <p className="rounded-xl bg-status-alerta-claro px-3 py-2 text-xs font-semibold text-status-alerta">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={isPending}>
            Entrar
          </Button>
        </form>
      </div>

      <div className="mt-6 w-full animate-fade-in">
        <div className="mb-4 flex items-center gap-3">
          <div className="divider flex-1" />
          <p className="text-xs font-semibold text-texto-suave">Ainda não tem conta?</p>
          <div className="divider flex-1" />
        </div>
        <div className="flex flex-col gap-2.5">
          <Link
            href="/cadastro-paciente"
            className="rounded-full border-2 border-primaria/20 bg-white px-6 py-3 text-center text-sm font-bold text-primaria transition hover:border-primaria hover:bg-fundo-rosa active:scale-[0.98]"
          >
            Cadastrar como paciente
          </Link>
          <Link
            href="/cadastro-medico"
            className="rounded-full border-2 border-primaria/20 bg-white px-6 py-3 text-center text-sm font-bold text-primaria transition hover:border-primaria hover:bg-fundo-rosa active:scale-[0.98]"
          >
            Cadastrar como médico(a)
          </Link>
        </div>
      </div>
    </div>
  );
}
