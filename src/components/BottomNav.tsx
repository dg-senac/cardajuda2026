"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const PACIENTE_ITEMS: NavItem[] = [
  { href: "/paciente/inicio", label: "Início", icon: "🏠" },
  { href: "/paciente/consultas", label: "Consulta", icon: "📅" },
  { href: "/paciente/saude", label: "Saúde", icon: "❤️" },
  { href: "/paciente/medicos", label: "Médicos", icon: "👨‍⚕️" },
];

const MEDICO_ITEMS: NavItem[] = [
  { href: "/medico/inicio", label: "Início", icon: "🏠" },
  { href: "/medico/consultas", label: "Consulta", icon: "📅" },
  { href: "/medico/alertas", label: "Alertas", icon: "❤️" },
  { href: "/medico/pacientes", label: "Pacientes", icon: "👥" },
];

export default function BottomNav({ role }: { role: "paciente" | "medico" }) {
  const pathname = usePathname();
  const items = role === "paciente" ? PACIENTE_ITEMS : MEDICO_ITEMS;

  return (
    <nav className="sticky bottom-0 z-20 mt-auto flex items-stretch justify-around border-t border-primaria/20 bg-white px-2 py-2 shadow-[0_-4px_12px_rgba(139,0,139,0.12)]">
      {items.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1 text-[11px] font-semibold transition-transform ${
              active ? "scale-105 text-primaria" : "text-texto/50"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
