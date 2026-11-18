import type { ReactNode } from 'react';
import type { Language } from '@/types';

interface LegalDocumentBodyProps {
  children: ReactNode;
  language?: Language;
}

export default function LegalDocumentBody({
  children,
  language = 'ar',
}: LegalDocumentBodyProps) {
  return (
    <article
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className={[
        'text-start text-sm sm:text-base text-[#2D1F1F]/80 leading-8',
        '[&_h2]:text-lg sm:[&_h2]:text-xl',
        '[&_h2]:font-bold [&_h2]:text-[#2D1F1F] [&_h2]:mb-4',
        '[&_h3]:text-base sm:[&_h3]:text-lg',
        '[&_h3]:font-bold [&_h3]:text-[#2D1F1F] [&_h3]:mb-3',
        '[&_p]:leading-8',
        '[&_ul]:list-disc [&_ul]:ps-6 [&_ul]:space-y-3',
        '[&_ol]:list-decimal [&_ol]:ps-6 [&_ol]:space-y-3',
      ].join(' ')}
    >
      {children}
    </article>
  );
}