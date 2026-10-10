import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import { requireProfile } from "@/lib/actions/auth";
import { getPacienteById } from "@/lib/queries";
import { formatDate } from "@/lib/validations";
import LogoutButton from "@/components/LogoutButton";
import PerfilEditClient from "./PerfilEditClient";

export const dynamic = "force-dynamic";

export default async function PacientePerfilPage() {
  const profile = await requireProfile();
  const paciente = await getPacienteById(profile.id);

  return (
    <>
      <Header title="Meu Perfil" backHref="/paciente/inicio" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-4 animate-fade-in rounded-2xl bg-primaria p-5 text-white shadow-[0_4px_12px_rgba(139,0,139,0.15)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-bold text-primaria">
              {profile.nome.trim().charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-extrabold">{profile.nome}</p>
              <p className="text-xs text-white/80">📧 {profile.email}</p>
              <p className="text-xs text-white/80">📞 {profile.telefone}</p>
            </div>
          </div>
          {paciente ? (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/15 py-2">
                <p className="font-bold">{paciente.idade}</p>
                <p className="text-white/80">Idade</p>
              </div>
              <div className="rounded-xl bg-white/15 py-2">
                <p className="font-bold">{paciente.tipoSanguineo}</p>
                <p className="text-white/80">Tipo sang.</p>
              </div>
              <div className="rounded-xl bg-white/15 py-2">
                <p className="font-bold">{paciente.altura} m</p>
                <p className="text-white/80">Altura</p>
              </div>
            </div>
          ) : null}
        </div>

        {paciente ? (
          <Card className="mb-4">
            <p className="mb-2 text-sm font-bold text-primaria-escura">Dados pessoais</p>
            <ul className="flex flex-col gap-1 text-xs text-texto/70">
              <li>CPF: {paciente.cpf}</li>
              <li>Data de nascimento: {formatDate(paciente.dataNascimento)}</li>
              <li>Gênero: {paciente.genero}</li>
              <li>
                Doenças crônicas:{" "}
                {paciente.doencasCronicas.length > 0 ? paciente.doencasCronicas.join(", ") : "Nenhuma informada"}
              </li>
              <li>Plano atual: {paciente.plano ?? "Nenhum"}</li>
            </ul>
          </Card>
        ) : null}

        <PerfilEditClient nome={profile.nome} telefone={profile.telefone} />

        <LogoutButton />
      </main>
      <BottomNav role="paciente" />
    </>
  );
}
