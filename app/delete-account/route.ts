import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api/server/env';

export const dynamic = 'force-dynamic';

/**
 * The backend's public "delete my account" page (the URL given to Google
 * Play), for someone who can't sign in to the store. Signed-in shoppers use
 * Account → Settings instead. Redirected here because `API_BASE_URL` is
 * server-only and the footer renders in the browser.
 */
export function GET() {
  return NextResponse.redirect(`${apiBaseUrl()}/account/delete`);
}
