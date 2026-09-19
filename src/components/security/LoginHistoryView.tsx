import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Mail,
  Send,
  LogOut,
  RefreshCw,
  Laptop,
  Smartphone,
  KeyRound,
  Lock,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { LoginHistoryEntry } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ConfirmationModal } from '../common/ConfirmationModal';

export const LoginHistoryView: React.FC = () => {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE'>('ALL');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<LoginHistoryEntry | null>(null);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login-history', {
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success && data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.warn('Failed to fetch login history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const handleSendToEmail = async () => {
    if (!user?.email) {
      showToast(language === 'en' ? 'Account email not found.' : 'Email akun tidak ditemukan.', 'error');
      return;
    }

    setIsSendingEmail(true);
    try {
      const res = await fetch('/api/auth/send-login-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({ email: user.email })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || t('historySentToast'), 'success');
      } else {
        showToast(data.message || (language === 'en' ? 'Failed to send login history email' : 'Gagal mengirim email riwayat login'), 'error');
      }
    } catch (err) {
      showToast(language === 'en' ? 'Failed to connect to server for email delivery' : 'Gagal menghubungi server untuk pengiriman email', 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!sessionToRevoke) return;

    setIsRevoking(true);
    try {
      const res = await fetch('/api/auth/force-logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          sessionId: sessionToRevoke.sessionId,
          reason: user?.role === 'MANAGER'
            ? (language === 'en' ? `Force logged out by Manager (${user.name})` : `Dipaksa logout oleh Manager (${user.name})`)
            : (language === 'en' ? 'Revoked by user via app' : 'Dikeluarkan oleh pengguna melalui aplikasi')
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          user?.role === 'MANAGER'
            ? (language === 'en'
                ? `Device session for ${sessionToRevoke.name} was successfully force-logged out!`
                : `Sesi perangkat untuk ${sessionToRevoke.name} berhasil dipaksa logout oleh Manager!`)
            : (language === 'en' ? 'Device session successfully revoked and logged out!' : 'Sesi perangkat berhasil diputus dan dikeluarkan!'),
          'success'
        );
        setHistory(prev =>
          prev.map(item =>
            item.sessionId === sessionToRevoke.sessionId
              ? {
                  ...item,
                  status: 'REVOKED',
                  revokedAt: new Date().toISOString(),
                  revokeReason: user?.role === 'MANAGER'
                    ? (language === 'en' ? `Force logged out by Manager (${user.name})` : `Dipaksa logout oleh Manager (${user.name})`)
                    : (language === 'en' ? 'Revoked by user via app' : 'Dikeluarkan oleh pengguna melalui aplikasi')
                }
              : item
          )
        );
      } else {
        showToast(data.message || (language === 'en' ? 'Failed to revoke session' : 'Gagal memutuskan sesi'), 'error');
      }
    } catch (err) {
      showToast(language === 'en' ? 'Connection failed while revoking session' : 'Koneksi gagal saat memutuskan sesi', 'error');
    } finally {
      setIsRevoking(false);
      setSessionToRevoke(null);
    }
  };

  const activeSessions = history.filter(h => h.status === 'ACTIVE');
  const displayedHistory = filter === 'ACTIVE' ? activeSessions : history;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleString(language === 'en' ? 'en-US' : 'id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Jakarta'
        }) + ' WIB'
      );
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Confirmation Modal for Revoking Session */}
      <ConfirmationModal
        isOpen={!!sessionToRevoke}
        title={
          user?.role === 'MANAGER'
            ? (language === 'en' ? 'Manager Force Logout' : 'Otorisasi Paksa Logout (Manager)')
            : t('confirmRevokeTitle')
        }
        message={
          sessionToRevoke
            ? (user?.role === 'MANAGER'
                ? (language === 'en'
                    ? `Are you sure you want to force logout user ${sessionToRevoke.name} (${sessionToRevoke.role}) from device "${sessionToRevoke.device || 'Device'}"? The user session on that browser will be terminated immediately.`
                    : `Apakah Anda yakin ingin memaksa logout sesi ${sessionToRevoke.name} (${sessionToRevoke.role}) pada perangkat "${sessionToRevoke.device || 'Perangkat'}"? Akses pengguna di browser tersebut akan langsung diputus seketika.`)
                : (language === 'en'
                    ? `Are you sure you want to disconnect device session (${sessionToRevoke.device || 'Device'})? The user on this device will be logged out immediately.`
                    : `Apakah Anda yakin ingin mengeluarkan sesi perangkat (${sessionToRevoke.device || 'Perangkat'})? Pengguna di perangkat tersebut akan dipaksa logout seketika dari sistem POS.`))
            : t('confirmRevokeMsg')
        }
        confirmText={
          user?.role === 'MANAGER'
            ? (language === 'en' ? 'Force Logout' : 'Paksa Logout')
            : t('revokeBtn')
        }
        cancelText={t('cancelBtn')}
        confirmVariant="danger"
        isLoading={isRevoking}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setSessionToRevoke(null)}
      />

      {/* Top Banner & Action Header */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100 font-heading">
              {t('loginHistoryTitle')}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 max-w-xl">
              {t('loginHistorySubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="p-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleSendToEmail}
            disabled={isSendingEmail}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent text-white font-semibold text-xs sm:text-sm hover:bg-accent-hover transition-all shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {isSendingEmail ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t('sendingHistory')}</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>{t('sendHistoryToEmail')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              {t('activeSessions')}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400 mt-1">
            {activeSessions.length}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            {t('allSessions')}
          </span>
          <p className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100 mt-1">
            {history.length}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            {language === 'en' ? 'Security Notification Email' : 'Email Notifikasi Keamanan'}
          </span>
          <p className="text-xs font-bold text-accent truncate mt-1.5" title={user?.email}>
            {user?.email || '-'}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200/80 dark:border-stone-800 pb-2">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-stone-800/60">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === 'ALL'
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            {t('allSessions')} ({history.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('ACTIVE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              filter === 'ACTIVE'
                ? 'bg-white dark:bg-stone-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {t('activeSessions')} ({activeSessions.length})
          </button>
        </div>

        <p className="text-[11px] text-stone-400 dark:text-stone-500 hidden sm:block">
          {language === 'en'
            ? 'Automated security alert is sent each time an account logs in'
            : 'Notifikasi email otomatis dikirim setiap kali akun login'}
        </p>
      </div>

      {/* History List */}
      {loading ? (
        <div className="py-16 text-center text-stone-400 dark:text-stone-500 flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm">{language === 'en' ? 'Loading login history records...' : 'Memuat catatan riwayat login...'}</p>
        </div>
      ) : displayedHistory.length === 0 ? (
        <div className="py-16 text-center text-stone-400 dark:text-stone-500 bg-white dark:bg-[#251e1c] rounded-3xl border border-stone-200/80 dark:border-stone-800 p-6">
          <ShieldCheck className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
          <p className="font-semibold text-stone-700 dark:text-stone-300">
            {language === 'en'
              ? (filter === 'ACTIVE' ? 'No other active sessions' : 'No login history recorded yet')
              : (filter === 'ACTIVE' ? 'Tidak ada sesi aktif lain' : 'Belum ada riwayat login')}
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            {language === 'en'
              ? 'Login events are logged automatically when cashiers or managers sign in'
              : 'Riwayat login akan tercatat otomatis saat kasir atau manager masuk ke sistem'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayedHistory.map((entry, idx) => {
            const isActive = entry.status === 'ACTIVE';
            const isRevoked = entry.status === 'REVOKED';
            const isMobile = entry.device?.toLowerCase().includes('mobile') || entry.device?.toLowerCase().includes('ios') || entry.device?.toLowerCase().includes('android');
            const isEven = idx % 2 === 0;

            // Odd/even background colors with complete theme awareness
            let rowThemeClasses = '';
            if (isActive) {
              rowThemeClasses = isEven
                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300/90 dark:border-emerald-800/70 shadow-2xs'
                : 'bg-emerald-100/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/50';
            } else if (isRevoked) {
              rowThemeClasses = isEven
                ? 'bg-red-50/60 dark:bg-red-950/35 border-red-200/90 dark:border-red-900/50 shadow-2xs'
                : 'bg-red-100/40 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/40';
            } else {
              rowThemeClasses = isEven
                ? 'bg-white dark:bg-[#251e1c] border-stone-200/90 dark:border-stone-800 shadow-2xs'
                : 'bg-stone-100/70 dark:bg-[#1a1413] border-stone-300/80 dark:border-stone-800/90';
            }

            return (
              <div
                key={entry.id || entry.sessionId || idx}
                className={`p-4 sm:p-5 rounded-3xl border transition-all hover:border-stone-300 dark:hover:border-stone-700 ${rowThemeClasses}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Device & User Info */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400'
                          : isRevoked
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                      }`}
                    >
                      {isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 truncate">
                          {entry.device || (language === 'en' ? 'POS Device' : 'Perangkat POS')}
                        </h4>

                        {/* Status Badge */}
                        {isActive && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {t('sessionActiveBadge')}
                          </span>
                        )}

                        {isRevoked && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
                            {t('revokedBadge')}
                          </span>
                        )}

                        {!isActive && !isRevoked && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                            {t('loggedOutBadge')}
                          </span>
                        )}
                      </div>

                      {/* Meta information: Date, IP, Method */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400 mt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>{formatDate(entry.timestamp)}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-stone-400" />
                          <code className="text-[11px] bg-stone-100 dark:bg-stone-800/80 px-1.5 py-0.5 rounded text-stone-700 dark:text-stone-300">
                            {entry.ipAddress || '127.0.0.1'}
                          </code>
                        </div>

                        <div className="flex items-center gap-1">
                          {entry.loginMethod === 'PIN' ? (
                            <>
                              <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                              <span>{language === 'en' ? 'Quick PIN' : 'PIN Cepat'}</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-blue-500" />
                              <span>Password</span>
                            </>
                          )}
                        </div>

                        <div className="text-[11px] text-stone-400 dark:text-stone-500">
                          {language === 'en' ? 'User:' : 'Pengguna:'} <strong>{entry.name}</strong> ({entry.role})
                        </div>
                      </div>

                      {/* Revocation reason note if revoked */}
                      {isRevoked && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {entry.revokeReason || (language === 'en' ? 'Session revoked remotely' : 'Akses sesi dicabut dari jarak jauh')}
                          {entry.revokedAt && ` (${formatDate(entry.revokedAt)})`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Revoke / Force Logout Action Button */}
                  {isActive && (
                    <div className="self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setSessionToRevoke(entry)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                          user?.role === 'MANAGER'
                            ? 'bg-red-50 hover:bg-red-600 dark:bg-red-950/40 text-red-600 hover:text-white dark:text-red-400 dark:hover:text-white border border-red-300 dark:border-red-900/60'
                            : 'border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white'
                        }`}
                        title={user?.role === 'MANAGER' ? 'Manager: Paksa logout sesi perangkat ini' : 'Putuskan sesi'}
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>
                          {user?.role === 'MANAGER'
                            ? (language === 'en' ? 'Force Logout' : 'Paksa Logout')
                            : t('revokeBtn')}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
