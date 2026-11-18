import { applyAuthCookies } from '@/lib/api/server/auth-cookies';
import { registerCustomer } from '@/lib/api/server/auth';
import {
  authErrorResponse,
  authUserResponse,
  readJsonBody,
  readOptionalPhone,
  readStringField,
} from '@/lib/api/server/auth-route';
import { passwordMeetsPolicy } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const name = readStringField(body, 'name')?.trim();
  const email = readStringField(body, 'email')?.trim();
  const password = readStringField(body, 'password');
  const passwordConfirmation =
    readStringField(body, 'password_confirmation') ?? readStringField(body, 'passwordConfirmation');
  const phone = readOptionalPhone(body);

  if (!name || !email || password === undefined || passwordConfirmation === undefined) {
    return authErrorResponse(422, 'Name, email, password and password confirmation are required.');
  }

  if (password !== passwordConfirmation) {
    return authErrorResponse(422, 'Password confirmation does not match.');
  }

  if (!passwordMeetsPolicy(password)) {
    return authErrorResponse(
      422,
      'Password must be at least 8 characters and include uppercase, lowercase, and a number.',
    );
  }

  const result = await registerCustomer({
    name,
    email,
    phone,
    password,
    passwordConfirmation,
  });

  if (!result.ok) {
    return authErrorResponse(result.status, result.error);
  }

  return applyAuthCookies(authUserResponse(result.user, 201), result.tokens, true);
}
