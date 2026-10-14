"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const PACIENTE_ITEMS: NavItem[] = [
  { href: "/paciente/inicio", label: "Início", icon: "home" },
  { href: "/paciente/consultas", label: "Consultas", icon: "calendar" },
  { href: "/paciente/saude", label: "Saúde", icon: "heart" },
  { href: "/paciente/medicos", label: "Médicos", icon: "stethoscope" },
];

const MEDICO_ITEMS: NavItem[] = [
  { href: "/medico/inicio", label: "Início", icon: "home" },
  { href: "/medico/consultas", label: "Consultas", icon: "calendar" },
  { href: "/medico/alertas", label: "Alertas", icon: "bell" },
  { href: "/medico/pacientes", label: "Pacientes", icon: "users" },
];

export default function BottomNav({ role }: { role: "paciente" | "medico" }) {
  const pathname = usePathname();
  const items = role === "paciente" ? PACIENTE_ITEMS : MEDICO_ITEMS;

  return (
    <nav
      className="sticky bottom-0 z-20 mt-auto border-t border-primaria/10 bg-white/95 backdrop-blur-md shadow-nav"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
    >
      <div className="flex items-stretch justify-around px-2 pt-1.5">
        {items.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[10.5px] font-bold transition-all active:scale-95 ${
                active
                  ? "bg-primaria/10 text-primaria"
                  : "text-texto-suave/70 hover:text-primaria-escura"
              }`}
            >
              <Icon name={item.icon} size={21} strokeWidth={active ? 2.3 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
