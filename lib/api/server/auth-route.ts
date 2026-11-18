import 'server-only';

import { NextResponse } from 'next/server';
import type { User } from '@/types';
import type { AuthErrorJson, AuthSessionJson, AuthUserJson } from '@/types/api/auth';

export const UNAVAILABLE_ERROR = 'The service is temporarily unavailable. Please try again.';

export function authUserResponse(user: User, status = 200): NextResponse<AuthUserJson> {
  return NextResponse.json({ user }, { status });
}

export function authSessionResponse(user: User | null): NextResponse<AuthSessionJson> {
  return NextResponse.json({ user });
}

export function authErrorResponse(status: number, error: string): NextResponse<AuthErrorJson> {
  return NextResponse.json({ error }, { status });
}

export async function readJsonBody(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    console.error('Auth route received a non-JSON body');
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readStringField(body: unknown, key: string): string | undefined {
  const record = asRecord(body);
  if (!record) return undefined;
  const value = record[key];
  if (typeof value !== 'string') return undefined;
  return value;
}

export function readOptionalPhone(body: unknown): string | null {
  const record = asRecord(body);
  if (!record) return null;
  const value = record.phone;
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function readBooleanField(body: unknown, key: string): boolean | undefined {
  const record = asRecord(body);
  if (!record) return undefined;
  const value = record[key];
  if (typeof value === 'boolean') return value;
  return undefined;
}
