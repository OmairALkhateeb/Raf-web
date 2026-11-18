/**
 * Where to go after signing in (`/login?next=…`). Only a path on this site:
 * it must start with one `/` (so `//evil.example` and `https://…` are refused).
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

/** `/login`, returning to `next` (a path with its query) after signing in. */
export function loginHref(next?: string | null): string {
  const path = safeNextPath(next);
  return path ? `/login?next=${encodeURIComponent(path)}` : '/login';
}
