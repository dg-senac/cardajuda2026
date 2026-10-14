import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import Icon from "@/components/Icon";
import SectionTitle from "@/components/SectionTitle";
import { requireProfile } from "@/lib/actions/auth";
import { getPacienteById } from "@/lib/queries";
import { formatDate } from "@/lib/validations";
import LogoutButton from "@/components/LogoutButton";
import PerfilEditClient from "./PerfilEditClient";

export const dynamic = "force-dynamic";

function InfoRow({ icon, label, value }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-2.5 text-xs text-texto-suave">
        <Icon name={icon} size={16} className="text-primaria/70" />
        {label}
      </span>
      <span className="text-right text-xs font-semibold text-texto">{value}</span>
    </li>
  );
}

export default async function PacientePerfilPage() {
  const profile = await requireProfile();
  const paciente = await getPacienteById(profile.id);

  return (
    <>
      <Header title="Meu perfil" backHref="/paciente/inicio" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-5 animate-fade-in overflow-hidden rounded-3xl bg-gradient-to-br from-primaria to-primaria-escura p-5 text-white shadow-[0_10px_28px_rgba(139,0,139,0.35)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-xl font-bold text-white ring-2 ring-white/40">
              {profile.nome.trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold">{profile.nome}</p>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <Icon name="mail" size={13} /> {profile.email}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <Icon name="phone" size={13} /> {profile.telefone}
              </p>
            </div>
          </div>
          {paciente ? (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-white/12 px-2 py-2.5">
                <p className="text-base font-extrabold">{paciente.idade}</p>
                <p className="text-white/75">Idade</p>
              </div>
              <div className="rounded-2xl bg-white/12 px-2 py-2.5">
                <p className="text-base font-extrabold">{paciente.tipoSanguineo}</p>
                <p className="text-white/75">Tipo sang.</p>
              </div>
              <div className="rounded-2xl bg-white/12 px-2 py-2.5">
                <p className="text-base font-extrabold">{paciente.altura} m</p>
                <p className="text-white/75">Altura</p>
              </div>
            </div>
          ) : null}
        </div>

        {paciente ? (
          <div className="mb-5">
            <SectionTitle>Dados pessoais</SectionTitle>
            <Card className="divide-y divide-borda !py-1">
              <ul>
                <InfoRow icon="clipboard" label="CPF" value={paciente.cpf} />
                <InfoRow icon="calendar" label="Nascimento" value={formatDate(paciente.dataNascimento)} />
                <InfoRow icon="users" label="Gênero" value={paciente.genero} />
                <InfoRow
                  icon="heart"
                  label="Doenças crônicas"
                  value={
                    paciente.doencasCronicas.length > 0
                      ? paciente.doencasCronicas.join(", ")
                      : "Nenhuma informada"
                  }
                />
                <InfoRow icon="wallet" label="Plano atual" value={paciente.plano ?? "Nenhum"} />
              </ul>
            </Card>
          </div>
        ) : null}

        <PerfilEditClient nome={profile.nome} telefone={profile.telefone} />

        <LogoutButton />
      </main>
      <BottomNav role="paciente" />
    </>
  );
}
