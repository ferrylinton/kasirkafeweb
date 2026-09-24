import React, { useState, useEffect, useCallback } from 'react';
import { Database, AlertTriangle, RefreshCw, X, ShieldAlert, ServerOff } from 'lucide-react';

export interface DatabaseAlertModalProps {
  /** Optional custom trigger state if controlled externally */
  isOpen?: boolean;
  onClose?: () => void;
}

export const DB_ERROR_EVENT = 'kasirkafe:db-error';

/**
 * Dispatch global event to show Database Alert Modal
 */
export function triggerDatabaseAlert(message: string = 'can not connect to db') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(DB_ERROR_EVENT, {
        detail: { message }
      })
    );
  }
}

export const DatabaseAlertModal: React.FC<DatabaseAlertModalProps> = ({
  isOpen: externalIsOpen,
  onClose: externalOnClose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('can not connect to db');
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryStatus, setRetryStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  // Sync with external controlled state if passed
  useEffect(() => {
    if (externalIsOpen !== undefined) {
      setIsOpen(externalIsOpen);
    }
  }, [externalIsOpen]);

  const handleOpen = useCallback((msg: string = 'can not connect to db') => {
    setErrorMessage(msg || 'can not connect to db');
    setIsOpen(true);
    setRetryStatus('idle');
    setRetryMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (externalOnClose) {
      externalOnClose();
    }
  }, [externalOnClose]);

  // Listen for custom db error event
  useEffect(() => {
    const handleDbError = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      const msg = customEvent.detail?.message || 'can not connect to db';
      handleOpen(msg);
    };

    window.addEventListener(DB_ERROR_EVENT, handleDbError);
    return () => {
      window.removeEventListener(DB_ERROR_EVENT, handleDbError);
    };
  }, [handleOpen]);

  // Initial check on mount to ensure DB connectivity
  useEffect(() => {
    let isMounted = true;
    const checkInitialConnection = async () => {
      try {
        const res = await fetch('/api/health/db', {
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (res.status === 503) {
          const data = await res.json().catch(() => ({}));
          if (isMounted) {
            handleOpen(data.message || 'can not connect to db');
          }
        }
      } catch {
        // Ignored or offline
      }
    };

    checkInitialConnection();
    return () => {
      isMounted = false;
    };
  }, [handleOpen]);

  // Retry connection handler
  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryStatus('idle');
    setRetryMessage(null);

    try {
      const res = await fetch('/api/health/db', {
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (res.ok) {
        setRetryStatus('success');
        setRetryMessage('Koneksi ke database berhasil dipulihkan!');
        setTimeout(() => {
          setIsRetrying(false);
          handleClose();
        }, 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        setRetryStatus('failed');
        setErrorMessage(data.message || 'can not connect to db');
        setRetryMessage('Gagal terhubung ke database. Silakan periksa kembali server MongoDB.');
        setIsRetrying(false);
      }
    } catch (err: any) {
      setRetryStatus('failed');
      setErrorMessage('can not connect to db');
      setRetryMessage('Tidak dapat menghubungi server: can not connect to db');
      setIsRetrying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="db-error-modal-title"
      aria-describedby="db-error-modal-desc"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border-2 border-red-500/30 dark:border-red-500/40 p-6 overflow-hidden transform transition-all animate-scale-up">
        {/* Top Accent Strip */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-600" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          type="button"
          aria-label="Tutup modal peringatan database"
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center mt-2">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 flex items-center justify-center text-red-600 dark:text-red-400 shadow-inner">
              <Database className="w-8 h-8" />
            </div>
            <span className="absolute -bottom-1 -right-1 p-1 bg-red-600 text-white rounded-full ring-2 ring-white dark:ring-zinc-900 shadow">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50 mb-2">
            <ServerOff className="w-3.5 h-3.5" />
            Database Connection Alert
          </span>

          <h3
            id="db-error-modal-title"
            className="text-xl font-extrabold text-zinc-900 dark:text-white"
          >
            Koneksi Database Terputus
          </h3>

          {/* Core Alert Message Prompt explicitly demanded by user */}
          <div className="mt-3 w-full p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-left flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p
                id="db-error-modal-desc"
                className="text-sm font-semibold text-red-800 dark:text-red-200 tracking-wide font-mono"
              >
                {errorMessage}
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-300/70 mt-1">
                Sistem tidak dapat terhubung ke database MongoDB. Mohon periksa status koneksi jaringan atau konfigurasi basis data Anda.
              </p>
            </div>
          </div>

          {/* Retry Status Message */}
          {retryMessage && (
            <div
              className={`mt-3 w-full p-2.5 rounded-lg text-xs font-medium text-left ${
                retryStatus === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              {retryMessage}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-60 transition shadow-md shadow-red-600/20 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Memeriksa Koneksi...' : 'Coba Hubungkan Lagi'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
