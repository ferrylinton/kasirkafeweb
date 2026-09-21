import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Play,
  Eye,
  Settings2,
  Database,
  FileSpreadsheet,
  Mail,
  Activity,
  History,
  ShieldAlert,
  ArrowRight,
  Info,
  Check,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';

interface CollectionStats {
  collection: 'orders' | 'inventory_logs' | 'email_logs' | 'activity_logs';
  label: string;
  totalCount: number;
  olderThanCutoffCount: number;
  retainedCount: number;
  oldestRecordDate: string | null;
}

interface HousekeepingSettings {
  enabled: boolean;
  retentionMonths: number;
  noticeDaysBefore: number;
  notificationMessage: string;
  notificationTitle: string;
  runAtBeginningOfMonth: boolean;
  simulationActive: boolean;
}

interface NoticeInfo {
  isNoticeActive: boolean;
  simulationActive: boolean;
  message: string;
  title: string;
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

interface ExecutionRecord {
  id: string;
  executedAt: string;
  triggeredBy: string;
  cutoffDate: string;
  retentionMonths: number;
  ordersDeleted: number;
  inventoryLogsDeleted: number;
  emailLogsDeleted: number;
  activityLogsDeleted: number;
  totalDeleted: number;
  activeRemaining: {
    orders: number;
    inventory_logs: number;
    email_logs: number;
    activity_logs: number;
  };
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'SIMULATED';
  isDryRun: boolean;
}

export const HousekeepingScreen: React.FC = () => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Data states
  const [settings, setSettings] = useState<HousekeepingSettings>({
    enabled: true,
    retentionMonths: 3,
    noticeDaysBefore: 2,
    notificationTitle: 'Jadwal Housekeeping Data Awal Bulan',
    notificationMessage:
      'Pemberitahuan Housekeeping: Pembersihan data otomatis berkala (orders, inventory_logs, email_logs, activity_logs) berusia lebih dari 3 bulan dijadwalkan berjalan pada awal bulan mendatang.',
    runAtBeginningOfMonth: true,
    simulationActive: false
  });

  const [collectionsStats, setCollectionsStats] = useState<CollectionStats[]>([]);
  const [totalRecordsAll, setTotalRecordsAll] = useState(0);
  const [totalPurgeableAll, setTotalPurgeableAll] = useState(0);
  const [totalRetainedAll, setTotalRetainedAll] = useState(0);
  const [cutoffDateStr, setCutoffDateStr] = useState('');
  const [noticeInfo, setNoticeInfo] = useState<NoticeInfo | null>(null);
  const [history, setHistory] = useState<ExecutionRecord[]>([]);

  // Modals
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [dryRunModalOpen, setDryRunModalOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<ExecutionRecord | null>(null);

  // Form State
  const [formSettings, setFormSettings] = useState<HousekeepingSettings>(settings);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/housekeeping/status', {
        headers: { Authorization: `Bearer ${token || ''}` }
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setFormSettings(data.settings);
        setNoticeInfo(data.notice);
        setHistory(data.history || []);
        if (data.stats) {
          setCollectionsStats(data.stats.collections || []);
          setTotalRecordsAll(data.stats.totalRecordsAll || 0);
          setTotalPurgeableAll(data.stats.totalPurgeableAll || 0);
          setTotalRetainedAll(data.stats.totalRetainedAll || 0);
          setCutoffDateStr(data.stats.cutoffDate || '');
        }
      } else {
        showToast(data.error || 'Gagal mengambil data status housekeeping', 'error');
      }
    } catch (err: any) {
      showToast('Koneksi server terganggu saat memuat status housekeeping', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStatus();
    }
  }, [token]);

  // Execute Live Housekeeping
  const handleRunHousekeeping = async () => {
    setExecuting(true);
    try {
      const res = await fetch('/api/admin/housekeeping/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Proses housekeeping berhasil dijalankan!', 'success');
        setConfirmModalOpen(false);
        fetchStatus();
      } else {
        showToast(data.error || 'Gagal mengeksekusi housekeeping', 'error');
      }
    } catch (err: any) {
      showToast('Gagal menghubungi server untuk eksekusi housekeeping', 'error');
    } finally {
      setExecuting(false);
    }
  };

  // Run Dry Run (Simulation)
  const handleDryRun = async () => {
    setDryRunning(true);
    try {
      const res = await fetch('/api/admin/housekeeping/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success && data.simulation) {
        setDryRunResult(data.simulation);
        setDryRunModalOpen(true);
        showToast('Simulasi dry-run selesai dievaluasi.', 'info');
      } else {
        showToast(data.error || 'Gagal menjalankan simulasi dry-run', 'error');
      }
    } catch (err: any) {
      showToast('Gagal terhubung ke server saat simulasi dry-run', 'error');
    } finally {
      setDryRunning(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/housekeeping/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify(formSettings)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Pengaturan housekeeping berhasil disimpan.', 'success');
        setSettings(data.settings);
        setFormSettings(data.settings);
        if (data.notice) setNoticeInfo(data.notice);
        if (data.stats) {
          setCollectionsStats(data.stats.collections || []);
          setTotalRecordsAll(data.stats.totalRecordsAll || 0);
          setTotalPurgeableAll(data.stats.totalPurgeableAll || 0);
          setTotalRetainedAll(data.stats.totalRetainedAll || 0);
          setCutoffDateStr(data.stats.cutoffDate || '');
        }
      } else {
        showToast(data.error || 'Gagal menyimpan pengaturan', 'error');
      }
    } catch (err: any) {
      showToast('Gagal menyimpan pengaturan ke server', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Toggle Simulation Active directly
  const handleToggleSimulation = async (val: boolean) => {
    const updated = { ...formSettings, simulationActive: val };
    setFormSettings(updated);
    try {
      const res = await fetch('/api/admin/housekeeping/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({ simulationActive: val })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        if (data.notice) setNoticeInfo(data.notice);
        showToast(
          val
            ? 'Mode simulasi banner diaktifkan. Banner kini tampil di bagian atas aplikasi.'
            : 'Mode simulasi banner dinonaktifkan.',
          'info'
        );
      }
    } catch {
      showToast('Gagal mengubah mode simulasi banner', 'error');
    }
  };

  const getCollectionIcon = (col: string) => {
    switch (col) {
      case 'orders':
        return <FileSpreadsheet className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case 'inventory_logs':
        return <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'email_logs':
        return <Mail className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'activity_logs':
        return <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
      default:
        return <Database className="w-5 h-5 text-stone-600" />;
    }
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200/80 dark:border-stone-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
            <span>Administrasi Sistem</span>
            <span>/</span>
            <span className="text-orange-600 dark:text-orange-400 font-bold">Housekeeping & Retensi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-stone-900 dark:text-white flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-orange-100 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </span>
            <span>Housekeeping Data Awal Bulan</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1.5 max-w-3xl leading-relaxed">
            Sistem terjadwal otomatis di awal bulan untuk membersihkan data transaksi (<strong>orders</strong>), riwayat stok (<strong>inventory_logs</strong>), riwayat email (<strong>email_logs</strong>), dan log aktivitas (<strong>activity_logs</strong>) yang berumur <strong>lebih dari 3 bulan</strong>, disertai notifikasi 2 hari sebelum akhir bulan.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            id="hk-refresh-btn"
            onClick={fetchStatus}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-750 text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan Status</span>
          </button>

          <button
            type="button"
            id="hk-dry-run-btn"
            onClick={handleDryRun}
            disabled={dryRunning || loading}
            className="px-3.5 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-500/20 text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{dryRunning ? 'Mengevaluasi...' : 'Simulasi / Dry-Run'}</span>
          </button>

          <button
            type="button"
            id="hk-run-now-btn"
            onClick={() => setConfirmModalOpen(true)}
            disabled={executing || loading}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{executing ? 'Sedang Membersihkan...' : 'Jalankan Housekeeping Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* 2. Overview Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Skeduler */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Status Skeduler</span>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2.5 h-2.5 rounded-full ${settings.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
            <span className="text-base font-extrabold text-stone-900 dark:text-white font-heading">
              {settings.enabled ? 'Aktif (Awal Bulan)' : 'Dinonaktifkan'}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            {settings.runAtBeginningOfMonth ? 'Eksekusi setiap tanggal 1, 00:00 WIB' : 'Jadwal manual'}
          </p>
        </div>

        {/* Jadwal Eksekusi Mendatang */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Eksekusi Mendatang</span>
            <Calendar className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-base font-extrabold text-stone-900 dark:text-white font-heading mt-2">
            {noticeInfo ? new Date(noticeInfo.nextScheduledRun).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '1 Bulan Depan'}
          </p>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 font-mono">
            {noticeInfo ? `Tersisa ${noticeInfo.daysUntilScheduledRun} hari lagi` : 'Setiap tanggal 1'}
          </p>
        </div>

        {/* Kebijakan Batas Waktu */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Batas Retensi</span>
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-base font-extrabold text-stone-900 dark:text-white font-heading mt-2">
            &gt; {settings.retentionMonths} Bulan (90 Hari)
          </p>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            Cutoff saat ini: {cutoffDateStr ? new Date(cutoffDateStr).toLocaleDateString('id-ID') : '...'}
          </p>
        </div>

        {/* Notifikasi Akhir Bulan */}
        <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Notifikasi Akhir Bulan</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2.5 h-2.5 rounded-full ${noticeInfo?.isNoticeActive ? 'bg-amber-500 animate-ping' : 'bg-stone-300 dark:bg-stone-700'}`} />
            <span className="text-base font-extrabold text-stone-900 dark:text-white font-heading">
              {noticeInfo?.isNoticeActive ? 'Sedang Tampil' : 'Standby'}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            {noticeInfo?.isNoticeActive
              ? (noticeInfo.simulationActive ? 'Aktif (Mode Simulasi Preview)' : 'Aktif (2 hari sebelum akhir bulan)')
              : `${settings.noticeDaysBefore} hari sebelum akhir bulan`}
          </p>
        </div>
      </div>

      {/* 3. End-of-Month Notification Section with Simulation Toggle */}
      <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 dark:from-amber-950/30 dark:via-stone-900 dark:to-orange-950/20 rounded-2xl border border-amber-300/60 dark:border-amber-700/50 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                Mekanisme Notifikasi
              </span>
              <h3 className="text-base font-bold text-stone-900 dark:text-white font-heading">
                Pemberitahuan Otomatis 2 Hari Sebelum Akhir Bulan
              </h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed max-w-3xl">
              Sistem secara otomatis menampilkan spanduk pemberitahuan pada semua pengguna yang login mulai <strong>2 hari sebelum hari terakhir dalam bulan berjalan</strong> (misal tanggal 28-30 untuk bulan 30 hari), agar pengguna mengetahui pembersihan data berumur &gt; 3 bulan akan berlangsung saat pergantian bulan.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              id="toggle-simulation-notice-btn"
              onClick={() => handleToggleSimulation(!settings.simulationActive)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
                settings.simulationActive
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-750'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${settings.simulationActive ? 'animate-spin' : ''}`} />
              <span>
                {settings.simulationActive ? 'Matikan Simulasi Banner' : 'Uji / Simulasikan Banner Sekarang'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Preview of Banner */}
        <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
              Pratinjau Banner Pengguna:
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              Hari ini: {noticeInfo ? `Tgl ${noticeInfo.currentDay} / Akhir Bulan: Tgl ${noticeInfo.lastDayOfMonth}` : ''}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white text-xs shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-100" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold uppercase text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                    PEMBERITAHUAN
                  </span>
                  <span className="font-bold">{settings.notificationTitle}</span>
                </div>
                <p className="text-amber-100 text-[11px] mt-0.5 truncate">{settings.notificationMessage}</p>
              </div>
            </div>
            <span className="px-2 py-1 rounded-md bg-white/20 text-[10px] font-bold shrink-0">
              Tutup [X]
            </span>
          </div>
        </div>
      </div>

      {/* 4. Four Target Data Categories Cards (Orders, Inventory Logs, Email Logs, Activity Logs) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-heading text-stone-900 dark:text-white">
              Data Sasaran Pembersihan Housekeeping (4 Kategori)
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Rincian volume data aktif vs data kedaluwarsa (&gt; {settings.retentionMonths} bulan) yang akan dibersihkan di awal bulan.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              Total Siap Dibersihkan:
            </span>
            <p className="text-base font-extrabold text-red-600 dark:text-red-400 font-mono">
              {totalPurgeableAll.toLocaleString('id-ID')} record
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {collectionsStats.map((item) => {
            const percentagePurgeable =
              item.totalCount > 0 ? Math.round((item.olderThanCutoffCount / item.totalCount) * 100) : 0;

            return (
              <div
                key={item.collection}
                id={`hk-card-${item.collection}`}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                      {getCollectionIcon(item.collection)}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                      {item.collection}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-stone-900 dark:text-white mt-3 font-heading">
                    {item.label}
                  </h3>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500 dark:text-stone-400">Total Record:</span>
                      <span className="font-extrabold font-mono text-stone-900 dark:text-white">
                        {item.totalCount.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        Kedaluwarsa (&gt; {settings.retentionMonths} bln):
                      </span>
                      <span className="font-extrabold font-mono text-red-600 dark:text-red-400">
                        {item.olderThanCutoffCount.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Dipertahankan (&lt; {settings.retentionMonths} bln):
                      </span>
                      <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                        {item.retainedCount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Visual Proportion Bar */}
                  <div className="mt-3">
                    <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${percentagePurgeable}%` }}
                        className="bg-red-500 dark:bg-red-600 h-full transition-all"
                        title={`${percentagePurgeable}% akan dibersihkan`}
                      />
                      <div
                        style={{ width: `${100 - percentagePurgeable}%` }}
                        className="bg-emerald-500 h-full transition-all"
                        title={`${100 - percentagePurgeable}% dipertahankan`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-stone-400 mt-1">
                      <span>Hapus: {percentagePurgeable}%</span>
                      <span>Simpan: {100 - percentagePurgeable}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400">
                  <span>Data tertua: </span>
                  <strong className="text-stone-700 dark:text-stone-300">
                    {item.oldestRecordDate ? new Date(item.oldestRecordDate).toLocaleDateString('id-ID') : '-'}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Housekeeping Settings Form */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <div>
              <h3 className="font-bold text-stone-900 dark:text-white font-heading">
                Konfigurasi Jadwal & Retensi Housekeeping
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Atur jadwal otomatis awal bulan, durasi retensi, dan pengaturan teks notifikasi.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Toggle Scheduler Enabled */}
            <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-750 flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  Skeduler Otomatis Awal Bulan
                </label>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Jalankan pembersihan otomatis setiap tanggal 1
                </p>
              </div>
              <input
                type="checkbox"
                id="setting-enabled-toggle"
                checked={formSettings.enabled}
                onChange={(e) => setFormSettings({ ...formSettings, enabled: e.target.checked })}
                className="w-5 h-5 text-orange-600 rounded cursor-pointer"
              />
            </div>

            {/* Retention Duration Selector */}
            <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-750">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block mb-1">
                Batas Waktu Retensi Data
              </label>
              <select
                id="setting-retention-select"
                value={formSettings.retentionMonths}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, retentionMonths: parseInt(e.target.value, 10) })
                }
                className="w-full text-xs font-semibold p-2 rounded-lg bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white"
              >
                <option value={1}>1 Bulan (30 Hari)</option>
                <option value={2}>2 Bulan (60 Hari)</option>
                <option value={3}>3 Bulan (90 Hari) - Default Standar</option>
                <option value={6}>6 Bulan (180 Hari)</option>
                <option value={12}>12 Bulan (1 Tahun)</option>
              </select>
            </div>

            {/* Notice Days Selector */}
            <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-750">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block mb-1">
                Munculkan Notifikasi Sebelum Akhir Bulan
              </label>
              <select
                id="setting-notice-days-select"
                value={formSettings.noticeDaysBefore}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, noticeDaysBefore: parseInt(e.target.value, 10) })
                }
                className="w-full text-xs font-semibold p-2 rounded-lg bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white"
              >
                <option value={1}>1 Hari Sebelum Akhir Bulan</option>
                <option value={2}>2 Hari Sebelum Akhir Bulan (Default)</option>
                <option value={3}>3 Hari Sebelum Akhir Bulan</option>
                <option value={5}>5 Hari Sebelum Akhir Bulan</option>
              </select>
            </div>
          </div>

          {/* Notification Texts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block mb-1">
                Judul Notifikasi
              </label>
              <input
                type="text"
                id="setting-notification-title"
                value={formSettings.notificationTitle}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, notificationTitle: e.target.value })
                }
                className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block mb-1">
                Pesan Notifikasi Pengguna
              </label>
              <input
                type="text"
                id="setting-notification-message"
                value={formSettings.notificationMessage}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, notificationMessage: e.target.value })
                }
                className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white font-medium"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              id="save-hk-settings-btn"
              disabled={savingSettings}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{savingSettings ? 'Menyimpan...' : 'Simpan Perubahan Pengaturan'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 6. Execution History / Audit Log */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div>
              <h3 className="font-bold text-stone-900 dark:text-white font-heading">
                Riwayat Eksekusi Housekeeping
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Log audit siklus pembersihan data otomatis maupun manual yang telah selesai dijalankan.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
            {history.length} Catatan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-850 text-stone-500 dark:text-stone-400 font-bold border-b border-stone-200/70 dark:border-stone-750">
              <tr>
                <th className="py-3 px-4">Waktu Eksekusi</th>
                <th className="py-3 px-4">Pemicu</th>
                <th className="py-3 px-4">Batas Cutoff</th>
                <th className="py-3 px-4 text-center">Orders</th>
                <th className="py-3 px-4 text-center">Inventory</th>
                <th className="py-3 px-4 text-center">Email</th>
                <th className="py-3 px-4 text-center">Activity</th>
                <th className="py-3 px-4 text-right">Total Dihapus</th>
                <th className="py-3 px-4 text-center">Durasi</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-stone-400">
                    Belum ada riwayat eksekusi housekeeping tercatat.
                  </td>
                </tr>
              ) : (
                history.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-stone-50/70 dark:hover:bg-stone-850/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                      {new Date(rec.executedAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rec.triggeredBy.includes('SCHEDULED')
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                            : rec.triggeredBy.includes('DRY')
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {rec.triggeredBy}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-500 dark:text-stone-400 whitespace-nowrap font-mono">
                      &lt; {new Date(rec.cutoffDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-stone-700 dark:text-stone-300">
                      {rec.ordersDeleted}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-stone-700 dark:text-stone-300">
                      {rec.inventoryLogsDeleted}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-stone-700 dark:text-stone-300">
                      {rec.emailLogsDeleted}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-stone-700 dark:text-stone-300">
                      {rec.activityLogsDeleted}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-red-600 dark:text-red-400">
                      {rec.totalDeleted} items
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-stone-500">
                      {rec.durationMs}ms
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.status === 'SUCCESS'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : rec.status === 'SIMULATED'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {rec.status === 'SUCCESS' && <CheckCircle2 className="w-3 h-3" />}
                        <span>{rec.status}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Live Execution */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white font-heading">
                Konfirmasi Eksekusi Housekeeping
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                Tindakan ini akan secara permanen menghapus seluruh data yang berusia <strong>lebih dari {settings.retentionMonths} bulan</strong> (sebelum tanggal {cutoffDateStr ? new Date(cutoffDateStr).toLocaleDateString('id-ID') : '...'}) pada 4 koleksi:
              </p>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>Pesanan (orders):</span>
                <strong className="text-red-600">
                  {collectionsStats.find((c) => c.collection === 'orders')?.olderThanCutoffCount || 0} items
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Log Inventaris (inventory_logs):</span>
                <strong className="text-red-600">
                  {collectionsStats.find((c) => c.collection === 'inventory_logs')?.olderThanCutoffCount || 0} items
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Log Email (email_logs):</span>
                <strong className="text-red-600">
                  {collectionsStats.find((c) => c.collection === 'email_logs')?.olderThanCutoffCount || 0} items
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Log Aktivitas (activity_logs):</span>
                <strong className="text-red-600">
                  {collectionsStats.find((c) => c.collection === 'activity_logs')?.olderThanCutoffCount || 0} items
                </strong>
              </div>
              <div className="pt-2 border-t border-stone-200 dark:border-stone-750 flex justify-between font-bold">
                <span>Total Akan Dihapus:</span>
                <span className="text-red-600">{totalPurgeableAll} items</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={executing}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-xs font-bold text-stone-700 dark:text-stone-300 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="confirm-run-hk-btn"
                onClick={handleRunHousekeeping}
                disabled={executing}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{executing ? 'Menghapus...' : 'Ya, Bersihkan Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dry Run Result Modal */}
      {dryRunModalOpen && dryRunResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
              <Eye className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white font-heading">
                Hasil Simulasi Dry-Run
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                Data tidak diubah. Berikut estimasi jumlah record yang akan dihapus jika proses dijalankan:
              </p>
            </div>

            <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Orders Terhapus:</span>
                <span className="font-mono font-bold text-amber-600">{dryRunResult.ordersDeleted}</span>
              </div>
              <div className="flex justify-between">
                <span>Inventory Logs Terhapus:</span>
                <span className="font-mono font-bold text-amber-600">{dryRunResult.inventoryLogsDeleted}</span>
              </div>
              <div className="flex justify-between">
                <span>Email Logs Terhapus:</span>
                <span className="font-mono font-bold text-amber-600">{dryRunResult.emailLogsDeleted}</span>
              </div>
              <div className="flex justify-between">
                <span>Activity Logs Terhapus:</span>
                <span className="font-mono font-bold text-amber-600">{dryRunResult.activityLogsDeleted}</span>
              </div>
              <div className="pt-2 border-t border-stone-200 dark:border-stone-750 flex justify-between font-bold">
                <span>Total Estimasi Dihapus:</span>
                <span className="text-amber-600 font-mono">{dryRunResult.totalDeleted} items</span>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setDryRunModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
