'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { AlertTriangle, Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import type { AccountDeletionBlocker, AccountDeletionCheck } from '@/types';
import type {
  AccountDeletionCheckJson,
  DeleteAccountErrorJson,
} from '@/types/api/account';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';

type DeleteAccountCardProps = {
  disabled?: boolean;
};

/**
 * checking → blocked (open orders, refunds, returns) or form → confirm.
 * The password is asked only once the backend says the account can go.
 */
type Step = 'checking' | 'failed' | 'blocked' | 'form' | 'confirm';

type ReasonChoice = '' | 'not_using' | 'other_account' | 'privacy' | 'other';

/** The backend's limit for the optional reason. */
const REASON_MAX_LENGTH = 500;

const secondaryButtonClassName =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-[#2D1F1F]/15 px-4 py-3 text-sm font-bold text-[#2D1F1F] transition-colors hover:bg-[#FAF7F2] disabled:opacity-50';

const darkButtonClassName =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-[#2D1F1F] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#C9A84C] hover:text-[#2D1F1F]';

const dangerButtonClassName =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50';

async function readJson(
  response: Response,
): Promise<Record<string, unknown> | null> {
  const data: unknown = await response.json().catch(() => undefined);

  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

export default function DeleteAccountCard({
  disabled = false,
}: DeleteAccountCardProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const { t, isRTL } = useLanguage();
  const { showToast } = useApp();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('checking');
  const [check, setCheck] = useState<AccountDeletionCheck | null>(null);
  const [blockers, setBlockers] = useState<AccountDeletionBlocker[]>([]);
  const [reasonChoice, setReasonChoice] = useState<ReasonChoice>('');
  const [reasonText, setReasonText] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submittingRef = useRef(false);
  /** Lets a check that answers after the dialog closed (or reopened) be ignored. */
  const checkRunRef = useRef(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  const copy = t.deleteAccount;

  useEffect(() => {
    if (open && step === 'form' && passwordError) {
      passwordRef.current?.focus();
    }
  }, [open, step, passwordError]);

  const resetForm = () => {
    setCheck(null);
    setBlockers([]);
    setReasonChoice('');
    setReasonText('');
    setCurrentPassword('');
    setShowPassword(false);
    setUnderstood(false);
    setPasswordError('');
    setFormError('');
  };

  const signOutExpired = async () => {
    setOpen(false);
    setCurrentPassword('');
    showToast(copy.expired, 'error');

    await logout();

    router.replace('/login');
    router.refresh();
  };

  const showBlocked = (list: AccountDeletionBlocker[]) => {
    // A "no" from the backend without reasons still blocks.
    setBlockers(list.length > 0 ? list : [{ code: 'other', count: 0 }]);
    setStep('blocked');
  };

  const runCheck = async () => {
    const run = ++checkRunRef.current;
    setStep('checking');

    try {
      const response = await fetch('/api/account/deletion-check', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const result = await readJson(response);

      if (run !== checkRunRef.current) return;

      const next = (result as Partial<AccountDeletionCheckJson> | null)?.check;

      if (response.ok && result?.ok === true && next) {
        setCheck(next);

        if (next.canDelete) {
          setStep('form');
        } else {
          showBlocked(next.blockers);
        }
        return;
      }

      if (response.status === 401) {
        await signOutExpired();
        return;
      }

      setStep('failed');
    } catch (error) {
      if (run !== checkRunRef.current) return;

      console.error(
        'Account deletion check failed',
        error instanceof Error ? error.name : 'unknown',
      );

      setStep('failed');
    }
  };

  const openDialog = () => {
    if (disabled || submittingRef.current) return;

    resetForm();
    setOpen(true);
    void runCheck();
  };

  const closeDialog = () => {
    if (submittingRef.current) return;

    checkRunRef.current += 1;
    setOpen(false);
    resetForm();
  };

  const reasonLabels: Record<Exclude<ReasonChoice, ''>, string> = {
    not_using: copy.reasonNotUsing,
    other_account: copy.reasonOtherAccount,
    privacy: copy.reasonPrivacy,
    other: copy.reasonOther,
  };

  /** Sent in the shopper's language: the chosen answer, or what they typed under "Other". */
  const reasonToSend = (): string => {
    if (reasonChoice === '') return '';
    if (reasonChoice === 'other') {
      return reasonText.trim().slice(0, REASON_MAX_LENGTH) || copy.reasonOther;
    }
    return reasonLabels[reasonChoice];
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!open || disabled || step !== 'form' || submittingRef.current) return;

    setPasswordError('');
    setFormError('');

    if (currentPassword === '') {
      setPasswordError(copy.required);
      passwordRef.current?.focus();
      return;
    }

    if (!understood) return;

    setStep('confirm');
  };

  const backToForm = (field: 'password' | 'form', message: string) => {
    setStep('form');

    if (field === 'password') {
      setPasswordError(message);
    } else {
      setFormError(message);
    }
  };

  const deleteAccount = async () => {
    if (!open || disabled || step !== 'confirm' || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setPasswordError('');
    setFormError('');

    const reason = reasonToSend();

    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          ...(reason ? { reason } : {}),
        }),
      });

      const result = await readJson(response);

      if (response.ok && result?.ok === true) {
        setOpen(false);
        setCurrentPassword('');
        setShowPassword(false);

        showToast(copy.success, 'success');

        // The delete route has already cleared the auth cookies, so this
        // makes no backend logout call: it forgets the user and this
        // browser's push token.
        await logout();

        router.replace('/');
        router.refresh();
        return;
      }

      if (response.status === 401) {
        await signOutExpired();
        return;
      }

      const error = result as Partial<DeleteAccountErrorJson> | null;

      switch (error?.code) {
        case 'incorrect_password':
          backToForm('password', copy.incorrect);
          return;
        case 'invalid_input':
          backToForm('password', copy.required);
          return;
        case 'blocked':
          // Something opened since the check (e.g. an order was paid).
          if (error?.blockers && error.blockers.length > 0) {
            showBlocked(error.blockers);
          } else {
            void runCheck();
          }
          return;
        case 'too_many_attempts':
          backToForm('form', copy.tooManyAttempts);
          return;
        case 'validation':
          backToForm('form', copy.validation);
          return;
        case 'forbidden':
          backToForm('form', copy.forbidden);
          return;
        default:
          backToForm('form', copy.unavailable);
      }
    } catch (error) {
      console.error(
        'Account deletion failed',
        error instanceof Error ? error.name : 'unknown',
      );

      backToForm('form', copy.unavailable);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const blockerLine = (blocker: AccountDeletionBlocker): string => {
    const template =
      blocker.code === 'active_orders'
        ? copy.blockedActiveOrders
        : blocker.code === 'pending_refunds'
          ? copy.blockedPendingRefunds
          : blocker.code === 'open_returns'
            ? copy.blockedOpenReturns
            : copy.blockedOther;

    return blocker.count > 0
      ? template.replace('{count}', String(blocker.count))
      : template.replace(/\s*\(\{count\}\)/, '');
  };

  const title =
    step === 'blocked'
      ? copy.blockedTitle
      : step === 'form'
        ? copy.confirmTitle
        : step === 'confirm'
          ? copy.finalTitle
          : copy.title;

  const unpaidCount = check?.unpaidOrdersToCancel ?? 0;
  const hasOpenReturns = blockers.some(
    (blocker) => blocker.code === 'open_returns',
  );

  return (
    <>
      <section
        dir={isRTL ? 'rtl' : 'ltr'}
        className="rounded-xl border border-red-200 bg-white p-8 sm:p-10"
      >
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-red-50">
            <Trash2 size={18} className="text-red-600" />
          </div>

          <div>
            <h2 className="font-serif text-lg text-[#2D1F1F]">
              {copy.title}
            </h2>

            <p className="mt-1 text-sm leading-relaxed text-[#2D1F1F]/60">
              {copy.description}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openDialog}
          disabled={disabled || isSubmitting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300 px-5 py-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 size={16} />
          {copy.openButton}
        </button>
      </section>

      <Dialog
        open={open}
        onClose={closeDialog}
        className="relative z-[120]"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/40" />

        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <DialogPanel
              dir={isRTL ? 'rtl' : 'ltr'}
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl sm:p-8"
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                  step === 'blocked' ? 'bg-amber-50' : 'bg-red-50'
                }`}
              >
                {step === 'blocked' ? (
                  <AlertTriangle size={22} className="text-amber-600" />
                ) : (
                  <Trash2 size={22} className="text-red-600" />
                )}
              </div>

              <DialogTitle className="font-serif text-xl text-[#2D1F1F]">
                {title}
              </DialogTitle>

              {step === 'checking' ? (
                <>
                  <p
                    role="status"
                    className="mt-4 flex items-center gap-3 text-sm text-[#2D1F1F]/70"
                  >
                    <Loader2
                      size={18}
                      className="animate-spin text-[#C9A84C]"
                    />
                    {copy.checking}
                  </p>

                  <div className="mt-6 flex">
                    <button
                      type="button"
                      onClick={closeDialog}
                      className={secondaryButtonClassName}
                    >
                      {copy.cancel}
                    </button>
                  </div>
                </>
              ) : null}

              {step === 'failed' ? (
                <>
                  <p
                    role="alert"
                    className="mt-4 rounded-md bg-red-50 p-3 text-sm leading-relaxed text-red-700"
                  >
                    {copy.checkFailed}
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={closeDialog}
                      className={secondaryButtonClassName}
                    >
                      {copy.close}
                    </button>

                    <button
                      type="button"
                      onClick={() => void runCheck()}
                      className={darkButtonClassName}
                    >
                      {copy.tryAgain}
                    </button>
                  </div>
                </>
              ) : null}

              {step === 'blocked' ? (
                <>
                  <ul className="mt-4 space-y-2">
                    {blockers.map((blocker) => (
                      <li
                        key={blocker.code}
                        className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-600"
                        />
                        {blockerLine(blocker)}
                      </li>
                    ))}
                  </ul>

                  <Description className="mt-4 text-sm leading-7 text-[#2D1F1F]/65">
                    {copy.blockedHint}
                  </Description>

                  <div className="mt-6 flex flex-col gap-3">
                    <Link
                      href="/account"
                      onClick={() => setOpen(false)}
                      className={darkButtonClassName}
                    >
                      {copy.viewOrders}
                    </Link>

                    {hasOpenReturns ? (
                      <Link
                        href="/returns"
                        onClick={() => setOpen(false)}
                        className={secondaryButtonClassName}
                      >
                        {copy.viewReturns}
                      </Link>
                    ) : null}

                    <button
                      type="button"
                      onClick={closeDialog}
                      className={secondaryButtonClassName}
                    >
                      {copy.close}
                    </button>
                  </div>
                </>
              ) : null}

              {step === 'form' ? (
                <>
                  <Description className="mt-3 text-sm leading-7 text-[#2D1F1F]/65">
                    {copy.warning}
                  </Description>

                  <div className="mt-5 space-y-3 rounded-md border border-[#2D1F1F]/10 bg-[#FAF7F2] p-4 text-sm leading-6">
                    <div>
                      <p className="font-bold text-[#2D1F1F]">
                        {copy.deletedTitle}
                      </p>
                      <p className="mt-1 text-[#2D1F1F]/70">
                        {copy.deletedList}
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-[#2D1F1F]">
                        {copy.keptTitle}
                      </p>
                      <p className="mt-1 text-[#2D1F1F]/70">
                        {copy.keptList}
                      </p>
                    </div>

                    <p className="text-[#2D1F1F]/70">{copy.signedOutNote}</p>
                  </div>

                  {unpaidCount > 0 ? (
                    <p className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                      <AlertTriangle
                        size={16}
                        className="mt-1 flex-shrink-0 text-amber-600"
                      />
                      {(unpaidCount === 1
                        ? copy.unpaidOne
                        : copy.unpaidOther
                      ).replace('{count}', String(unpaidCount))}
                    </p>
                  ) : null}

                  <form
                    onSubmit={handleFormSubmit}
                    noValidate
                    className="mt-5"
                  >
                    <label
                      htmlFor="delete-account-reason"
                      className="mb-2 block text-sm font-bold text-[#2D1F1F]"
                    >
                      {copy.reasonLabel}
                    </label>

                    <select
                      id="delete-account-reason"
                      value={reasonChoice}
                      onChange={(event) =>
                        setReasonChoice(event.target.value as ReasonChoice)
                      }
                      className="h-11 w-full rounded-md border border-[#2D1F1F]/15 bg-[#FAF7F2] px-3 text-sm text-[#2D1F1F] focus:border-[#C9A84C] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20"
                    >
                      <option value="">{copy.reasonPlaceholder}</option>
                      <option value="not_using">{copy.reasonNotUsing}</option>
                      <option value="other_account">
                        {copy.reasonOtherAccount}
                      </option>
                      <option value="privacy">{copy.reasonPrivacy}</option>
                      <option value="other">{copy.reasonOther}</option>
                    </select>

                    {reasonChoice === 'other' ? (
                      <div className="mt-3">
                        <label
                          htmlFor="delete-account-reason-text"
                          className="mb-2 block text-sm text-[#2D1F1F]/70"
                        >
                          {copy.reasonOtherLabel}
                        </label>

                        <textarea
                          id="delete-account-reason-text"
                          value={reasonText}
                          maxLength={REASON_MAX_LENGTH}
                          rows={3}
                          onChange={(event) =>
                            setReasonText(
                              event.target.value.slice(0, REASON_MAX_LENGTH),
                            )
                          }
                          className="w-full resize-y rounded-md border border-[#2D1F1F]/15 bg-[#FAF7F2] px-3 py-2 text-sm text-[#2D1F1F] focus:border-[#C9A84C] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20"
                        />

                        <p className="mt-1 text-end text-xs text-[#2D1F1F]/50">
                          {copy.reasonCounter.replace(
                            '{count}',
                            String(reasonText.length),
                          )}
                        </p>
                      </div>
                    ) : null}

                    <label
                      htmlFor="delete-account-password"
                      className="mb-2 mt-5 block text-sm font-bold text-[#2D1F1F]"
                    >
                      {copy.password}
                    </label>

                    <div className="relative">
                      <input
                        ref={passwordRef}
                        id="delete-account-password"
                        name="current_password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={currentPassword}
                        onChange={(event) => {
                          setCurrentPassword(event.target.value);
                          setPasswordError('');
                          setFormError('');
                        }}
                        aria-invalid={Boolean(passwordError)}
                        aria-describedby={
                          passwordError
                            ? 'delete-account-password-error'
                            : undefined
                        }
                        className={`h-11 w-full rounded-md border bg-[#FAF7F2] text-sm text-[#2D1F1F] transition-colors focus:outline-none focus:ring-2 ${
                          isRTL ? 'pl-11 pr-4' : 'pl-4 pr-11'
                        } ${
                          passwordError
                            ? 'border-red-400 focus:ring-red-200'
                            : 'border-[#2D1F1F]/15 focus:border-[#C9A84C] focus:ring-[#C9A84C]/20'
                        }`}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((visible) => !visible)
                        }
                        aria-label={
                          showPassword
                            ? copy.hidePassword
                            : copy.showPassword
                        }
                        aria-pressed={showPassword}
                        className={`absolute top-1/2 -translate-y-1/2 rounded p-1 text-[#2D1F1F]/50 hover:text-[#2D1F1F] ${
                          isRTL ? 'left-3' : 'right-3'
                        }`}
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>

                    {passwordError ? (
                      <p
                        id="delete-account-password-error"
                        role="alert"
                        className="mt-2 text-sm text-red-600"
                      >
                        {passwordError}
                      </p>
                    ) : null}

                    <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#2D1F1F]">
                      <input
                        type="checkbox"
                        checked={understood}
                        onChange={(event) =>
                          setUnderstood(event.target.checked)
                        }
                        className="mt-1 h-4 w-4 flex-shrink-0 accent-red-600"
                      />
                      <span>{copy.understand}</span>
                    </label>

                    {formError ? (
                      <p
                        role="alert"
                        className="mt-4 rounded-md bg-red-50 p-3 text-sm leading-relaxed text-red-700"
                      >
                        {formError}
                      </p>
                    ) : null}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={closeDialog}
                        className={secondaryButtonClassName}
                      >
                        {copy.cancel}
                      </button>

                      <button
                        type="submit"
                        disabled={
                          disabled || currentPassword === '' || !understood
                        }
                        className={dangerButtonClassName}
                      >
                        <Trash2 size={16} />
                        {copy.confirm}
                      </button>
                    </div>
                  </form>
                </>
              ) : null}

              {step === 'confirm' ? (
                <>
                  <Description className="mt-3 text-sm leading-7 text-[#2D1F1F]/65">
                    {copy.finalWarning}
                  </Description>

                  <div
                    className="mt-6 flex flex-col gap-3 sm:flex-row"
                    aria-busy={isSubmitting}
                  >
                    <button
                      type="button"
                      onClick={() => setStep('form')}
                      disabled={isSubmitting}
                      className={secondaryButtonClassName}
                    >
                      {copy.goBack}
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteAccount()}
                      disabled={disabled || isSubmitting}
                      className={dangerButtonClassName}
                    >
                      {isSubmitting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}

                      {isSubmitting ? copy.submitting : copy.finalConfirm}
                    </button>
                  </div>
                </>
              ) : null}
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}
