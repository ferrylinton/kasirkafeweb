import React, { useState, useEffect, useCallback } from 'react';
import {
  Store,
  UserCheck,
  Mail,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Phone,
  MapPin,
  ExternalLink,
  Copy,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../common/Toast';

interface VendorRegisterScreenProps {
  onBackToLogin: () => void;
  onRegistrationSuccess?: (vendorData: { name: string; email: string }) => void;
  initialToken?: string | null;
}

export const VendorRegisterScreen: React.FC<VendorRegisterScreenProps> = ({
  onBackToLogin,
  onRegistrationSuccess,
  initialToken
}) => {
  const { isDarkMode } = useTheme();
  const { showToast } = useToast();

  // Form states
  const [vendorName, setVendorName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Uniqueness & validation states
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);
  const [availability, setAvailability] = useState<{
    vendorName?: { valid: boolean; message: string };
    managerName?: { valid: boolean; message: string };
    email?: { valid: boolean; message: string };
  }>({});

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Success state with email confirmation link info
  const [registrationResult, setRegistrationResult] = useState<{
    success: boolean;
    vendorName: string;
    managerName: string;
    email: string;
    vendorCode: string;
    confirmationUrl: string;
    confirmationToken: string;
  } | null>(null);

  // In-app token confirmation state (if user arrived via link)
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [tokenConfirmed, setTokenConfirmed] = useState<boolean | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [isResending, setIsResending] = useState(false);

  // Handle direct token confirmation if initialToken provided
  useEffect(() => {
    if (initialToken) {
      verifyConfirmationToken(initialToken);
    }
  }, [initialToken]);

  const verifyConfirmationToken = async (token: string) => {
    setVerifyingToken(true);
    try {
      const res = await fetch('/api/vendors/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTokenConfirmed(true);
        setConfirmationMessage(data.message || 'Akun vendor berhasil dikonfirmasi dan aktif!');
        showToast('Konfirmasi email berhasil! Akun vendor telah aktif.', 'success');
      } else {
        setTokenConfirmed(false);
        setConfirmationMessage(data.message || 'Token konfirmasi tidak valid atau telah kadaluwarsa.');
        showToast(data.message || 'Gagal mengonfirmasi akun.', 'error');
      }
    } catch (err: any) {
      setTokenConfirmed(false);
      setConfirmationMessage('Terjadi kesalahan jaringan saat memverifikasi token.');
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setVerifyingToken(false);
    }
  };

  // Debounced check availability when fields change
  useEffect(() => {
    const timer = setTimeout(async () => {
      const cleanV = vendorName.trim();
      const cleanM = managerName.trim();
      const cleanE = email.trim();

      // Only check if fields meet basic lengths
      if (cleanV.length < 3 && cleanM.length < 3 && !cleanE.includes('@')) {
        setAvailability({});
        return;
      }

      setIsCheckingUniqueness(true);
      try {
        const params = new URLSearchParams();
        if (cleanV.length >= 3) params.set('vendorName', cleanV);
        if (cleanM.length >= 3) params.set('managerName', cleanM);
        if (cleanE.includes('@') && cleanE.includes('.')) params.set('email', cleanE);

        const res = await fetch(`/api/vendors/check-availability?${params.toString()}`);
        const data = await res.json();

        if (data.success && data.available) {
          setAvailability({
            vendorName: cleanV.length >= 3 ? {
              valid: data.available.vendorName,
              message: data.messages.vendorName
            } : undefined,
            managerName: cleanM.length >= 3 ? {
              valid: data.available.managerName,
              message: data.messages.managerName
            } : undefined,
            email: cleanE.includes('@') ? {
              valid: data.available.email,
              message: data.messages.email
            } : undefined
          });
        }
      } catch (err) {
        console.warn('Failed to check uniqueness:', err);
      } finally {
        setIsCheckingUniqueness(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [vendorName, managerName, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Strict validation according to requirements:
    // 1. Vendor Name: min 3, max 30
    const cleanVendorName = vendorName.trim();
    if (cleanVendorName.length < 3 || cleanVendorName.length > 30) {
      setFormError('Nama vendor harus antara 3 hingga 30 karakter.');
      showToast('Nama vendor harus antara 3 hingga 30 karakter.', 'error');
      return;
    }

    // 2. Manager Name: min 3, max 30
    const cleanManagerName = managerName.trim();
    if (cleanManagerName.length < 3 || cleanManagerName.length > 30) {
      setFormError('Nama manager harus antara 3 hingga 30 karakter.');
      showToast('Nama manager harus antara 3 hingga 30 karakter.', 'error');
      return;
    }

    // 3. PIN: exact 6 digits
    const cleanPin = pin.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      setFormError('PIN akses kasir harus tepat 6 digit angka.');
      showToast('PIN harus berupa tepat 6 digit angka numerik.', 'error');
      return;
    }

    // 4. Email: valid format
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setFormError('Format alamat email tidak valid.');
      showToast('Format email tidak valid.', 'error');
      return;
    }

    // Check availability states
    if (availability.vendorName && !availability.vendorName.valid) {
      setFormError(availability.vendorName.message);
      showToast(availability.vendorName.message, 'error');
      return;
    }
    if (availability.managerName && !availability.managerName.valid) {
      setFormError(availability.managerName.message);
      showToast(availability.managerName.message, 'error');
      return;
    }
    if (availability.email && !availability.email.valid) {
      setFormError(availability.email.message);
      showToast(availability.email.message, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/vendors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: cleanVendorName,
          managerName: cleanManagerName,
          pin: cleanPin,
          email: cleanEmail,
          phone: phone.trim(),
          address: address.trim(),
          currency: 'IDR'
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.message || data.error || 'Pendaftaran vendor gagal diproses.';
        setFormError(errorMsg);
        showToast(errorMsg, 'error');
        return;
      }

      showToast('Registrasi vendor berhasil! Tautan konfirmasi telah dikirimkan ke email Anda.', 'success');
      setRegistrationResult({
        success: true,
        vendorName: data.vendor?.name || cleanVendorName,
        managerName: data.manager?.name || cleanManagerName,
        email: cleanEmail,
        vendorCode: data.vendor?.code || 'SPS',
        confirmationUrl: data.confirmationUrl || '',
        confirmationToken: data.confirmationToken || ''
      });

      if (onRegistrationSuccess) {
        onRegistrationSuccess({ name: cleanVendorName, email: cleanEmail });
      }
    } catch (err: any) {
      const msg = err.message || 'Terjadi gangguan koneksi ke server.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!registrationResult?.email) return;
    setIsResending(true);
    try {
      const res = await fetch('/api/vendors/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registrationResult.email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Tautan konfirmasi baru berhasil dikirim ulang ke email!', 'success');
        if (data.confirmationUrl) {
          setRegistrationResult(prev => prev ? {
            ...prev,
            confirmationUrl: data.confirmationUrl,
            confirmationToken: data.confirmationToken || prev.confirmationToken
          } : null);
        }
      } else {
        showToast(data.message || 'Gagal mengirim ulang email.', 'error');
      }
    } catch (e) {
      showToast('Gangguan jaringan saat mengirim ulang email.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const copyConfirmationLink = () => {
    if (!registrationResult?.confirmationUrl) return;
    navigator.clipboard.writeText(registrationResult.confirmationUrl);
    showToast('Tautan konfirmasi berhasil disalin ke clipboard!', 'success');
  };

  // -------------------------------------------------------------
  // VIEW: Token Verification Screen (Accessed via email link)
  // -------------------------------------------------------------
  if (initialToken || verifyingToken || tokenConfirmed !== null) {
    return (
      <div
        id="vendor-token-verify-screen"
        className="min-h-screen w-full flex items-center justify-center p-4 bg-[#fff8f6] dark:bg-[#1a1412] text-stone-800 dark:text-stone-100"
      >
        <div className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl p-8 border border-stone-200/80 dark:border-stone-800 shadow-xl text-center">
          {verifyingToken ? (
            <div className="py-8 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full border-4 border-orange-500 border-t-transparent animate-spin mb-4" />
              <h2 className="text-xl font-bold font-heading">Memverifikasi Tautan...</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
                Harap tunggu, sistem sedang mengaktifkan akun vendor Anda.
              </p>
            </div>
          ) : tokenConfirmed ? (
            <div className="py-6 flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <CheckCircle2 size={36} />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 mb-2">
                Aktif & Terverifikasi
              </span>
              <h2 className="text-2xl font-bold font-heading text-stone-900 dark:text-white">
                Konfirmasi Berhasil!
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-300 mt-2 leading-relaxed">
                {confirmationMessage || 'Akun vendor dan hak akses MANAGER Anda telah resmi aktif. Silakan masuk untuk mulai mengelola katalog menu dan kasir.'}
              </p>

              <button
                id="btn-goto-login-confirmed"
                onClick={onBackToLogin}
                className="mt-6 w-full py-3.5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2"
              >
                <span>Masuk ke SipSpot POS</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
                <AlertCircle size={36} />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 mb-2">
                Verifikasi Gagal
              </span>
              <h2 className="text-xl font-bold font-heading text-stone-900 dark:text-white">
                Tautan Tidak Valid
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-300 mt-2 leading-relaxed">
                {confirmationMessage || 'Tautan konfirmasi tidak ditemukan atau telah kadaluwarsa (berlaku 24 jam).'}
              </p>

              <button
                id="btn-back-login-failed"
                onClick={onBackToLogin}
                className="mt-6 w-full py-3 px-6 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-semibold text-sm transition-all"
              >
                Kembali ke Halaman Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: Registration Success & Email Confirmation Instructions
  // -------------------------------------------------------------
  if (registrationResult) {
    return (
      <div
        id="vendor-registration-success-screen"
        className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#fff8f6] dark:bg-[#1a1412] text-stone-800 dark:text-stone-100"
      >
        <div className="w-full max-w-lg bg-white dark:bg-[#251e1c] rounded-3xl p-6 sm:p-8 border border-stone-200/80 dark:border-stone-800 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Mail size={32} />
            </div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 mb-2">
              Langkah Terakhir
            </span>
            <h2 className="text-2xl font-bold font-heading text-stone-900 dark:text-white">
              Cek Email Anda
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
              Tautan konfirmasi pendaftaran telah kami kirimkan ke alamat email terdaftar:
            </p>
            <div className="mt-2 inline-block px-3.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 font-mono text-xs font-bold text-orange-600 dark:text-orange-400">
              {registrationResult.email}
            </div>
          </div>

          {/* Details summary */}
          <div className="bg-stone-50 dark:bg-stone-900/60 rounded-2xl p-4 border border-stone-200/70 dark:border-stone-800 space-y-2.5 text-xs mb-6">
            <div className="flex justify-between items-center py-1 border-b border-stone-200/50 dark:border-stone-800/60">
              <span className="text-stone-500 dark:text-stone-400">Nama Vendor:</span>
              <span className="font-bold text-stone-900 dark:text-white">{registrationResult.vendorName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-stone-200/50 dark:border-stone-800/60">
              <span className="text-stone-500 dark:text-stone-400">Kode Vendor:</span>
              <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{registrationResult.vendorCode}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-stone-200/50 dark:border-stone-800/60">
              <span className="text-stone-500 dark:text-stone-400">Nama Manager:</span>
              <span className="font-bold text-stone-900 dark:text-white">{registrationResult.managerName}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-stone-500 dark:text-stone-400">Hak Akses Role:</span>
              <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                MANAGER
              </span>
            </div>
          </div>

          {/* Direct confirmation helper for preview & testing environments */}
          {registrationResult.confirmationUrl && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 mb-2 font-bold text-xs">
                <Sparkles size={14} className="text-amber-600 dark:text-amber-400" />
                <span>Aktivasi Langsung (Mode Preview & Verifikasi)</span>
              </div>
              <p className="text-[11px] leading-relaxed mb-3 text-amber-800/90 dark:text-amber-300/80">
                Klik tombol di bawah ini untuk membuka tautan aktivasi atau menyalin link konfirmasi yang dikirim ke email:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  id="btn-open-confirmation-link"
                  href={registrationResult.confirmationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <ExternalLink size={13} />
                  <span>Buka Link Konfirmasi</span>
                </a>
                <button
                  id="btn-copy-confirmation-link"
                  type="button"
                  onClick={copyConfirmationLink}
                  className="py-2.5 px-3 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-stone-200 dark:border-stone-700 transition-all"
                >
                  <Copy size={13} />
                  <span>Salin Link</span>
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              id="btn-resend-confirmation"
              type="button"
              disabled={isResending}
              onClick={handleResendConfirmation}
              className="w-full py-3 px-4 rounded-2xl border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} className={isResending ? 'animate-spin' : ''} />
              <span>{isResending ? 'Mengirim ulang...' : 'Kirim Ulang Email Konfirmasi'}</span>
            </button>

            <button
              id="btn-back-to-login-from-success"
              type="button"
              onClick={onBackToLogin}
              className="w-full py-3.5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Halaman Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: Main Vendor Registration Form
  // -------------------------------------------------------------
  return (
    <div
      id="vendor-registration-screen"
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#fff8f6] dark:bg-[#1a1412] text-stone-800 dark:text-stone-100 transition-colors"
    >
      <div className="w-full max-w-xl bg-white dark:bg-[#251e1c] rounded-3xl p-6 sm:p-8 border border-stone-200/80 dark:border-stone-800 shadow-2xl">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100 dark:border-stone-800">
          <button
            id="btn-back-to-login-top"
            type="button"
            onClick={onBackToLogin}
            className="flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Login</span>
          </button>
          <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-2.5 py-1 rounded-full">
            Mitra Baru
          </span>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-600/20">
              <Store size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-white tracking-tight">
                Pendaftaran Vendor Baru
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Daftarkan toko & akun Manager untuk mengoperasikan POS SipSpot
              </p>
            </div>
          </div>
        </div>

        {/* Global error banner if any */}
        {formError && (
          <div
            id="registration-form-error-banner"
            className="mb-6 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span className="leading-relaxed">{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Section 1: Data Vendor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="input-vendor-name"
                className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5"
              >
                <Store size={14} className="text-orange-600" />
                <span>Nama Vendor</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-stone-400">
                {vendorName.length}/30 (min 3)
              </span>
            </div>
            <div className="relative">
              <input
                id="input-vendor-name"
                type="text"
                required
                minLength={3}
                maxLength={30}
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Contoh: Kopi Janji Senja Kemang"
                className="w-full py-3 px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900 text-stone-900 dark:text-white text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
            {/* Availability feedback for vendorName */}
            {availability.vendorName && vendorName.length >= 3 && (
              <p
                id="feedback-vendor-name"
                className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium ${
                  availability.vendorName.valid
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {availability.vendorName.valid ? (
                  <CheckCircle2 size={12} className="shrink-0" />
                ) : (
                  <AlertCircle size={12} className="shrink-0" />
                )}
                <span>{availability.vendorName.message}</span>
              </p>
            )}
          </div>

          {/* Section 2: Data Manager */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Manager Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="input-manager-name"
                  className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5"
                >
                  <UserCheck size={14} className="text-orange-600" />
                  <span>Nama Manager</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-stone-400">
                  {managerName.length}/30
                </span>
              </div>
              <input
                id="input-manager-name"
                type="text"
                required
                minLength={3}
                maxLength={30}
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Nama lengkap pengelola"
                className="w-full py-3 px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900 text-stone-900 dark:text-white text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
              {/* Availability feedback for managerName */}
              {availability.managerName && managerName.length >= 3 && (
                <p
                  id="feedback-manager-name"
                  className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium ${
                    availability.managerName.valid
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {availability.managerName.valid ? (
                    <CheckCircle2 size={12} className="shrink-0" />
                  ) : (
                    <AlertCircle size={12} className="shrink-0" />
                  )}
                  <span>{availability.managerName.message}</span>
                </p>
              )}
            </div>

            {/* Role indicator (fixed to MANAGER as requested) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Peran / Role</span>
                </label>
                <span className="text-[10px] text-emerald-600 font-bold">Otomatis</span>
              </div>
              <div className="py-3 px-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-sm font-bold flex items-center justify-between">
                <span>MANAGER</span>
                <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">Akses Penuh Toko</span>
              </div>
            </div>
          </div>

          {/* Section 3: Email & PIN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email (must be unique) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="input-vendor-email"
                  className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5"
                >
                  <Mail size={14} className="text-orange-600" />
                  <span>Alamat Email</span>
                  <span className="text-rose-500">*</span>
                </label>
              </div>
              <input
                id="input-vendor-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@namausaha.com"
                className="w-full py-3 px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900 text-stone-900 dark:text-white text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
              {/* Availability feedback for email */}
              {availability.email && email.includes('@') && (
                <p
                  id="feedback-email"
                  className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium ${
                    availability.email.valid
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {availability.email.valid ? (
                    <CheckCircle2 size={12} className="shrink-0" />
                  ) : (
                    <AlertCircle size={12} className="shrink-0" />
                  )}
                  <span>{availability.email.message}</span>
                </p>
              )}
            </div>

            {/* PIN (exactly 6 chars) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="input-vendor-pin"
                  className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5"
                >
                  <KeyRound size={14} className="text-orange-600" />
                  <span>PIN Akses Kasir (6 Digit)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-stone-400 font-mono">
                  {pin.length}/6
                </span>
              </div>
              <div className="relative">
                <input
                  id="input-vendor-pin"
                  type={showPin ? 'text' : 'password'}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setPin(onlyNums);
                  }}
                  placeholder="6 digit angka (misal: 123456)"
                  className="w-full py-3 pl-3.5 pr-10 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900 text-stone-900 dark:text-white text-sm font-mono tracking-widest placeholder:tracking-normal placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1"
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1">
                Digunakan untuk login cepat PIN kasir dan otorisasi transaksi.
              </p>
            </div>
          </div>

          {/* Section 4: Optional contact details */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="input-vendor-phone"
                  className="text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1.5 flex items-center gap-1.5"
                >
                  <Phone size={13} />
                  <span>Nomor Telepon / WhatsApp (Opsional)</span>
                </label>
                <input
                  id="input-vendor-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full py-2.5 px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900 text-stone-900 dark:text-white text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="input-vendor-address"
                  className="text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1.5 flex items-center gap-1.5"
                >
                  <MapPin size={13} />
                  <span>Alamat Outlet / Toko (Opsional)</span>
                </label>
                <input
                  id="input-vendor-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Sudirman No. 10, Jakarta"
                  className="w-full py-2.5 px-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900 text-stone-900 dark:text-white text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Workflow Notice */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-400 flex items-start gap-2.5">
            <Mail size={16} className="text-orange-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-stone-800 dark:text-stone-200">
                Alur Verifikasi Email:
              </span>{' '}
              Setelah pendaftaran berhasil, tautan konfirmasi akan otomatis dikirimkan ke alamat email Manager. Klik tautan tersebut untuk mengaktifkan akun vendor.
            </div>
          </div>

          {/* Submit button */}
          <button
            id="btn-submit-vendor-register"
            type="submit"
            disabled={isSubmitting || isCheckingUniqueness}
            className="w-full py-3.5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Mendaftarkan Vendor...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Daftarkan Vendor &amp; Kirim Konfirmasi</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800 text-center">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Sudah memiliki akun vendor?{' '}
            <button
              id="btn-goto-login-bottom"
              type="button"
              onClick={onBackToLogin}
              className="text-orange-600 dark:text-orange-400 font-bold hover:underline ml-1"
            >
              Masuk di sini
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
