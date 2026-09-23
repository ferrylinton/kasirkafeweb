import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Calendar, CheckCircle, X, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NoticeData {
  isNoticeActive: boolean;
  simulationActive: boolean;
  title: string;
  message: string;
  currentDate: string;
  currentDay: number;
  lastDayOfMonth: number;
  noticeStartDay: number;
  daysUntilNotice: number;
  daysUntilEndOfMonth: number;
  daysUntilScheduledRun: number;
  nextScheduledRun: string;
  retentionMonths: number;
  categories: string[];
}

interface HousekeepingNotificationBannerProps {
  onNavigateToHousekeeping?: () => void;
}

export const HousekeepingNotificationBanner: React.FC<HousekeepingNotificationBannerProps> = ({
  onNavigateToHousekeeping
}) => {
  const { user, token } = useAuth();
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('kasirkafe_hk_notice_dismissed');
      return dismissed === 'true';
    }
    return false;
  });

  const fetchNotice = async () => {
    try {
      const res = await fetch('/api/admin/housekeeping/notification', {
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success && data.notice) {
        setNotice(data.notice);
      }
    } catch (err) {
      // Non-blocking
    }
  };

  useEffect(() => {
    if (token) {
      fetchNotice();
      // Periodically refresh notice status every 60 seconds
      const interval = setInterval(fetchNotice, 60000);
      return () => clearInterval(interval);
    }
  }, [token]);

  if (!notice || !notice.isNoticeActive || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('kasirkafe_hk_notice_dismissed', 'true');
    }
  };

  const nextRunDateFormatted = new Date(notice.nextScheduledRun).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div
      id="housekeeping-notification-banner"
      className="relative z-30 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md border-b border-amber-600/30"
      style={{
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Left Side: Icon & Content */}
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 text-white shadow-xs mt-0.5 sm:mt-0">
            {notice.simulationActive ? (
              <Sparkles className="w-4 h-4 text-amber-100 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-100" />
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold uppercase tracking-wide text-[11px] bg-white/25 px-2 py-0.5 rounded-md text-white font-mono">
                {notice.simulationActive ? 'MODE SIMULASI PEMBERITAHUAN' : 'PEMBERITAHUAN AKHIR BULAN'}
              </span>
              <span className="font-bold text-white font-heading">
                {notice.title}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/20 text-[11px] font-semibold">
                <Clock className="w-3 h-3" />
                {notice.daysUntilScheduledRun > 0
                  ? `${notice.daysUntilScheduledRun} hari lagi menuju ${nextRunDateFormatted}`
                  : `Dijadwalkan besok / awal bulan (${nextRunDateFormatted})`}
              </span>
            </div>

            <p className="text-amber-50 mt-0.5 leading-relaxed text-xs">
              {notice.message}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-amber-100/90">
              <span>Batas Retensi: <strong>&gt; {notice.retentionMonths} Bulan</strong></span>
              <span>•</span>
              <span>Kategori: <strong>orders, inventory_logs, email_logs, activity_logs</strong></span>
              <span>•</span>
              <span>Eksekusi: <strong>1 {new Date(notice.nextScheduledRun).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} (00:00 WIB)</strong></span>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action & Dismiss */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center ml-auto sm:ml-0">
          {user?.role === 'ADMIN' && onNavigateToHousekeeping && (
            <button
              type="button"
              id="banner-manage-housekeeping-btn"
              onClick={onNavigateToHousekeeping}
              className="px-3 py-1.5 rounded-xl bg-white text-orange-800 hover:bg-amber-50 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>Kelola Housekeeping</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            id="banner-dismiss-btn"
            onClick={handleDismiss}
            className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer"
            title="Tutup pemberitahuan ini"
            aria-label="Tutup pemberitahuan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
