export function canReadPatient(
  role: string,
  ownId: string,
  patientId: string,
  approved: boolean,
  linked: boolean,
) {
  return role === "paciente"
    ? ownId === patientId
    : role === "medico" && approved && linked;
}
