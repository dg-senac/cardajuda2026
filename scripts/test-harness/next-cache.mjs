/** Stub de `next/cache`: revalidatePath é no-op, mas fica registrado para asserção. */
export const revalidated = [];
export function revalidatePath(path) {
  revalidated.push(path);
}
