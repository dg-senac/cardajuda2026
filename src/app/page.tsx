import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  redirect(profile.role === "paciente" ? "/paciente/inicio" : "/medico/inicio");
}
