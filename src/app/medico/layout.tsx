import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MedicoLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "medico") redirect("/paciente/inicio");

  return <div className="flex flex-1 flex-col pb-4">{children}</div>;
}
