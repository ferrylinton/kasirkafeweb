import React, { useState } from 'react';
import { KeyRound, Lock, Mail, Sparkles, X, RefreshCw, Send, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { useToast } from '../common/Toast';

interface AdminSendPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    email: string;
    name: string;
    role?: string;
    vendorName?: string;
    requestId?: string;
    note?: string;
  };
  onSuccess?: () => void;
  token?: string | null;
}

export const AdminSendPinModal: React.FC<AdminSendPinModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSuccess,
  token
}) => {
  const { showToast } = useToast();

  const generateRandomPin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const [credentialType, setCredentialType] = useState<'pin' | 'password'>('pin');
  const [credentialValue, setCredentialValue] = useState<string>(generateRandomPin());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRandomizePin = () => {
    setCredentialType('pin');
    setCredentialValue(generateRandomPin());
  };

  const handleRandomizePassword = () => {
    setCredentialType('password');
    setCredentialValue(generateRandomPassword());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = credentialValue.trim();
    if (!val || val.length < 6) {
      setError('Kredensial baru minimal harus 6 karakter atau 6 digit angka.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/admin/send-new-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          email: targetUser.email,
          customPassword: val,
          customPin: val,
          requestId: targetUser.requestId
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Kredensial baru (${val}) berhasil dikirim ke email ${targetUser.email}!`, 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(data.message || 'Gagal mengirimkan kredensial baru ke email pengguna.');
      }
    } catch (e: any) {
      setError('Koneksi server gagal. Periksa jaringan Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="admin-send-pin-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="admin-send-pin-modal-card"
        className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-800 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-purple-50/50 dark:bg-purple-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-heading">
                  Kirim Kredensial Baru ke Email
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  ADMIN
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Terbitkan PIN / password baru dan kirim notifikasi ke email pengguna
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* User Details Target Box */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-500 dark:text-stone-400">Penerima:</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">{targetUser.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500 dark:text-stone-400">Alamat Email:</span>
              <span className="font-semibold text-purple-700 dark:text-purple-300">{targetUser.email}</span>
            </div>
            {targetUser.role && (
              <div className="flex items-center justify-between">
                <span className="text-stone-500 dark:text-stone-400">Role Pengguna:</span>
                <span className="px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-800 font-bold text-[10px]">
                  {targetUser.role}
                </span>
              </div>
            )}
            {targetUser.vendorName && (
              <div className="flex items-center justify-between">
                <span className="text-stone-500 dark:text-stone-400">Mitra / Outlet:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">{targetUser.vendorName}</span>
              </div>
            )}
            {targetUser.note && (
              <div className="pt-2 border-t border-stone-200/60 dark:border-stone-800">
                <span className="text-stone-400 text-[10px] block">Catatan Permintaan Pengguna:</span>
                <p className="text-stone-700 dark:text-stone-300 italic text-[11px] mt-0.5">
                  "{targetUser.note}"
                </p>
              </div>
            )}
          </div>

          {/* Credential Format Toggle & Generator */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-purple-600" />
                <span>Kredensial Baru yang Dikirim:</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRandomizePin}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>PIN 6-Digit</span>
                </button>
                <span className="text-stone-300 dark:text-stone-700">•</span>
                <button
                  type="button"
                  onClick={handleRandomizePassword}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Password Acak</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={credentialValue}
                onChange={e => setCredentialValue(e.target.value)}
                required
                minLength={6}
                className="w-full py-3.5 px-4 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border-2 border-purple-200 dark:border-purple-800/80 text-xl font-mono text-center font-black tracking-widest text-purple-950 dark:text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              Sistem akan otomatis membuka kunci akun pengguna (jika sedang terkunci) dan memperbarui kata sandi akun di database.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || credentialValue.trim().length < 6}
              className="flex-1 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengirimkan ke Email...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim ke Email Pengguna</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
