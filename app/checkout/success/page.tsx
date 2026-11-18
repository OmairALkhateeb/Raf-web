'use client';

import { Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import PaymentReturn from '@/components/checkout/PaymentReturn';
import { CenteredLoading } from '@/components/common/Loading';


/** Thawani's success link: `/checkout/success?order={number}&order_id={id}`. */
export default function CheckoutSuccessPage() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <CenteredLoading label={t.common.loading} />
      }
    >
      <PaymentReturn variant="success" />
    </Suspense>
  );
}
