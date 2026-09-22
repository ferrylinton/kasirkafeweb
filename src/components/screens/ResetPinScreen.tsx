import React, { useState, useEffect } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react';
import { useToast } from '../common/Toast';

interface ResetPinScreenProps {
  token: string | null;
  onBackToLogin: () => void;
  onSuccessLogin?: (email: string, newPin: string) => void;
}

export const ResetPinScreen: React.FC<ResetPinScreenProps> = ({
  token,
  onBackToLogin,
  onSuccessLogin
}) => {
  const { showToast } = useToast();

  const [currentToken, setCurrentToken] = useState<string>(token || '');
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [tokenInfo, setTokenInfo] = useState<{
    email: string;
    userName: string;
    role: string;
    vendorName?: string;
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Form states
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Verify token on mount or when token changes
  useEffect(() => {
    if (!currentToken) {
      setIsVerifying(false);
      setVerifyError('Token atur ulang PIN tidak disertakan dalam tautan.');
      return;
    }

    const verify = async () => {
      setIsVerifying(true);
      setVerifyError(null);
      try {
        const res = await fetch(`/api/auth/reset-pin/verify?token=${encodeURIComponent(currentToken)}`);
        const data = await res.json();
        if (data.success) {
          setTokenInfo({
            email: data.email,
            userName: data.userName,
            role: data.role,
            vendorName: data.vendorName
          });
        } else {
          setVerifyError(data.message || 'Token reset PIN tidak valid atau sudah kedaluwarsa.');
        }
      } catch (e) {
        setVerifyError('Gagal memverifikasi token reset PIN. Periksa jaringan Anda.');
      } finally {
        setIsVerifying(false);
      }
    };

    verify();
  }, [currentToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!newPin || !/^\d{6}$/.test(newPin)) {
      setSubmitError('PIN baru harus terdiri dari tepat 6 digit angka.');
      return;
    }

    if (newPin !== confirmPin) {
      setSubmitError('Konfirmasi PIN tidak cocok dengan PIN baru.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-pin/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: currentToken,
          newPin
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
        showToast('PIN baru 6 digit berhasil disimpan!', 'success');
      } else {
        setSubmitError(data.message || 'Gagal mengatur ulang PIN.');
      }
    } catch (e) {
      setSubmitError('Koneksi server gagal. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff8f6] dark:bg-[#1f1917] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200/80 dark:border-stone-800 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shadow-xs">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 font-heading">
            Atur Ulang PIN Kasir
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Sistem Keamanan Akun SipSpot Beverage & Snack POS
          </p>
        </div>

        {/* Loading Verification State */}
        {isVerifying ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-accent animate-spin" />
            <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">
              Memverifikasi token reset PIN...
            </span>
          </div>
        ) : verifyError ? (
          /* Error State */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Tautan Tidak Valid:</span>
                <p className="leading-relaxed">{verifyError}</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full py-3 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Layar Login</span>
              </button>
            </div>
          </div>
        ) : isSuccess ? (
          /* Success State */
          <div className="space-y-4 animate-in fade-in duration-200 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                PIN Berhasil Diperbarui!
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                PIN 6 digit kasir akun Anda telah berhasil disimpan dan status kunci akun Anda telah dinonaktifkan.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs text-stone-700 dark:text-stone-300">
              Pengguna: <strong>{tokenInfo?.userName}</strong> ({tokenInfo?.email})
            </div>

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full py-3.5 rounded-2xl bg-accent text-white text-xs sm:text-sm font-bold shadow-md hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <span>Login Kasir dengan PIN Baru</span>
            </button>
          </div>
        ) : (
          /* Form to input new 6-digit PIN */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Target Card */}
            {tokenInfo && (
              <div className="p-3.5 rounded-2xl bg-orange-50/60 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/50 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-stone-800 dark:text-stone-200 block">
                    {tokenInfo.userName}
                  </span>
                  <span className="text-stone-500 dark:text-stone-400 text-[11px]">
                    {tokenInfo.email} • {tokenInfo.role}
                  </span>
                </div>
                {tokenInfo.vendorName && (
                  <span className="px-2 py-0.5 rounded-lg bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-300 font-bold text-[10px]">
                    {tokenInfo.vendorName}
                  </span>
                )}
              </div>
            )}

            {/* Input PIN Baru */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                PIN Baru (6 Digit Angka) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-new-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Contoh: 123456"
                  className="w-full pl-4 pr-10 py-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-sm font-mono tracking-widest text-center font-bold focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-stone-900 dark:text-stone-100 placeholder:tracking-normal placeholder:font-sans placeholder:text-stone-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3.5 top-3.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Input Konfirmasi PIN */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                Ulangi Konfirmasi PIN (6 Digit) <span className="text-red-500">*</span>
              </label>
              <input
                id="input-confirm-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Masukkan ulang 6 digit"
                className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-sm font-mono tracking-widest text-center font-bold focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-stone-900 dark:text-stone-100 placeholder:tracking-normal placeholder:font-sans placeholder:text-stone-400"
              />
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="pt-2 space-y-2">
              <button
                id="btn-confirm-new-pin"
                type="submit"
                disabled={isSubmitting || newPin.length !== 6 || confirmPin.length !== 6}
                className="w-full py-3.5 rounded-2xl bg-accent text-white font-bold text-xs sm:text-sm shadow-md hover:opacity-95 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan PIN Baru...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Simpan & Aktifkan PIN Baru</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full py-2.5 rounded-xl text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 text-xs font-semibold transition-colors"
              >
                Batal & Kembali ke Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
