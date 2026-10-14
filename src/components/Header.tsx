import Link from "next/link";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";

interface HeaderProps {
  title?: string;
  backHref?: string;
  avatarName?: string;
  avatarHref?: string;
  subtitle?: string;
}

export default function Header({ title, backHref, avatarName, avatarHref, subtitle }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-20 border-b border-primaria/10 bg-white/85 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex w-10 items-center">
          {backHref ? (
            <Link
              href={backHref}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-primaria/15 bg-white text-primaria-escura shadow-sm transition hover:bg-fundo-rosa active:scale-95"
              aria-label="Voltar"
            >
              <Icon name="arrow-left" size={18} />
            </Link>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col items-center">
          {title ? (
            <>
              <h1 className="text-[15px] font-extrabold leading-tight text-primaria-escura">{title}</h1>
              {subtitle ? (
                <p className="mt-0.5 text-[11px] font-medium text-texto-suave">{subtitle}</p>
              ) : null}
            </>
          ) : (
            <Logo size={21} />
          )}
        </div>

        <div className="flex w-10 justify-end">
          {avatarName ? (
            <Link
              href={avatarHref ?? "#"}
              aria-label="Meu perfil"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primaria to-primaria-escura text-sm font-bold text-white shadow-[0_4px_12px_rgba(139,0,139,0.35)] ring-2 ring-white transition active:scale-95"
            >
              {avatarName.trim().charAt(0).toUpperCase() || "?"}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
