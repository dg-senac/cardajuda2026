import Link from "next/link";
import Logo from "@/components/Logo";

interface HeaderProps {
  title?: string;
  backHref?: string;
  avatarName?: string;
  avatarHref?: string;
  subtitle?: string;
}

export default function Header({ title, backHref, avatarName, avatarHref, subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-fundo-rosa-2 px-4 py-3 shadow-sm">
      <div className="flex w-10 items-center">
        {backHref ? (
          <Link
            href={backHref}
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-primaria-escura transition hover:bg-white/60"
            aria-label="Voltar"
          >
            ←
          </Link>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col items-center">
        {title ? (
          <>
            <h1 className="text-base font-extrabold text-primaria-escura">{title}</h1>
            {subtitle ? <p className="text-[11px] font-medium text-primaria-escura/70">{subtitle}</p> : null}
          </>
        ) : (
          <Logo size={22} />
        )}
      </div>

      <div className="flex w-10 justify-end">
        {avatarName ? (
          <Link
            href={avatarHref ?? "#"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primaria text-sm font-bold text-white shadow"
          >
            {avatarName.trim().charAt(0).toUpperCase() || "?"}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
