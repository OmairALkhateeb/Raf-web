'use client';

import type { ReactNode } from 'react';
import type { Language } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import CmsDocumentView from '@/components/cms/CmsDocumentView';
import LegalDocumentBody from '@/components/legal/LegalDocumentBody';

interface LocalizedLegalDocumentProps {
  chrome: 'terms' | 'returnsPolicy';
  titles: Record<Language, string>;
  arabicContent: ReactNode;
  englishContent: ReactNode;
}

export default function LocalizedLegalDocument({
  chrome,
  titles,
  arabicContent,
  englishContent,
}: LocalizedLegalDocumentProps) {
  const { language } = useLanguage();

  return (
    <CmsDocumentView
      status="ok"
      chrome={chrome}
      title={titles[language]}
    >
      <LegalDocumentBody language={language}>
        {language === 'ar' ? arabicContent : englishContent}
      </LegalDocumentBody>
    </CmsDocumentView>
  );
}