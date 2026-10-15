import { redirect } from "next/navigation";
import AvisoBanco from "@/components/AvisoBanco";
import TrocarServidor from "@/components/TrocarServidor";
import { checkDatabase } from "@/lib/db-ready";
import { lookupCurrentProfile } from "@/lib/session";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // 1) O banco está utilizável? Essa checagem NÃO lança e é cacheada (60s no
  //    caminho feliz, 15s no erro), então o formulário sempre aparece: com o
  //    banco certo entrando normalmente, ou com o aviso do que corrigir.
  const db = await checkDatabase();

  // 2) Só vale procurar sessão se houver onde procurar. Sem isso, o `select` de
  //    getCurrentProfile estourava e /login -- a tela onde a pessoa lê o que
  //    fazer -- virava erro 500.
  const profile = db.ok ? (await lookupCurrentProfile()).profile : null;
  if (profile) {
    redirect(profile.role === "paciente" ? "/paciente/inicio" : "/medico/inicio");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10">
      {db.ok ? null : <AvisoBanco status={db} />}
      <LoginForm />
      <TrocarServidor />
    </main>
  );
}
