import React, { useState } from 'react';
import { Lock, Mail, ShieldAlert, CheckCircle2, ArrowRight, UserCog, AlertCircle, RefreshCw, X, Copy, Check, KeyRound, Sparkles } from 'lucide-react';

export interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
  onOpenResetWithToken?: (token: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  defaultEmail = '',
  onOpenResetWithToken
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'admin'>('link');

  // Tab 1: Self-service link
  const [emailForLink, setEmailForLink] = useState(defaultEmail);
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<{
    message: string;
    email: string;
    resetUrl?: string;
    token?: string;
    userName?: string;
  } | null>(null);

  // Tab 2: Request to Admin
  const [emailForAdmin, setEmailForAdmin] = useState(defaultEmail);
  const [adminNote, setAdminNote] = useState('');
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<{
    message: string;
    email: string;
    requestId?: string;
    userName?: string;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setLinkSuccess(null);

    const email = emailForLink.trim();
    if (!email) {
      setLinkError('Silakan masukkan alamat email akun Anda.');
      return;
    }

    setIsSubmittingLink(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (res.status === 404 || !data.success) {
        setLinkError(
          data.message || 'Email tidak terdaftar dalam sistem KasirKafe POS. Silakan periksa kembali email Anda atau hubungi Administrator.'
        );
      } else {
        setLinkSuccess({
          message: data.message,
          email: data.email || email,
          userName: data.userName,
          resetUrl: data.resetUrl,
          token: data.token
        });
      }
    } catch (err: any) {
      setLinkError('Gagal menghubungi server. Periksa koneksi internet Anda dan coba lagi.');
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const handleRequestToAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminSuccess(null);

    const email = emailForAdmin.trim();
    if (!email) {
      setAdminError('Silakan masukkan alamat email akun Anda.');
      return;
    }

    setIsSubmittingAdmin(true);
    try {
      const res = await fetch('/api/auth/password-reset-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, note: adminNote })
      });
      const data = await res.json();

      if (res.status === 404 || !data.success) {
        setAdminError(
          data.message || 'Email tidak terdaftar dalam sistem KasirKafe POS. Permintaan ke ADMIN hanya dapat diajukan untuk akun yang telah terdaftar.'
        );
      } else {
        setAdminSuccess({
          message: data.message,
          email: data.user?.email || email,
          userName: data.user?.name,
          requestId: data.requestId
        });
      }
    } catch (err: any) {
      setAdminError('Gagal menghubungi server. Periksa koneksi internet Anda.');
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  const handleCopy = (text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div
      id="forgot-password-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="forgot-password-modal-card"
        className="w-full max-w-lg bg-white dark:bg-[#251e1c] rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 font-heading">
                Lupa Kata Sandi (Password)
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Kirim link reset ke email atau minta reset langsung ke Role ADMIN
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

        {/* Tab Switcher */}
        <div className="p-3 bg-stone-100/70 dark:bg-stone-900/60 border-b border-stone-200/60 dark:border-stone-800 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('link');
              setLinkError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'link'
                ? 'bg-white dark:bg-[#2c2422] text-accent shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Kirim Link ke Email</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setAdminError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-white dark:bg-[#2c2422] text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <UserCog className="w-4 h-4" />
            <span>Minta Reset ke ADMIN</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* TAB 1: KIRIM LINK RESET PASSWORD KE EMAIL */}
          {activeTab === 'link' && (
            <div>
              {linkSuccess ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Link Reset Password Berhasil Dikirim!</span>
                    </div>
                    <p className="leading-relaxed">
                      Kami telah memverifikasi akun Anda dan mengirimkan tautan untuk membuat kata sandi baru ke alamat email:{' '}
                      <strong className="underline">{linkSuccess.email}</strong>. Silakan periksa kotak masuk atau folder spam email Anda.
                    </p>
                  </div>

                  {/* Reset Link and Direct Action */}
                  {linkSuccess.resetUrl && (
                    <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
                      <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                        Tautan Atur Ulang Kata Sandi:
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={linkSuccess.resetUrl}
                          className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 select-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(linkSuccess.resetUrl!)}
                          className="px-3 py-2 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="Salin Link"
                        >
                          {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                          <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
                        </button>
                      </div>

                      {linkSuccess.token && onOpenResetWithToken && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenResetWithToken(linkSuccess.token!);
                          }}
                          className="w-full mt-2 py-2.5 px-4 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-95 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Buka Layar Atur Kata Sandi Sekarang</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setLinkSuccess(null)}
                      className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                      Kirim ke Email Lain
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold hover:opacity-90 transition-colors cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendResetLink} className="space-y-4">
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    Masukkan alamat email yang terdaftar pada akun kasir atau manajer Anda. Sistem akan memeriksa apakah email Anda terdaftar dan mengirimkan tautan untuk membuat kata sandi baru.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                      Alamat Email Akun Terdaftar <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="input-forgot-password-email"
                        type="email"
                        required
                        value={emailForLink}
                        onChange={e => {
                          setEmailForLink(e.target.value);
                          setLinkError(null);
                        }}
                        placeholder="contoh: sarah@beverage.com"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
                        autoFocus
                      />
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Error Notification Banner if Email Not Found */}
                  {linkError && (
                    <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold block">Pemeriksaan Email:</span>
                        <span>{linkError}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      id="btn-submit-forgot-password"
                      type="submit"
                      disabled={isSubmittingLink}
                      className="w-full py-3.5 rounded-2xl bg-accent text-white font-bold text-xs sm:text-sm shadow-md hover:opacity-95 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmittingLink ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Memeriksa Email & Mengirimkan Link...</span>
                        </>
                      ) : (
                        <>
                          <span>Kirim Tautan Reset Password</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: MINTA RESET PASSWORD KE ROLE ADMIN */}
          {activeTab === 'admin' && (
            <div>
              {adminSuccess ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-purple-800 dark:text-purple-300">
                      <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>Permintaan Terkirim ke Administrator!</span>
                    </div>
                    <p className="leading-relaxed">
                      {adminSuccess.message}
                    </p>
                    <p className="text-[11px] text-purple-700 dark:text-purple-400">
                      Administrator Sistem (Role ADMIN) akan meninjau akun Anda dan membuatkan kata sandi baru yang akan dikirimkan langsung ke email:{' '}
                      <strong>{adminSuccess.email}</strong>.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold hover:opacity-90 transition-colors cursor-pointer"
                  >
                    Kembali ke Layar Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestToAdmin} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/50 text-purple-900 dark:text-purple-200 text-xs flex items-start gap-2.5">
                    <UserCog className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Fitur ini diperuntukkan jika Anda tidak dapat mengakses tautan email atau akun Anda terkunci. <strong>Role ADMIN</strong> akan membuatkan kata sandi baru dan mengirimkannya ke email terdaftar Anda.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                      Email Akun Anda <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="input-admin-request-email"
                        type="email"
                        required
                        value={emailForAdmin}
                        onChange={e => {
                          setEmailForAdmin(e.target.value);
                          setAdminError(null);
                        }}
                        placeholder="contoh: kasir@beverage.com"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
                      />
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                      Keterangan / Alasan Permintaan (Opsional)
                    </label>
                    <textarea
                      value={adminNote}
                      onChange={e => setAdminNote(e.target.value)}
                      rows={3}
                      placeholder="Contoh: Lupa password akun / akun terkunci karena salah input 3 kali."
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 resize-none"
                    />
                  </div>

                  {/* Error Notification if Email doesn't exist */}
                  {adminError && (
                    <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold block">Pemeriksaan Email:</span>
                        <span>{adminError}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      id="btn-submit-admin-request"
                      type="submit"
                      disabled={isSubmittingAdmin}
                      className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmittingAdmin ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Memeriksa Email & Mengirimkan Permintaan...</span>
                        </>
                      ) : (
                        <>
                          <span>Minta Reset Password ke Role ADMIN</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
