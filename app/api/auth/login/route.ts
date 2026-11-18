import { applyAuthCookies } from '@/lib/api/server/auth-cookies';
import { loginCustomer } from '@/lib/api/server/auth';
import {
  authErrorResponse,
  authUserResponse,
  readBooleanField,
  readJsonBody,
  readStringField,
} from '@/lib/api/server/auth-route';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await readJsonBody(request);

  const email = readStringField(body, 'email')?.trim();
  const password = readStringField(body, 'password');
  const remember = readBooleanField(body, 'remember') ?? true;
  const acceptPolicies = readBooleanField(body, 'accept_policies');

  if (!email || password === undefined || password === '') {
    return authErrorResponse(
      422,
      'Email and password are required.',
    );
  }

  if (acceptPolicies !== true) {
    return authErrorResponse(
      422,
      'Please accept the Customer Terms and Returns Policy before signing in.',
    );
  }

  const result = await loginCustomer(email, password);

  if (!result.ok) {
    return authErrorResponse(result.status, result.error);
  }

  return applyAuthCookies(
    authUserResponse(result.user),
    result.tokens,
    remember,
  );
}