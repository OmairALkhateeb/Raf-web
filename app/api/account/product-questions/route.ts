import {
  createLaravelProductQuestion,
  listLaravelProductQuestions,
} from '@/lib/api/server/product-questions';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import { parseProductQuestionCreateBody } from '@/lib/account/product-questions';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listLaravelProductQuestions();
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({
      ok: true,
      questions: result.data.questions,
      meta: result.data.meta,
    }),
    result,
  );
}

export async function POST(request: Request) {
  const body = await readAccountJsonBody(request);
  if (body === undefined) return invalidAccountInput();

  const input = parseProductQuestionCreateBody(body);
  if (!input) return invalidAccountInput();

  const result = await createLaravelProductQuestion(input);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, question: result.data }, { status: 201 }),
    result,
  );
}
