import React, { useState } from 'react';
import {
  Store,
  ShieldCheck,
  ArrowLeft,
  Send,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';

export interface VendorReactivationScreenProps {
  initialEmail?: string;
  onBackToLogin: () => void;
}

export const VendorReactivationScreen: React.FC<VendorReactivationScreenProps> = ({
  initialEmail = '',
  onBackToLogin
}) => {
  const { showToast } = useToast();

  const [email, setEmail] = useState<string>(initialEmail);
  const [password, setPassword] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    vendorName: string;
    requestId: string;
    reason: string;
    createdAt: string;
  } | null>(null);

  const charCount = reason.trim().length;
  const isLengthValid = charCount >= 5 && charCount <= 200;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim()) {
      setErrorMsg('Email akun Manager harus diisi.');
      return;
    }
    if (!password) {
      setErrorMsg('Password akun Manager harus diisi untuk memverifikasi kepemilikan akun.');
      return;
    }
    if (charCount < 5) {
      setErrorMsg('Alasan permohonan aktivasi minimal 5 karakter.');
      return;
    }
    if (charCount > 200) {
      setErrorMsg('Alasan permohonan aktivasi maksimal 200 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/vendors/request-reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          reason: reason.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Permohonan aktivasi berhasil dikirim.', 'success');
        setSuccessInfo({
          vendorName: data.request?.vendorName || 'Vendor Anda',
          requestId: data.request?.id || '',
          reason: data.request?.reason || reason.trim(),
          createdAt: data.request?.createdAt || new Date().toISOString()
        });
      } else {
        setErrorMsg(data.message || 'Gagal mengajukan permohonan aktivasi.');
        showToast(data.message || 'Gagal mengajukan aktivasi.', 'error');
      }
    } catch (err: any) {
      setErrorMsg('Terjadi kesalahan jaringan. Pastikan koneksi server aktif.');
      showToast('Koneksi ke server gagal.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-stone-100 dark:from-stone-950 dark:via-stone-900 dark:to-neutral-950 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-600 dark:bg-amber-500 text-white shadow-lg shadow-amber-600/30 mb-3">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
            Aktivasi Kembali Akun Vendor
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            KasirKafe POS Multi-Vendor Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-xl border border-stone-200/80 dark:border-stone-800 p-6 sm:p-8 backdrop-blur-sm">
          {successInfo ? (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-stone-900 dark:text-white">
                  Permohonan Berhasil Dikirim!
                </h3>
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">
                  Permintaan aktivasi kembali untuk gerai{' '}
                  <strong className="text-amber-600 dark:text-amber-400">
                    {successInfo.vendorName}
                  </strong>{' '}
                  telah diteruskan ke Admin Sistem untuk peninjauan.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 text-left space-y-2">
                <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Rincian Permohonan:
                </div>
                <div className="text-xs text-stone-600 dark:text-stone-300">
                  <span className="font-medium text-stone-900 dark:text-white">ID Tiket:</span>{' '}
                  <code className="bg-stone-200 dark:bg-stone-700 px-1.5 py-0.5 rounded text-[11px]">
                    {successInfo.requestId}
                  </code>
                </div>
                <div className="text-xs text-stone-600 dark:text-stone-300">
                  <span className="font-medium text-stone-900 dark:text-white">Alasan:</span>{' '}
                  &ldquo;{successInfo.reason}&rdquo;
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 mt-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(successInfo.createdAt).toLocaleString('id-ID')}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300 text-left">
                Setelah disetujui oleh Admin, status akun vendor Anda akan kembali menjadi{' '}
                <strong>ACTIVE</strong> dan seluruh staf (Manager & Kasir) dapat login kembali seperti semula.
              </div>

              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Halaman Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Guidance Notice */}
              <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  Otoritas Khusus Role MANAGER
                </div>
                <p className="leading-relaxed">
                  Gunakan formulir ini untuk mengajukan permohonan pengaktifan kembali akun vendor Anda yang sedang dinonaktifkan (<strong>DEACTIVATE</strong>). Permintaan Anda akan ditinjau langsung oleh Admin.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Email Akun Manager
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@nama-vendor.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Password Akun Manager
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password akun Anda"
                    className="w-full pl-10 pr-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  Dibutuhkan untuk memverifikasi hak akses Manager atas vendor tersebut.
                </p>
              </div>

              {/* Reason */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                    Alasan Permohonan Aktivasi
                  </label>
                  <span
                    className={`text-[11px] font-mono font-medium ${
                      charCount === 0
                        ? 'text-stone-400'
                        : isLengthValid
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-rose-500 dark:text-rose-400 font-semibold'
                    }`}
                  >
                    {charCount}/200 karakter (min. 5)
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={reason}
                  maxLength={200}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Toko telah menyelesaikan proses renovasi dan siap kembali melayani pesanan pelanggan."
                  className={`w-full p-3 bg-stone-50 dark:bg-stone-800 border rounded-xl text-stone-900 dark:text-stone-100 text-sm focus:outline-none transition-all ${
                    charCount > 0 && !isLengthValid
                      ? 'border-rose-300 dark:border-rose-700 focus:ring-2 focus:ring-rose-500'
                      : 'border-stone-200 dark:border-stone-700 focus:ring-2 focus:ring-amber-500'
                  }`}
                />
                <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  <span>Berikan alasan yang jelas kepada Administrator</span>
                  {charCount > 0 && charCount < 5 && (
                    <span className="text-rose-500 font-medium">Kurang {5 - charCount} karakter lagi</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !isLengthValid || !email.trim() || !password}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Mengirim Permohonan...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Kirim Permohonan Aktivasi</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full py-2.5 px-4 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Halaman Login</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
