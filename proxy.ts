import { NextResponse, type NextRequest } from 'next/server';
import { LANGUAGE_PARAM, PATH_HEADER } from '@/lib/seo/alternates';
import { isLanguage, LANGUAGE_COOKIE } from '@/lib/i18n/language';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** The Cookie header with `raf-language` replaced. */
function withLanguageCookie(cookieHeader: string | null, language: string): string {
  const others = (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${LANGUAGE_COOKIE}=`));
  return [...others, `${LANGUAGE_COOKIE}=${language}`].join('; ');
}

/**
 * - `?lang=ar` / `?lang=en`: render that language for this request (search
 *   engines send no cookie) and remember it like the header switch does.
 * - Passes the requested path to the root layout for canonical URLs.
 */
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);

  const language = request.nextUrl.searchParams.get(LANGUAGE_PARAM);
  if (isLanguage(language)) {
    requestHeaders.set('cookie', withLanguageCookie(request.headers.get('cookie'), language));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isLanguage(language)) {
    response.cookies.set(LANGUAGE_COOKIE, language, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
    });
  }
  return response;
}

export const config = {
  // Pages only: not the store's API routes, Next assets or files with an extension.
  matcher: ['/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)'],
};
