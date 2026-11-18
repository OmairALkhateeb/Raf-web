'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircleQuestion } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import AccountSidebar from '@/components/account/AccountSidebar';
import { fetchProductQuestions } from '@/lib/api/account';
import {
  PRODUCT_QUESTIONS_CHANGED_EVENT,
  productQuestionStatusPresentation,
} from '@/lib/account/product-questions';
import type { AccountProductQuestion } from '@/types';
import { AccountPageSkeleton, ListSkeleton } from '@/components/common/Loading';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

function formatDate(iso: string, language: 'en' | 'ar'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AccountProductQuestionsPage() {
  const router = useRouter();
  const { language, t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const { user, isAuthenticated, isAuthLoading, logout } = useAuth();

  const [questions, setQuestions] = useState<AccountProductQuestion[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const epochRef = useRef(0);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  const handleAuthFailure = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout, router]);

  const loadQuestions = useCallback(async () => {
    const epoch = ++epochRef.current;
    setListLoading(true);
    setListError(false);
    const result = await fetchProductQuestions();
    if (epoch !== epochRef.current) return;
    if (!result.ok) {
      if (result.code === 'unauthenticated') {
        await handleAuthFailure();
        return;
      }
      setQuestions([]);
      setListError(true);
      setListLoading(false);
      return;
    }
    setQuestions(result.data.questions);
    setListLoading(false);
  }, [handleAuthFailure]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      await loadQuestions();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, loadQuestions]);

  useEffect(() => {
    const onChanged = () => {
      if (isAuthLoading || !isAuthenticated) return;
      void loadQuestions();
    };
    window.addEventListener(PRODUCT_QUESTIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(PRODUCT_QUESTIONS_CHANGED_EVENT, onChanged);
    };
  }, [isAuthLoading, isAuthenticated, loadQuestions]);

  const handleLogout = async () => {
    await logout();
    showToast(t.common.signedOut, 'success');
    router.push('/');
  };

  if (isAuthLoading || !isAuthenticated || !user) {
    return <AccountPageSkeleton label={t.common.loading} />;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.account.title}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.account.myQuestions}
          </h1>
        </div>
      </div>

      <div className={`${cx} py-14 sm:py-20`}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10">
          <AccountSidebar user={user} onLogout={() => void handleLogout()} />

          <div className="space-y-6">
            <p className="text-sm text-[#2D1F1F]/45 leading-relaxed max-w-xl">
              {t.account.questionsHint}
            </p>

            {listLoading ? (
              <ListSkeleton rows={3} label={t.common.loading} />
            ) : listError ? (
              <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-12 text-center">
                <p className="text-sm text-[#2D1F1F]/55 mb-4" role="alert">
                  {t.account.questionsLoadError}
                </p>
                <button
                  type="button"
                  onClick={() => void loadQuestions()}
                  className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
                >
                  {t.common.retry}
                </button>
              </div>
            ) : questions.length === 0 ? (
              <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-16 text-center">
                <MessageCircleQuestion
                  size={32}
                  strokeWidth={1}
                  className="text-[#2D1F1F]/15 mx-auto mb-4"
                />
                <p className="text-sm text-[#2D1F1F]/40">
                  {t.account.noQuestionsYet}
                </p>
              </div>
            ) : (
              <ul className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden divide-y divide-[#2D1F1F]/8">
                {questions.map((row) => {
                  const chip = productQuestionStatusPresentation(
                    row.status,
                    t.account,
                  );
                  const title =
                    row.productName ??
                    `${t.account.questionProductFallback} #${row.productId}`;
                  return (
                    <li
                      key={row.id}
                      className={`px-6 py-5 ${isRTL ? 'text-right' : ''}`}
                    >
                      <div
                        className="flex flex-wrap items-center gap-3 mb-2"
                      >
                        <p className="text-sm font-bold text-[#2D1F1F]">
                          {title}
                        </p>
                        <span
                          className={`px-3 py-1 text-[10px] font-black tracking-[0.12em] uppercase rounded-md ${chip.bg} ${chip.text}`}
                        >
                          {chip.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#2D1F1F]/40 mb-3">
                        {formatDate(row.createdAt, language)}
                      </p>
                      <p className="text-sm text-[#2D1F1F] leading-relaxed">
                        {row.question}
                      </p>
                      {row.answer ? (
                        <div className="mt-3 border border-[#2D1F1F]/8 rounded-md px-4 py-3 bg-[#FAF7F2]">
                          <p className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                            {t.account.questionAnswerLabel}
                          </p>
                          <p className="text-sm text-[#2D1F1F] leading-relaxed">
                            {row.answer}
                          </p>
                          {row.answeredAt ? (
                            <p className="text-xs text-[#2D1F1F]/40 mt-1">
                              {formatDate(row.answeredAt, language)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
