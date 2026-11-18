import { applyAuthCookies, clearAuthCookies } from '@/lib/api/server/auth-cookies';
import { readAuthCookieJar, resolveCustomerSession, UNAVAILABLE_MESSAGE } from '@/lib/api/server/auth';
import { authErrorResponse, authSessionResponse } from '@/lib/api/server/auth-route';

export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await readAuthCookieJar();
  const session = await resolveCustomerSession(jar);

  if (session.status === 'unavailable') {
    // Still signed in; the store waits and asks again (AuthContext).
    const response = authErrorResponse(503, UNAVAILABLE_MESSAGE);
    return session.tokens
      ? applyAuthCookies(response, session.tokens, session.remember ?? false)
      : response;
  }

  if (session.status === 'unauthenticated') {
    const response = authSessionResponse(null);
    return session.clear ? clearAuthCookies(response) : response;
  }

  const response = authSessionResponse(session.user);
  if (session.tokens) {
    return applyAuthCookies(response, session.tokens, session.remember);
  }
  return response;
}
