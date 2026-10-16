import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { consultas } from '@/db/schema';
import { getCurrentProfile } from '@/lib/session';

export async function isApprovedDoctor(id: string): Promise<boolean> {
  return (await db.execute(sql`select 1 from mobile_private.approved_doctors where medico_id=${id}::uuid`)).rows.length > 0;
}
export async function requireDoctor(id?: string) {
  const p = await getCurrentProfile();
  if (!p || p.role !== 'medico' || (id && id !== p.id) || !await isApprovedDoctor(p.id)) throw new Error('FORBIDDEN');
  return p;
}
export async function requirePatientAccess(id: string) {
  const p = await getCurrentProfile();
  if (p?.role === 'paciente' && p.id === id) return p;
  const doctor = await requireDoctor();
  const linked = await db.select({ id: consultas.id }).from(consultas).where(and(eq(consultas.medicoId, doctor.id), eq(consultas.pacienteId, id))).limit(1);
  if (!linked.length) throw new Error('FORBIDDEN');
  return doctor;
}
