/**
 * The backend's error `code` (since 08/10/2026): the same in every language,
 * unlike `message`, which follows `Accept-Language`. `undefined` when absent.
 */
export function laravelErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' && code.trim() ? code.trim() : undefined;
}
