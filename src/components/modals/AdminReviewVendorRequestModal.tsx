import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Store,
  Clock,
  UserCheck,
  FileText,
  ShieldAlert
} from 'lucide-react';
import { VendorStatusRequest } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';

export interface AdminReviewVendorRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: VendorStatusRequest | null;
  action: 'APPROVE' | 'REJECT';
  onReviewed: () => void;
}

export const AdminReviewVendorRequestModal: React.FC<AdminReviewVendorRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  action,
  onReviewed
}) => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [adminNotes, setAdminNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !request) return null;

  const isApprove = action === 'APPROVE';
  const isDeactivate = request.type === 'DEACTIVATE';

  const handleReview = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/vendors/status-requests/${request.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action,
          adminNotes: adminNotes.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || `Permintaan berhasil ${isApprove ? 'disetujui' : 'ditolak'}.`, 'success');
        onReviewed();
        onClose();
      } else {
        setErrorMsg(data.message || 'Gagal meninjau permohonan.');
        showToast(data.message || 'Gagal memproses review.', 'error');
      }
    } catch (err: any) {
      setErrorMsg('Koneksi server gagal.');
      showToast('Gagal memproses permohonan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-2xl ${
                isApprove
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isApprove ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                {isApprove
                  ? isDeactivate
                    ? 'Setujui Penonaktifan Vendor'
                    : 'Setujui Aktivasi Vendor'
                  : 'Tolak Permohonan Status Vendor'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                <Store className="w-3.5 h-3.5" />
                <span className="font-semibold text-stone-700 dark:text-stone-300">{request.vendorName}</span>
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

        {/* Request Summary Card */}
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-stone-500 dark:text-stone-400">Jenis Permintaan:</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                isDeactivate
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {isDeactivate ? 'Penonaktifan (DEACTIVATE)' : 'Aktivasi Kembali (ACTIVE)'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-stone-500 dark:text-stone-400">Diajukan Oleh:</span>
            <span className="font-medium text-stone-900 dark:text-stone-100">
              {request.requestedByName} ({request.requestedByEmail})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-stone-500 dark:text-stone-400">Waktu Pengajuan:</span>
            <span className="text-stone-700 dark:text-stone-300 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(request.createdAt).toLocaleString('id-ID')}
            </span>
          </div>

          <div className="pt-2 border-t border-stone-200 dark:border-stone-700">
            <div className="text-stone-500 dark:text-stone-400 mb-1 font-semibold">Alasan Pengajuan:</div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 italic leading-relaxed">
              &ldquo;{request.reason}&rdquo;
            </div>
          </div>
        </div>

        {/* Warning Callout */}
        {isApprove && isDeactivate && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Dampak Persetujuan Penonaktifan:</span>
            </div>
            <p className="leading-relaxed">
              Status vendor akan berubah menjadi <strong>DEACTIVATE</strong>. Semua user di dalam vendor ini (Manager & Kasir) tidak akan bisa login lagi dan akan melihat pesan bahwa akun vendor sudah tidak aktif. Data transaksi dan produk tidak dihapus.
            </p>
          </div>
        )}

        {isApprove && !isDeactivate && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Dampak Persetujuan Aktivasi:</span>
            </div>
            <p className="leading-relaxed">
              Status vendor akan kembali menjadi <strong>ACTIVE</strong>. Seluruh user di vendor ini dapat kembali login dan menjalankan transaksi kasir seperti biasa.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Optional Notes for Admin */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
            Catatan Admin {!isApprove && <span className="text-rose-500">*</span>}
          </label>
          <textarea
            rows={3}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder={
              isApprove
                ? 'Catatan tambahan persetujuan (opsional)'
                : 'Berikan alasan penolakan kepada Manager vendor...'
            }
            className="w-full p-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleReview}
            disabled={isSubmitting || (!isApprove && !adminNotes.trim())}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isApprove
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memproses...</span>
              </>
            ) : isApprove ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Setujui Permintaan</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                <span>Tolak Permintaan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
