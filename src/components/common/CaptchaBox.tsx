import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

export interface CaptchaBoxRef {
  reload: () => Promise<void>;
  clear: () => void;
  focus: () => void;
}

export interface CaptchaBoxProps {
  onCaptchaChange: (data: { token: string; answer: string; isValidLength: boolean }) => void;
  disabled?: boolean;
  className?: string;
}

export const CaptchaBox = forwardRef<CaptchaBoxRef, CaptchaBoxProps>(({
  onCaptchaChange,
  disabled = false,
  className = ''
}, ref) => {
  const [token, setToken] = useState<string>('');
  const [image, setImage] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(300); // 5 minutes = 300s
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep a stable ref to onCaptchaChange to prevent infinite re-render loops
  const onCaptchaChangeRef = useRef(onCaptchaChange);
  useEffect(() => {
    onCaptchaChangeRef.current = onCaptchaChange;
  }, [onCaptchaChange]);

  // Safe parent state notifier deferred out of render cycle
  const notifyParent = useCallback((data: { token: string; answer: string; isValidLength: boolean }) => {
    queueMicrotask(() => {
      onCaptchaChangeRef.current?.(data);
    });
  }, []);

  // Fetch captcha from backend server
  const fetchCaptcha = useCallback(async (isExpiredTrigger = false) => {
    setLoading(true);
    setError(null);
    setAnswer('');
    notifyParent({ token: '', answer: '', isValidLength: false });

    try {
      const res = await fetch('/api/auth/captcha');
      const data = await res.json();

      if (res.ok && data.success && data.token && data.image) {
        setToken(data.token);
        setImage(data.image);
        setSecondsLeft(data.expiresInSeconds || 300);
        notifyParent({ token: data.token, answer: '', isValidLength: false });
      } else {
        setError(data.message || 'Gagal memuat captcha.');
      }
    } catch (e: any) {
      setError('Koneksi captcha terputus.');
    } finally {
      setLoading(false);
    }
  }, [notifyParent]);

  // Stable ref for auto-reload callback
  const fetchCaptchaRef = useRef(fetchCaptcha);
  useEffect(() => {
    fetchCaptchaRef.current = fetchCaptcha;
  }, [fetchCaptcha]);

  // Fetch captcha exactly ONCE on initial mount
  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  // Expiration countdown timer (5 minutes = 300s) + AUTOMATIC RELOAD on expiration
  useEffect(() => {
    if (!token || loading) return;

    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          // Captcha has expired: automatically reload a fresh captcha from server!
          fetchCaptchaRef.current(true);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [token, loading]);

  // Expose reload and clear methods via ref
  useImperativeHandle(ref, () => ({
    reload: () => fetchCaptcha(false),
    clear: () => {
      setAnswer('');
      notifyParent({ token, answer: '', isValidLength: false });
    },
    focus: () => {
      inputRef.current?.focus();
    }
  }));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Force uppercase and allow only alphanumeric characters
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setAnswer(clean);
    notifyParent({
      token,
      answer: clean,
      isValidLength: clean.length >= 4
    });
  };

  return (
    <div className={`select-none ${className}`}>
      {/* Single Responsive Row Layout: [Image + Reload] [Input] */}
      <div className="flex items-center gap-2 w-full">
        {/* Left: SVG Image Box + Reload Button */}
        <div className="relative flex items-center justify-between h-11 sm:h-12 px-1.5 sm:px-2 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-2xs shrink-0 w-[145px] sm:w-[175px] overflow-hidden transition-all">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center gap-1.5 text-stone-400 text-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
              <span className="text-[11px] truncate">Memuat...</span>
            </div>
          ) : error ? (
            <div className="w-full h-full flex items-center justify-center gap-1 text-red-500 text-[10px] px-1 text-center">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center overflow-hidden min-w-0 pr-1">
              <img
                src={image}
                alt="Kode Captcha"
                className="h-8 sm:h-9 w-full max-w-[130px] object-contain rounded-lg select-none pointer-events-none"
              />
            </div>
          )}

          {/* Reload Button */}
          <button
            type="button"
            onClick={() => fetchCaptcha(false)}
            disabled={disabled || loading}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-accent hover:border-accent/40 border border-stone-200/80 dark:border-stone-700/80 flex items-center justify-center shrink-0 shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Muat ulang kode captcha (Otomatis reload setiap 5 menit)"
            aria-label="Muat ulang kode captcha"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>

        {/* Right: User Answer Input Field */}
        <div className="relative flex-1 min-w-[120px] h-11 sm:h-12 flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={handleInputChange}
            disabled={disabled || loading}
            placeholder="Kode captcha..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            maxLength={6}
            className="w-full h-full px-3.5 rounded-2xl border text-sm font-bold font-mono tracking-widest text-stone-900 dark:text-stone-100 placeholder:text-stone-400 placeholder:font-sans placeholder:tracking-normal placeholder:text-xs transition-all outline-none bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>
    </div>
  );
});

CaptchaBox.displayName = 'CaptchaBox';
