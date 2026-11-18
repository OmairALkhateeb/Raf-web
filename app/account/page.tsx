'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Package, MapPin, X, Loader2, LocateFixed } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import type { AccountOrder, Address } from '@/types';
import type {
  AddressFormValues,
  AddressPatchInput,
  AddressWriteInput,
} from '@/lib/account/validate';
import {
  ADDRESS_LIMITS,
  DEFAULT_ADDRESS_COUNTRY,
  getAddressFormErrorKey,
  optionalText,
} from '@/lib/account/validate';
import { formatCustomerAddressParts } from '@/lib/account/formatAddress';
import {
  DELIVERY_COUNTRY,
  deliveryCityLabel,
  findDeliveryCity,
} from '@/lib/account/delivery-cities';
import { useDeliveryZones } from '@/lib/account/useDeliveryZones';
import {
  isLegacyPhoneValue,
  parseStoredPhoneCountry,
  toPhoneCountry,
  type PhoneCountry,
} from '@/lib/phone/international';
import CountrySelect from '@/components/common/CountrySelect';
import InternationalPhoneInput from '@/components/common/InternationalPhoneInput';
import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  fetchOrders,
  updateAddress,
} from '@/lib/api/account';
import { localizeAccountError } from '@/lib/account/messages';
import type { AccountClientError } from '@/types/api/account';
import AccountSidebar from '@/components/account/AccountSidebar';
import AccountOrderRow from '@/components/account/AccountOrderRow';
import { formatMoney } from '@/utils/formatPrice';
import { loginHref } from '@/lib/auth/next-path';
import AddressLocationPicker, { mapsHref } from '@/components/account/AddressLocationPicker';
import { sameLocation } from '@/lib/account/location';
import { AccountPageSkeleton, ListSkeleton, SkeletonBlock } from '@/components/common/Loading';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

const inputClass =
  'w-full h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

type AddressForm = AddressFormValues;
type LoadStatus = 'loading' | 'ready' | 'error';

const emptyForm: AddressForm = {
  label: '',
  fullName: '',
  phone: '',
  street: '',
  addressLine2: '',
  city: '',
  area: '',
  postalCode: '',
  country: DEFAULT_ADDRESS_COUNTRY,
  isDefault: false,
  location: null,
};

const UNAVAILABLE_STAT = '—';

function toCreateInput(form: AddressForm): AddressWriteInput {
  return {
    label: optionalText(form.label),
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    street: form.street.trim(),
    addressLine2: optionalText(form.addressLine2),
    city: form.city.trim(),
    area: optionalText(form.area),
    postalCode: optionalText(form.postalCode),
    country: form.country.trim().toUpperCase(),
    isDefault: form.isDefault,
    location: form.location,
  };
}

function toPatchInput(
  original: Address,
  form: AddressForm,
): AddressPatchInput | null {
  const patch: AddressPatchInput = {};
  const label = optionalText(form.label);
  if (label !== optionalText(original.label ?? '')) patch.label = label;

  if (form.fullName.trim() !== original.fullName)
    patch.fullName = form.fullName.trim();
  if (form.phone.trim() !== original.phone) patch.phone = form.phone.trim();
  if (form.street.trim() !== original.street) patch.street = form.street.trim();
  if (form.city.trim() !== original.city) patch.city = form.city.trim();

  const addressLine2 = optionalText(form.addressLine2);
  if (addressLine2 !== optionalText(original.addressLine2 ?? '')) {
    patch.addressLine2 = addressLine2;
  }

  const area = optionalText(form.area);
  if (area !== optionalText(original.area ?? '')) patch.area = area;

  const postalCode = optionalText(form.postalCode);
  if (postalCode !== optionalText(original.postalCode ?? '')) {
    patch.postalCode = postalCode;
  }

  const country = form.country.trim().toUpperCase() || null;
  const originalCountry = (original.country ?? '').trim().toUpperCase() || null;
  if (country !== originalCountry) patch.country = country;

  if (form.isDefault !== original.isDefault) patch.isDefault = form.isDefault;
  if (!sameLocation(form.location, original.location)) patch.location = form.location;

  return Object.keys(patch).length > 0 ? patch : null;
}

export default function AccountPage() {
  const { language, t, isRTL } = useLanguage();
  const zones = useDeliveryZones();
  const { showToast } = useApp();
  const router = useRouter();
  const { user, isAuthenticated, isAuthLoading, logout } = useAuth();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesStatus, setAddressesStatus] = useState<LoadStatus>('loading');
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [ordersStatus, setOrdersStatus] = useState<LoadStatus>('loading');
  const [orderTotal, setOrderTotal] = useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cityNeedsReselect, setCityNeedsReselect] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry | undefined>(
    DEFAULT_ADDRESS_COUNTRY,
  );
  const [phoneResetToken, setPhoneResetToken] = useState(0);
  const [phoneIncomplete, setPhoneIncomplete] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [legacyPhoneUi, setLegacyPhoneUi] = useState(false);

  const loadEpochRef = useRef(0);
  const phoneFollowsAddressRef = useRef(true);
  const savedPhoneRef = useRef('');
  const savingRef = useRef(false);
  const deletingRef = useRef(false);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace(loginHref('/account'));
    }
  }, [isAuthLoading, isAuthenticated, router]);

  const handleSessionLost = useCallback(async () => {
    await logout();
    router.replace(loginHref('/account'));
  }, [logout, router]);

  const handleAuthFailure = useCallback(
    async (error: AccountClientError): Promise<boolean> => {
      if (error.code !== 'unauthenticated') return false;
      await handleSessionLost();
      return true;
    },
    [handleSessionLost],
  );

  const loadAddresses = useCallback(
    async (epoch: number) => {
      const result = await fetchAddresses();
      if (loadEpochRef.current !== epoch) return;
      if (!result.ok) {
        if (await handleAuthFailure(result)) return;
        setAddresses([]);
        setAddressesStatus('error');
        return;
      }
      setAddresses(result.data);
      setAddressesStatus('ready');
    },
    [handleAuthFailure],
  );

  const loadOrders = useCallback(
    async (epoch: number) => {
      const result = await fetchOrders();
      if (loadEpochRef.current !== epoch) return;
      if (!result.ok) {
        if (await handleAuthFailure(result)) return;
        setOrders([]);
        setOrderTotal(null);
        setOrdersStatus('error');
        return;
      }
      setOrders(result.data.orders);
      setOrderTotal(result.data.meta.total);
      setOrdersStatus('ready');
    },
    [handleAuthFailure],
  );

  useEffect(() => {
    if (isAuthLoading) return;

    const epoch = ++loadEpochRef.current;

    void (async () => {
      if (!isAuthenticated) {
        setAddresses([]);
        setOrders([]);
        setOrderTotal(null);
        return;
      }

      setAddressesStatus('loading');
      setOrdersStatus('loading');
      await Promise.all([loadAddresses(epoch), loadOrders(epoch)]);
    })();
  }, [isAuthLoading, isAuthenticated, loadAddresses, loadOrders]);

  const handleLogout = async () => {
    await logout();
    showToast(t.common.signedOut, 'success');
    router.push('/');
  };

  const updateForm = (field: keyof AddressForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const openAddModal = () => {
    if (isSaving) return;
    setEditingId(null);
    setFormError(null);
    setForm({ ...emptyForm, isDefault: addresses.length === 0 });
    setCityNeedsReselect(false);
    savedPhoneRef.current = '';
    phoneFollowsAddressRef.current = true;
    setPhoneCountry(DEFAULT_ADDRESS_COUNTRY);
    setPhoneResetToken((token) => token + 1);
    setPhoneIncomplete(false);
    setPhoneTouched(false);
    setLegacyPhoneUi(false);
    setIsModalOpen(true);
  };

  const openEditModal = (addr: Address) => {
    if (isSaving) return;
    setEditingId(addr.id);
    setFormError(null);
    // A city saved before the delivery-city list (or typed in Arabic) has no
    // zone; leave the select empty so the customer picks again.
    const deliveryCity = findDeliveryCity(addr.city, zones);
    setCityNeedsReselect(deliveryCity === null);
    setForm({
      label: addr.label ?? '',
      fullName: addr.fullName,
      phone: addr.phone,
      street: addr.street,
      addressLine2: addr.addressLine2 ?? '',
      city: deliveryCity ?? '',
      area: addr.area ?? '',
      postalCode: addr.postalCode ?? '',
      country: addr.country ?? '',
      isDefault: addr.isDefault,
      location: addr.location,
    });
    savedPhoneRef.current = addr.phone;
    const parsedPhoneCountry = parseStoredPhoneCountry(addr.phone);
    const addressPhoneCountry = toPhoneCountry(addr.country);
    if (parsedPhoneCountry) {
      setPhoneCountry(parsedPhoneCountry);
      phoneFollowsAddressRef.current =
        parsedPhoneCountry === addressPhoneCountry;
    } else {
      phoneFollowsAddressRef.current = false;
      setPhoneCountry(addressPhoneCountry);
    }
    setPhoneResetToken((token) => token + 1);
    setPhoneIncomplete(false);
    setPhoneTouched(false);
    setLegacyPhoneUi(isLegacyPhoneValue(addr.phone));
    setIsModalOpen(true);
  };

  const handleCountryChange = (code: string) => {
    setForm((prev) => ({ ...prev, country: code }));
    if (!form.phone.trim() && phoneFollowsAddressRef.current) {
      const nextPhoneCountry = toPhoneCountry(code);
      if (nextPhoneCountry) {
        setPhoneCountry(nextPhoneCountry);
        setPhoneResetToken((token) => token + 1);
      }
    }
  };

  const handlePhoneChange = (next: string) => {
    if (legacyPhoneUi && next !== savedPhoneRef.current) {
      setLegacyPhoneUi(false);
      const replacement = next.trim().startsWith('+') ? next : '';
      setForm((prev) => ({ ...prev, phone: replacement }));
      phoneFollowsAddressRef.current = !replacement.trim();
      setPhoneResetToken((token) => token + 1);
      setPhoneIncomplete(false);
      return;
    }

    setForm((prev) => ({ ...prev, phone: next }));
    if (next.trim()) phoneFollowsAddressRef.current = false;
  };

  const handlePhoneCountryChange = (country?: PhoneCountry) => {
    if (!country) return;
    setPhoneCountry(country);
    phoneFollowsAddressRef.current = country === form.country;
  };

  const closeAddressModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setFormError(null);
  };

  const editingAddress = editingId
    ? addresses.find((addr) => addr.id === editingId)
    : undefined;
  const originalPhone = editingAddress?.phone ?? '';
  const allowUnchangedLegacyPhone = Boolean(
    editingId &&
      isLegacyPhoneValue(originalPhone) &&
      form.phone === originalPhone,
  );
  const formValidationOptions = {
    allowUnchangedLegacyPhone,
    phoneIncomplete,
    zones,
  };
  const formErrorKey = getAddressFormErrorKey(form, formValidationOptions);
  const isFormValid = formErrorKey === null;
  const phoneErrorKey =
    formErrorKey === 'addressPhoneRequired' ||
    formErrorKey === 'addressPhoneInvalid' ||
    formErrorKey === 'addressPhoneTooLong'
      ? formErrorKey
      : null;
  const countryErrorKey =
    formErrorKey === 'addressCountryRequired' ||
    formErrorKey === 'addressCountryInvalid'
      ? formErrorKey
      : null;
  // Shown after a save attempt, like the form-level error.
  const cityErrorKey =
    formError &&
    (formErrorKey === 'addressCityRequired' ||
      formErrorKey === 'addressCityInvalid')
      ? formErrorKey
      : null;
  const outsideDeliveryCountry =
    Boolean(form.country.trim()) &&
    form.country.trim().toUpperCase() !== DELIVERY_COUNTRY;
  const showPhoneError = Boolean(
    phoneErrorKey && (phoneTouched || phoneIncomplete || formError),
  );
  const phoneDescribedBy = allowUnchangedLegacyPhone
    ? 'address-phone-hint'
    : showPhoneError
      ? 'address-phone-error'
      : undefined;

  const handleSaveAddress = async () => {
    if (savingRef.current) return;
    const saveErrorKey = getAddressFormErrorKey(form, formValidationOptions);
    if (saveErrorKey) {
      setPhoneTouched(true);
      setFormError(t.account[saveErrorKey]);
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setFormError(null);
    const epoch = loadEpochRef.current;

    try {
      if (editingId) {
        const original = addresses.find((a) => a.id === editingId);
        if (!original) {
          setFormError(
            localizeAccountError({ ok: false, code: 'not_found' }, t),
          );
          return;
        }
        const patch = toPatchInput(original, form);
        if (!patch) {
          setIsModalOpen(false);
          return;
        }
        const result = await updateAddress(editingId, patch);
        if (!result.ok) {
          if (await handleAuthFailure(result)) return;
          setFormError(localizeAccountError(result, t));
          return;
        }
      } else {
        const result = await createAddress(toCreateInput(form));
        if (!result.ok) {
          if (await handleAuthFailure(result)) return;
          setFormError(localizeAccountError(result, t));
          return;
        }
      }

      const list = await fetchAddresses();
      if (loadEpochRef.current !== epoch) return;
      if (list.ok) {
        setAddresses(list.data);
        setAddressesStatus('ready');
      } else {
        if (await handleAuthFailure(list)) return;
        setAddressesStatus('error');
      }

      setIsModalOpen(false);
      showToast(editingId ? t.account.addressUpdated : t.account.addressAdded);
    } catch (error) {
      console.error(
        'Address save failed',
        error instanceof Error ? error.name : 'unknown',
      );
      setFormError(
        localizeAccountError({ ok: false, code: 'unavailable' }, t),
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleDeleteAddress = async () => {
    if (!deleteId || deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);
    const epoch = loadEpochRef.current;

    try {
      const result = await deleteAddress(deleteId);
      if (!result.ok) {
        if (await handleAuthFailure(result)) return;
        showToast(localizeAccountError(result, t), 'error');
        return;
      }

      const list = await fetchAddresses();
      if (loadEpochRef.current !== epoch) return;
      if (list.ok) {
        setAddresses(list.data);
        setAddressesStatus('ready');
      } else {
        if (await handleAuthFailure(list)) return;
        setAddressesStatus('error');
      }

      setDeleteId(null);
      showToast(t.account.addressDeleted);
    } catch (error) {
      console.error(
        'Address delete failed',
        error instanceof Error ? error.name : 'unknown',
      );
      showToast(
        localizeAccountError({ ok: false, code: 'unavailable' }, t),
        'error',
      );
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
    }
  };

  if (isAuthLoading || !isAuthenticated || !user) {
    return <AccountPageSkeleton label={t.common.loading} />;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Page header */}
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.account.title}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.account.title}
          </h1>
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        <div
          className="grid lg:grid-cols-[280px_1fr] gap-8 lg:gap-14"
          style={{ alignItems: 'start' }}
        >
          <AccountSidebar
            user={user}
            orderTotal={orderTotal}
            onLogout={() => void handleLogout()}
          />

          {/* Main content */}
          <div className="space-y-8">
            {/* Stats: only numbers we can stand behind. "Delivered" and
                "Total spent" need every order, so they show only while all
                of them fit on this first page (the backend has no totals). */}
            {(() => {
              const allLoaded =
                ordersStatus === 'ready' && orderTotal !== null && orders.length >= orderTotal;
              const paidOrders = orders.filter(
                (order) => order.paymentStatus === 'paid' && order.status !== 'cancelled',
              );
              const currency = paidOrders[0]?.currency ?? 'OMR';
              const stats = [
                {
                  label: t.account.totalOrders,
                  // `null` while loading: a shimmer instead of a dash.
                  value:
                    ordersStatus === 'ready' && orderTotal !== null
                      ? String(orderTotal)
                      : ordersStatus === 'loading'
                        ? null
                        : UNAVAILABLE_STAT,
                },
                ...(allLoaded
                  ? [
                      {
                        label: t.account.totalDelivered,
                        value: String(orders.filter((order) => order.status === 'delivered').length),
                      },
                      {
                        label: t.account.totalSpent,
                        value: formatMoney(
                          paidOrders.reduce((sum, order) => sum + order.grandTotal, 0),
                          language,
                          currency,
                          t.common.omr,
                        ),
                      },
                    ]
                  : []),
              ];
              const cols = stats.length === 3 ? 'grid-cols-3' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1';
              return (
                <div className={`grid ${cols} gap-0 border border-[#2D1F1F]/8 rounded-xl overflow-hidden`}>
                  {stats.map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className={`px-2 py-5 sm:p-6 text-center min-w-0 ${i < stats.length - 1 ? 'border-e border-[#2D1F1F]/8' : ''}`}
                    >
                      {stat.value === null ? (
                        <SkeletonBlock className="h-7 sm:h-9 w-10 mx-auto mb-1" />
                      ) : (
                        <p className="text-xl sm:text-3xl font-serif font-bold text-[#C9A84C] mb-1 break-words">
                          <bdi>{stat.value}</bdi>
                        </p>
                      )}
                      <p className="text-[9px] sm:text-[10px] font-black tracking-[0.12em] sm:tracking-[0.2em] uppercase text-[#2D1F1F]/40">
                        {stat.label}
                      </p>
                    </motion.div>
                  ))}
                </div>
              );
            })()}

            {/* Orders */}
            <div className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D1F1F]/8">
                <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50">
                  {t.account.orders}
                </h3>
              </div>

              {ordersStatus === 'loading' ? (
                <ListSkeleton rows={3} label={t.common.loading} bare />
              ) : ordersStatus === 'error' ? (
                <div className="py-16 text-center px-6">
                  <p className="text-[#2D1F1F]/40 text-sm mb-4">
                    {t.common.error}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const epoch = loadEpochRef.current;
                      setOrdersStatus('loading');
                      void loadOrders(epoch);
                    }}
                    className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                  >
                    {t.common.retry}
                  </button>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-16 text-center">
                  <Package
                    size={32}
                    strokeWidth={1}
                    className="text-[#2D1F1F]/15 mx-auto mb-4"
                  />
                  <p className="text-[#2D1F1F]/40 text-sm">
                    {t.account.noOrders}
                  </p>
                </div>
              ) : (
                <div>
                  {orders.map((order, oi) => (
                    <AccountOrderRow
                      key={order.id}
                      order={order}
                      isLast={oi === orders.length - 1}
                      onChanged={() => {
                        const epoch = loadEpochRef.current;
                        void loadOrders(epoch);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Addresses */}
            <div className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D1F1F]/8">
                <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50">
                  {t.account.addresses}
                </h3>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="hit-area text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                >
                  {t.account.addAddress}
                </button>
              </div>
              {addressesStatus === 'loading' ? (
                <ListSkeleton rows={2} label={t.common.loading} bare />
              ) : addressesStatus === 'error' ? (
                <div className="py-16 text-center px-6">
                  <p className="text-[#2D1F1F]/40 text-sm mb-4">
                    {t.common.error}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const epoch = loadEpochRef.current;
                      setAddressesStatus('loading');
                      void loadAddresses(epoch);
                    }}
                    className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                  >
                    {t.common.retry}
                  </button>
                </div>
              ) : addresses.length === 0 ? (
                <div className="py-16 text-center">
                  <MapPin
                    size={32}
                    strokeWidth={1}
                    className="text-[#2D1F1F]/15 mx-auto mb-4"
                  />
                  <p className="text-[#2D1F1F]/40 text-sm">
                    {t.account.noAddresses}
                  </p>
                </div>
              ) : (
                <div>
                  {addresses.map((addr, ai) => (
                    <div
                      key={addr.id}
                      className={`px-6 py-5 ${ai < addresses.length - 1 ? 'border-b border-[#2D1F1F]/8' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-bold text-[#2D1F1F]">
                              {addr.label || addr.fullName}
                            </span>
                            {addr.isDefault && (
                              <span className="px-2.5 py-0.5 bg-[#C9A84C]/10 text-[#C9A84C] text-[9px] font-black tracking-[0.15em] uppercase rounded-md">
                                {t.account.defaultAddress}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#2D1F1F]/70">
                            {addr.fullName}
                          </p>
                          <p className="text-sm text-[#2D1F1F]/45 mt-0.5">
                            {formatCustomerAddressParts(addr, t, zones, language).join(
                              t.common.listSeparator,
                            )}
                          </p>
                          <p className="text-sm text-[#2D1F1F]/45" dir="ltr">
                            {addr.phone}
                          </p>
                          {addr.location ? (
                            <a
                              href={mapsHref(addr.location)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hit-area-sm inline-flex items-center gap-1.5 mt-1.5 text-xs text-[#C9A84C] hover:text-[#2D1F1F]"
                            >
                              <LocateFixed size={12} aria-hidden />
                              {t.account.locationPinned}
                            </a>
                          ) : null}
                        </div>
                        <div className="flex gap-4 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditModal(addr)}
                            disabled={isSaving || isDeleting}
                            className="hit-area text-[10px] font-bold tracking-[0.1em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors disabled:opacity-40"
                          >
                            {t.account.editAddress}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(addr.id)}
                            disabled={isSaving || isDeleting}
                            className="hit-area text-[10px] font-bold tracking-[0.1em] uppercase text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                          >
                            {t.account.deleteAddress}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit address modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            key="address-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={closeAddressModal}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl max-h-[min(90vh,100%)] flex flex-col overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="address-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D1F1F]/8">
                <h2
                  id="address-modal-title"
                  className="text-base font-serif font-bold text-[#2D1F1F]"
                >
                  {editingId
                    ? t.account.editAddressTitle
                    : t.account.addAddressTitle}
                </h2>
                <button
                  type="button"
                  onClick={closeAddressModal}
                  disabled={isSaving}
                  className="p-1.5 text-[#2D1F1F]/40 hover:text-[#2D1F1F] transition-colors disabled:opacity-40"
                  aria-label={t.account.cancel}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label htmlFor="address-label" className={labelClass}>
                    {t.account.addressLabelField}
                  </label>
                  <input
                    id="address-label"
                    type="text"
                    value={form.label}
                    onChange={(e) => updateForm('label', e.target.value)}
                    placeholder={t.account.addressLabelPlaceholder}
                    maxLength={ADDRESS_LIMITS.label}
                    className={inputClass}
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label htmlFor="address-full-name" className={labelClass}>
                    {t.checkout.fullName}
                  </label>
                  <input
                    id="address-full-name"
                    type="text"
                    value={form.fullName}
                    onChange={(e) => updateForm('fullName', e.target.value)}
                    maxLength={ADDRESS_LIMITS.name}
                    className={inputClass}
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label htmlFor="address-country" className={labelClass}>
                    {t.account.country}
                  </label>
                  <CountrySelect
                    id="address-country"
                    value={form.country}
                    onChange={handleCountryChange}
                    language={language}
                    placeholder={t.account.countryPlaceholder}
                    disabled={isSaving}
                    invalid={Boolean(countryErrorKey)}
                    describedBy={
                      countryErrorKey ? 'address-country-error' : undefined
                    }
                    extraCode={form.country || null}
                  />
                  {outsideDeliveryCountry && !countryErrorKey ? (
                    <p className="mt-2 text-xs text-amber-700">
                      {t.account.omanOnlyNote}
                    </p>
                  ) : null}
                  {countryErrorKey ? (
                    <p
                      id="address-country-error"
                      className="mt-2 text-sm text-red-500"
                      role="alert"
                    >
                      {t.account[countryErrorKey]}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="address-phone" className={labelClass}>
                    {t.checkout.phone}
                  </label>
                  <InternationalPhoneInput
                    id="address-phone"
                    value={form.phone}
                    onChange={handlePhoneChange}
                    onIncompleteChange={setPhoneIncomplete}
                    onCountryChange={handlePhoneCountryChange}
                    onBlur={() => setPhoneTouched(true)}
                    defaultCountry={phoneCountry}
                    language={language}
                    countryLabel={t.account.phoneCountry}
                    phoneLabel={t.checkout.phone}
                    disabled={isSaving}
                    invalid={showPhoneError}
                    describedBy={phoneDescribedBy}
                    maxLength={ADDRESS_LIMITS.phone}
                    resetKey={phoneResetToken}
                    legacyMode={legacyPhoneUi}
                    legacyHint={
                      allowUnchangedLegacyPhone
                        ? t.account.addressPhoneLegacyHint
                        : undefined
                    }
                  />
                  {showPhoneError && phoneErrorKey ? (
                    <p
                      id="address-phone-error"
                      className="mt-2 text-sm text-red-500"
                      role="alert"
                    >
                      {t.account[phoneErrorKey]}
                    </p>
                  ) : null}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="address-city" className={labelClass}>
                      {t.checkout.city}
                    </label>
                    <select
                      id="address-city"
                      value={form.city}
                      onChange={(e) => {
                        updateForm('city', e.target.value);
                        setCityNeedsReselect(false);
                      }}
                      className={inputClass}
                      disabled={isSaving}
                      required
                      aria-invalid={cityErrorKey ? true : undefined}
                      aria-describedby="address-city-hint"
                    >
                      <option value="">{t.account.selectCity}</option>
                      {zones.map((zone) => (
                        <option key={zone.city} value={zone.city}>
                          {deliveryCityLabel(zone.city, t, zones, language)}
                        </option>
                      ))}
                    </select>
                    <p
                      id="address-city-hint"
                      className={`mt-2 text-xs ${cityNeedsReselect ? 'text-amber-700' : 'text-[#2D1F1F]/40'}`}
                    >
                      {cityNeedsReselect
                        ? t.account.cityReselect
                        : t.account.cityHint}
                    </p>
                    {cityErrorKey ? (
                      <p className="mt-1 text-sm text-red-500" role="alert">
                        {t.account[cityErrorKey]}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="address-area" className={labelClass}>
                      {t.account.areaDistrict}
                    </label>
                    <input
                      id="address-area"
                      type="text"
                      value={form.area}
                      onChange={(e) => updateForm('area', e.target.value)}
                      maxLength={ADDRESS_LIMITS.area}
                      className={inputClass}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="address-street" className={labelClass}>
                    {t.checkout.street}
                  </label>
                  <input
                    id="address-street"
                    type="text"
                    value={form.street}
                    onChange={(e) => updateForm('street', e.target.value)}
                    maxLength={ADDRESS_LIMITS.addressLine1}
                    className={inputClass}
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label htmlFor="address-line2" className={labelClass}>
                    {t.account.addressLine2}
                  </label>
                  <input
                    id="address-line2"
                    type="text"
                    value={form.addressLine2}
                    onChange={(e) => updateForm('addressLine2', e.target.value)}
                    placeholder={t.account.addressLine2Placeholder}
                    maxLength={ADDRESS_LIMITS.addressLine2}
                    className={inputClass}
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label htmlFor="address-postal" className={labelClass}>
                    {t.account.postalCode}
                  </label>
                  <input
                    id="address-postal"
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => updateForm('postalCode', e.target.value)}
                    maxLength={ADDRESS_LIMITS.postalCode}
                    className={inputClass}
                    disabled={isSaving}
                  />
                </div>

                <AddressLocationPicker
                  value={form.location}
                  onChange={(location) => setForm((prev) => ({ ...prev, location }))}
                  disabled={isSaving}
                />

                <label
                  className={`flex items-center gap-2.5 cursor-pointer select-none ${isSaving ? 'opacity-40' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => updateForm('isDefault', e.target.checked)}
                    className="w-4 h-4 accent-[#C9A84C]"
                    disabled={isSaving}
                  />
                  <span className="text-sm text-[#2D1F1F]/70">
                    {t.account.setAsDefault}
                  </span>
                </label>

                {formError ? (
                  <p className="text-sm text-red-500" role="alert">
                    {formError}
                  </p>
                ) : null}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveAddress()}
                    disabled={!isFormValid || isSaving}
                    className="flex-1 h-11 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] hover:text-[#2D1F1F] transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    {t.account.saveAddress}
                  </button>
                  <button
                    type="button"
                    onClick={closeAddressModal}
                    disabled={isSaving}
                    className="flex-1 h-11 border border-[#2D1F1F]/15 text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#FAF7F2] transition-colors disabled:opacity-40"
                  >
                    {t.account.cancel}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            key="delete-address-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => {
                if (!isDeleting) setDeleteId(null);
              }}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-2xl max-h-[min(90vh,100%)] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-address-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2
                  id="delete-address-title"
                  className="text-base font-serif font-bold text-[#2D1F1F] mb-2"
                >
                  {t.account.confirmDeleteAddress}
                </h2>
                <p className="text-sm text-[#2D1F1F]/50 mb-6">
                  {t.account.confirmDeleteAddressDesc}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => void handleDeleteAddress()}
                    disabled={isDeleting}
                    className="flex-1 h-11 bg-red-500 text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-red-600 transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    {t.account.deleteAddress}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(null)}
                    disabled={isDeleting}
                    className="flex-1 h-11 border border-[#2D1F1F]/15 text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#FAF7F2] transition-colors disabled:opacity-40"
                  >
                    {t.account.cancel}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
