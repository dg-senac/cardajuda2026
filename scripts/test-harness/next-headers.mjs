/**
 * Stub de `next/headers` para rodar as Server Actions fora do Next (node --test).
 * Só precisa guardar o que o app usa: cookies().get/set/delete.
 */
const jar = new Map();

export function cookies() {
  return {
    get: (name) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name, value) => void jar.set(name, value),
    delete: (name) => void jar.delete(name),
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
  };
}

/** API do teste (não existe no Next). */
export function __setCookie(name, value) {
  jar.set(name, value);
}
export function __resetCookies() {
  jar.clear();
}
export function __getCookie(name) {
  return jar.get(name);
}
