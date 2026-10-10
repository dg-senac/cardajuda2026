import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PacienteLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "paciente") redirect("/medico/inicio");

  return <div className="flex flex-1 flex-col pb-4">{children}</div>;
}
