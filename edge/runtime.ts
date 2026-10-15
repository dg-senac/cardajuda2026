import { AsyncLocalStorage } from "node:async_hooks";
export const context = new AsyncLocalStorage<{
  token?: string;
  issued?: string;
  cleared?: boolean;
}>();
export async function cookies() {
  const state = context.getStore();
  if (!state) throw new Error("Missing request context");
  return {
    get: () => (state.token ? { value: state.token } : undefined),
    set: (_name: string, value: string) => {
      state.token = value;
      state.issued = value;
    },
    delete: () => {
      state.token = undefined;
      state.cleared = true;
    },
  };
}
export function redirect(): never {
  throw new Error("UNAUTHORIZED");
}
export function revalidatePath() {
  /* Local clients explicitly reload after mutations. */
}
