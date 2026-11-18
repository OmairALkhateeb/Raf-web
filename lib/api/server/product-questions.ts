import 'server-only';

import type {
  AccountProductQuestion,
  AccountProductQuestionsMeta,
} from '@/types';
import type {
  AccountClientError,
  ProductQuestionCreateFields,
} from '@/types/api/account';
import type { LaravelAuthTokensDto } from '@/types/api/auth';
import {
  parseLaravelProductQuestion,
  parseLaravelProductQuestionsPage,
  parseProductQuestionCreateFields,
  productQuestionValidationMessage,
} from '@/lib/mappers/product-questions';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

export type ProductQuestionOpSuccess<T> = {
  ok: true;
  data: T;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type ProductQuestionOpFailure = {
  ok: false;
  error: AccountClientError & { fields?: ProductQuestionCreateFields };
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type ProductQuestionOpResult<T> =
  | ProductQuestionOpSuccess<T>
  | ProductQuestionOpFailure;

function unavailable(): ProductQuestionOpFailure {
  return {
    ok: false,
    error: { ok: false, code: 'unavailable' },
    remember: true,
  };
}

function withCookies<T>(
  result: ProductQuestionOpResult<T>,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): ProductQuestionOpResult<T> {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

export type ProductQuestionCreateInput = {
  productId: number;
  question: string;
};

export async function listLaravelProductQuestions(): Promise<
  ProductQuestionOpResult<{
    questions: AccountProductQuestion[];
    meta: AccountProductQuestionsMeta;
  }>
> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/product-questions?per_page=20&page=1', {
      method: 'GET',
      accessToken,
    }),
  );
  const { result } = attempt;

  if (result.unreachable) return withCookies(unavailable(), attempt);
  if (result.status === 401) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'unauthenticated' },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  if (result.status !== 200) {
    return withCookies(unavailable(), attempt);
  }

  const mapped = parseLaravelProductQuestionsPage(result.data);
  if (!mapped) {
    console.error('Laravel product-questions page could not be mapped');
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: mapped, remember: attempt.remember },
    attempt,
  );
}

export async function createLaravelProductQuestion(
  input: ProductQuestionCreateInput,
): Promise<ProductQuestionOpResult<AccountProductQuestion>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/product-questions', {
      method: 'POST',
      accessToken,
      body: {
        product_id: input.productId,
        question: input.question,
      },
    }),
  );
  const { result } = attempt;

  if (result.unreachable) return withCookies(unavailable(), attempt);
  if (result.status === 401) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'unauthenticated' },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  if (result.status === 422) {
    const fields = parseProductQuestionCreateFields(result.data);
    return withCookies(
      {
        ok: false,
        error: {
          ok: false,
          code: 'validation',
          error: productQuestionValidationMessage(result.data),
          fields,
        },
        remember: attempt.remember,
      },
      attempt,
    );
  }
  if (result.status !== 201) {
    return withCookies(unavailable(), attempt);
  }

  const mapped = parseLaravelProductQuestion(result.data);
  if (!mapped) {
    console.error('Laravel product-question create payload could not be mapped');
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: mapped, remember: attempt.remember },
    attempt,
  );
}
