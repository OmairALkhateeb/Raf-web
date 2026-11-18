'use client';

import { Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import PaymentReturn from '@/components/checkout/PaymentReturn';
import { CenteredLoading } from '@/components/common/Loading';


/**
 * Thawani's cancel link: `/checkout/cancel?order={number}&order_id={id}`. The
 * customer may still have paid (or can try again), so it checks like success.
 */
export default function CheckoutCancelPage() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <CenteredLoading label={t.common.loading} />
      }
    >
      <PaymentReturn variant="cancel" />
    </Suspense>
  );
}
