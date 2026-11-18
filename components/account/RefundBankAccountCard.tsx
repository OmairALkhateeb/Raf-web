'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { removeRefundAccount, saveRefundAccount } from '@/lib/api/account';
import { localizeAccountError } from '@/lib/account/messages';
import {
  REFUND_ACCOUNT_ANCHOR,
  REFUND_ACCOUNT_NAME_MAX,
  REFUND_IBAN_INPUT_MAX,
  REFUND_IBAN_PLACEHOLDER,
  formatIban,
  maskIban,
  validateRefundAccount,
} from '@/lib/account/refund-account';
import { useRefundAccount } from '@/lib/account/useRefundAccount';
import RefundAccountFields from '@/components/account/RefundAccountFields';
import type { RefundAccountFields as RefundAccountFieldErrors } from '@/types/api/account';

type Mode = 'view' | 'edit' | 'confirm-remove';

/**
 * "Bank account for refunds" (guide §5.5, §9.2): where RAF transfers refunds
 * it can't put back on the card (returns, one store cancelling its part).
 * Notifications link here with `#refund-bank-account`.
 */
export default function RefundBankAccountCard({
  onSessionLost,
}: {
  onSessionLost: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const { showToast } = useApp();
  const { state, reload, setAccount } = useRefundAccount(true);
  const [mode, setMode] = useState<Mode>('view');
  const [iban, setIban] = useState('');
  const [accountName, setAccountName] = useState('');
  const [errors, setErrors] = useState<RefundAccountFieldErrors>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const cardRef = useRef<HTMLElement>(null);
  const scrollPassRef = useRef(0);

  const account = state.status === 'ready' ? state.account : null;
  const showForm = state.status === 'ready' && (account === null || mode === 'edit');

  // Opened from a notification or "Bank Account": the page drew a spinner
  // first, so the browser couldn't jump to the anchor by itself. Jump when
  // the card appears and once more when it's filled in (the router may
  // scroll after it mounts). `instant`: the site's smooth scrolling can stop
  // short while the page is still settling.
  useEffect(() => {
    if (window.location.hash !== `#${REFUND_ACCOUNT_ANCHOR}`) return;
    const settled = state.status === 'ready' || state.status === 'error';
    if (scrollPassRef.current >= 2 || (scrollPassRef.current === 1 && !settled)) return;
    scrollPassRef.current = settled ? 2 : 1;
    cardRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    if (settled) cardRef.current?.focus({ preventScroll: true });
  }, [state.status]);

  const fieldMessage = (field: keyof RefundAccountFieldErrors, code: string) => {
    if (field === 'refund_iban') {
      return code === 'required' ? t.account.ibanRequired : t.account.ibanInvalid;
    }
    return code === 'required' ? t.account.accountNameRequired : t.account.accountNameTooLong;
  };

  const startEdit = () => {
    setIban(account ? formatIban(account.iban) : '');
    setAccountName(account?.accountName ?? '');
    setErrors({});
    setMode('edit');
  };

  const handleSessionError = async (code: string) => {
    if (code === 'unauthenticated') {
      await onSessionLost();
      return true;
    }
    return false;
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current) return;
    const input = { iban, accountName };
    const codes = validateRefundAccount(input);
    if (Object.keys(codes).length > 0) {
      setErrors(
        Object.fromEntries(
          Object.entries(codes).map(([field, code]) => [
            field,
            fieldMessage(field as keyof RefundAccountFieldErrors, code),
          ]),
        ),
      );
      return;
    }

    busyRef.current = true;
    setBusy(true);
    try {
      const result = await saveRefundAccount(input);
      if (!result.ok) {
        if (await handleSessionError(result.code)) return;
        const fields = (result.fields ?? {}) as RefundAccountFieldErrors;
        if (result.code === 'validation' && (fields.refund_iban || fields.refund_account_name)) {
          // The backend's own words (it checks the IBAN checksum), in the store language.
          setErrors({
            refund_iban: fields.refund_iban,
            refund_account_name: fields.refund_account_name,
          });
          return;
        }
        showToast(
          result.code === 'validation' ? t.common.checkDetails : localizeAccountError(result, t),
          'error',
        );
        return;
      }
      setAccount(result.data);
      setMode('view');
      setErrors({});
      showToast(t.account.refundAccountSaved, 'success');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await removeRefundAccount();
      if (!result.ok) {
        if (await handleSessionError(result.code)) return;
        showToast(localizeAccountError(result, t), 'error');
        return;
      }
      setAccount(result.data);
      setMode('view');
      setIban('');
      setAccountName('');
      showToast(t.account.refundAccountRemoved, 'success');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const secondaryButton =
    'h-10 px-4 border border-[#2D1F1F]/20 rounded-md text-[11px] font-black tracking-[0.15em] uppercase text-[#2D1F1F] hover:border-[#C9A84C] transition-colors disabled:opacity-50';

  return (
    <section
      ref={cardRef}
      id={REFUND_ACCOUNT_ANCHOR}
      tabIndex={-1}
      aria-labelledby="refund-account-title"
      className="border border-[#2D1F1F]/8 rounded-xl p-8 sm:p-10 scroll-mt-28 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/50"
    >
      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 flex items-center justify-center bg-[#C9A84C]/10 rounded-md flex-shrink-0">
          <Landmark size={18} className="text-[#C9A84C]" aria-hidden />
        </div>
        <div className="text-start">
          <h2 id="refund-account-title" className="text-lg font-serif text-[#2D1F1F]">
            {t.account.refundAccountTitle}
          </h2>
          <p className="text-sm text-[#2D1F1F]/45 mt-1 leading-relaxed">
            {t.account.refundAccountHelp}
          </p>
        </div>
      </div>

      {state.status === 'loading' || state.status === 'idle' ? (
        <div className="py-6 flex justify-center">
          <Loader2 size={20} className="animate-spin text-[#C9A84C]" aria-label={t.common.loading} />
        </div>
      ) : state.status === 'error' ? (
        <div className="text-start">
          <p className="text-sm text-[#2D1F1F]/60 mb-3" role="alert">
            {t.account.refundAccountLoadError}
          </p>
          <button
            type="button"
            onClick={() => {
              if (state.code === 'unauthenticated') void onSessionLost();
              else reload();
            }}
            className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
          >
            {t.common.retry}
          </button>
        </div>
      ) : showForm ? (
        <form onSubmit={(e) => void handleSave(e)} noValidate>
          <RefundAccountFields
            idPrefix="profile-refund"
            iban={iban}
            accountName={accountName}
            onIbanChange={(value) => {
              setIban(value);
              setErrors((prev) => ({ ...prev, refund_iban: undefined }));
            }}
            onAccountNameChange={(value) => {
              setAccountName(value);
              setErrors((prev) => ({ ...prev, refund_account_name: undefined }));
            }}
            errors={errors}
            disabled={busy}
            ibanMaxLength={REFUND_IBAN_INPUT_MAX}
            nameMaxLength={REFUND_ACCOUNT_NAME_MAX}
            placeholder={REFUND_IBAN_PLACEHOLDER}
          />
          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
            {account ? (
              <button
                type="button"
                onClick={() => {
                  setMode('view');
                  setErrors({});
                }}
                disabled={busy}
                className={secondaryButton}
              >
                {t.account.cancel}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="h-12 px-8 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
              {t.account.refundAccountSave}
            </button>
          </div>
        </form>
      ) : account ? (
        <div className="text-start">
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                {t.account.refundAccountIban}
              </dt>
              <dd className="text-[#2D1F1F] font-medium tracking-wide">
                <bdi dir="ltr">{maskIban(account.iban)}</bdi>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                {t.account.refundAccountName}
              </dt>
              <dd className="text-[#2D1F1F] break-words">{account.accountName}</dd>
            </div>
          </dl>

          {mode === 'confirm-remove' ? (
            <div className="mt-6 rounded-md border border-red-100 bg-red-50/60 p-4" role="alertdialog" aria-labelledby="refund-remove-text">
              <p id="refund-remove-text" className="text-sm text-[#2D1F1F]/75 leading-relaxed">
                {t.account.refundAccountRemoveConfirm}
              </p>
              <div className="mt-4 flex flex-col-reverse sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  disabled={busy}
                  className={secondaryButton}
                >
                  {t.account.refundAccountKeep}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemove()}
                  disabled={busy}
                  className="h-10 px-4 bg-red-500 text-white rounded-md text-[11px] font-black tracking-[0.15em] uppercase hover:bg-red-600 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                  {t.account.refundAccountRemove}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={startEdit} className={secondaryButton}>
                {t.account.refundAccountEdit}
              </button>
              <button
                type="button"
                onClick={() => setMode('confirm-remove')}
                className="h-10 px-4 rounded-md text-[11px] font-black tracking-[0.15em] uppercase text-red-600 hover:bg-red-50 transition-colors"
              >
                {t.account.refundAccountRemove}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
