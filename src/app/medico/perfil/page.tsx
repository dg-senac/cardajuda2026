import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Card from "@/components/Card";
import Icon from "@/components/Icon";
import SectionTitle from "@/components/SectionTitle";
import LogoutButton from "@/components/LogoutButton";
import { requireProfile } from "@/lib/actions/auth";
import { getMedicoById } from "@/lib/queries";
import MedicoPerfilEditClient from "./MedicoPerfilEditClient";

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

export default async function MedicoPerfilPage() {
  const profile = await requireProfile();
  const medico = await getMedicoById(profile.id);

  return (
    <>
      <Header title="Meu perfil" backHref="/medico/inicio" />
      <main className="flex-1 px-4 pb-6 pt-4">
        <div className="mb-5 animate-fade-in overflow-hidden rounded-3xl bg-gradient-to-br from-primaria to-primaria-escura p-5 text-white shadow-[0_10px_28px_rgba(139,0,139,0.35)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 text-xl font-bold text-white ring-2 ring-white/40">
              {profile.nome.trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold">Dr(a). {profile.nome}</p>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <Icon name="mail" size={13} /> {profile.email}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <Icon name="phone" size={13} /> {profile.telefone}
              </p>
            </div>
          </div>
          {medico ? (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-white/12 px-2 py-2.5">
                <p className="text-base font-extrabold">★ {medico.avaliacao.toFixed(1)}</p>
                <p className="text-white/75">Avaliação</p>
              </div>
              <div className="rounded-2xl bg-white/12 px-2 py-2.5">
                <p className="text-base font-extrabold">{medico.consultasFeitas}</p>
                <p className="text-white/75">Consultas</p>
              </div>
              <div className="rounded-2xl bg-white/12 px-2 py-2.5">
                <p className="truncate text-sm font-extrabold">{medico.crm}</p>
                <p className="text-white/75">CRM</p>
              </div>
            </div>
          ) : null}
        </div>

        {medico ? (
          <div className="mb-5">
            <SectionTitle>Dados profissionais</SectionTitle>
            <Card className="divide-y divide-borda !py-1">
              <ul>
                <InfoRow icon="stethoscope" label="Especialidade" value={medico.especialidade} />
                <InfoRow icon="clipboard" label="Formação" value={medico.formacao} />
                <InfoRow icon="users" label="Gênero" value={medico.genero} />
              </ul>
            </Card>
          </div>
        ) : null}

        <MedicoPerfilEditClient
          nome={profile.nome}
          telefone={profile.telefone}
          especialidade={medico?.especialidade ?? ""}
          formacao={medico?.formacao ?? ""}
        />

        <LogoutButton />
      </main>
      <BottomNav role="medico" />
    </>
  );
}
