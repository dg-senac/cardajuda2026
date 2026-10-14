/** Stub de `next/navigation`: redirect/notFound viram exceções reconhecíveis. */
export class RedirectError extends Error {
  constructor(url) {
    super(`redirect -> ${url}`);
    this.url = url;
    this.isRedirect = true;
  }
}
export class NotFoundError extends Error {
  constructor() {
    super("next/notFound");
    this.isNotFound = true;
  }
}
export function redirect(url) {
  throw new RedirectError(url);
}
export function notFound() {
  throw new NotFoundError();
}
