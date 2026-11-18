'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type Question = { id: number; question: string; answer: string; answeredAt: string | null };

type QuestionsJson = {
  ok?: boolean;
  questions?: Question[];
  currentPage?: number;
  lastPage?: number;
};

/** Answered questions about the product (#31), five at a time. Hidden when there are none. */
export default function ProductQuestions({ slug }: { slug: string }) {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async (next: number) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/public/products/${encodeURIComponent(slug)}/questions?page=${next}`, {
        headers: { Accept: 'application/json' },
      });
      const json = (await res.json()) as QuestionsJson;
      if (!res.ok || !json.ok || !Array.isArray(json.questions)) {
        setError(true);
        return;
      }
      setQuestions((prev) => {
        const seen = new Set(prev.map((q) => q.id));
        return [...prev, ...json.questions!.filter((q) => !seen.has(q.id))];
      });
      setPage(json.currentPage ?? next);
      setLastPage(json.lastPage ?? next);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/public/products/${encodeURIComponent(slug)}/questions?page=1`, {
          headers: { Accept: 'application/json' },
        });
        const json = (await res.json()) as QuestionsJson;
        if (!active) return;
        if (!res.ok || !json.ok || !Array.isArray(json.questions)) {
          setError(true);
        } else {
          setQuestions(json.questions);
          setPage(json.currentPage ?? 1);
          setLastPage(json.lastPage ?? 1);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (questions.length === 0 && !error) return null;

  return (
    <section aria-labelledby="product-questions-title" className="mt-14">
      <h2
        id="product-questions-title"
        className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-5"
      >
        {t.product.questionsTitle}
      </h2>
      {questions.length > 0 ? (
        <ul className="space-y-4">
          {questions.map((q) => (
            <li key={q.id} className="border border-[#2D1F1F]/8 rounded-xl p-5">
              <p className="text-sm font-semibold text-[#2D1F1F]" dir="auto">
                <span className="text-[#C9A84C] me-2">{t.product.questionLabel}</span>
                {q.question}
              </p>
              <p className="text-sm text-[#2D1F1F]/75 mt-2 leading-relaxed" dir="auto">
                <span className="font-semibold text-[#2D1F1F]/45 me-2">{t.product.answerLabel}</span>
                {q.answer}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-[#2D1F1F]/50 mt-3">{t.product.questionsError}</p> : null}
      {page < lastPage ? (
        <button
          type="button"
          onClick={() => void load(page + 1)}
          disabled={loading}
          className="mt-5 inline-flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
          {t.product.moreQuestions}
        </button>
      ) : null}
    </section>
  );
}
