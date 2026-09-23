import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Send,
  Power,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Store
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';

export interface VendorStatusRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId?: string;
  vendorName?: string;
  currentStatus?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATE';
  type: 'DEACTIVATE' | 'REACTIVATE';
  onSuccess?: () => void;
}

export const VendorStatusRequestModal: React.FC<VendorStatusRequestModalProps> = ({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  currentStatus,
  type,
  onSuccess
}) => {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveVendorId = vendorId || user?.vendorId || '';
  const effectiveVendorName = vendorName || 'Vendor Anda';

  const charCount = reason.trim().length;
  const isLengthValid = charCount >= 5 && charCount <= 200;
  const isDeactivate = type === 'DEACTIVATE';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (charCount < 5) {
      setErrorMsg('Alasan minimal 5 karakter.');
      return;
    }
    if (charCount > 200) {
      setErrorMsg('Alasan maksimal 200 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = isDeactivate
        ? '/api/vendors/request-deactivate'
        : '/api/vendors/request-reactivate';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          reason: reason.trim(),
          vendorId: effectiveVendorId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Permohonan berhasil diajukan ke Admin.', 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(data.message || 'Gagal mengajukan permohonan.');
        showToast(data.message || 'Gagal mengajukan permohonan.', 'error');
      }
    } catch (err: any) {
      setErrorMsg('Koneksi server terputus.');
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-2xl ${
                isDeactivate
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isDeactivate ? <Power className="w-6 h-6" /> : <RefreshCw className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                {isDeactivate ? 'Ajukan Penonaktifan Vendor' : 'Ajukan Aktivasi Kembali Vendor'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                <Store className="w-3.5 h-3.5" />
                <span>{effectiveVendorName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning / Explanation Banner */}
        <div
          className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1.5 ${
            isDeactivate
              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
              : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <div className="font-bold flex items-center gap-1.5">
            {isDeactivate ? (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Konsekuensi Penonaktifan Akun Vendor</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Aktivasi Operasional Vendor</span>
              </>
            )}
          </div>
          {isDeactivate ? (
            <p>
              Jika permohonan disetujui Admin, status vendor akan berubah menjadi{' '}
              <strong>DEACTIVATE</strong>. Seluruh pengguna di dalam gerai ini (Manager & Kasir) tidak akan dapat login lagi dan akan melihat pesan bahwa akun vendor sudah tidak aktif. Seluruh data transaksi & produk <strong>tidak dihapus</strong>.
            </p>
          ) : (
            <p>
              Jika permohonan disetujui Admin, status vendor akan kembali menjadi{' '}
              <strong>ACTIVE</strong> dan seluruh staf dapat login kembali untuk operasional kasir.
            </p>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                Alasan Pengajuan <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-[11px] font-mono font-medium ${
                  charCount === 0
                    ? 'text-stone-400'
                    : isLengthValid
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-rose-500 font-semibold'
                }`}
              >
                {charCount}/200 karakter (min. 5)
              </span>
            </div>
            <textarea
              required
              rows={4}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isDeactivate
                  ? 'Contoh: Gerai sedang direnovasi sementara waktu selama 1 bulan dan operasional diliburkan.'
                  : 'Contoh: Renovasi telah selesai dan outlet siap beroperasi kembali melayani pelanggan.'
              }
              className={`w-full p-3 bg-stone-50 dark:bg-stone-800 border rounded-2xl text-stone-900 dark:text-stone-100 text-sm focus:outline-none transition-all ${
                charCount > 0 && !isLengthValid
                  ? 'border-rose-300 dark:border-rose-700 focus:ring-2 focus:ring-rose-500'
                  : isDeactivate
                  ? 'border-stone-200 dark:border-stone-700 focus:ring-2 focus:ring-rose-500'
                  : 'border-stone-200 dark:border-stone-700 focus:ring-2 focus:ring-emerald-500'
              }`}
            />
            <div className="flex justify-between items-center text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              <span>Alasan akan ditinjau langsung oleh Admin sistem</span>
              {charCount > 0 && charCount < 5 && (
                <span className="text-rose-500 font-medium">Kurang {5 - charCount} karakter lagi</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm font-medium transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isLengthValid}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDeactivate
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Mengirim...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim Permohonan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
