import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  FileText,
  Search,
  RotateCcw,
  RefreshCw,
  Download,
  Database,
  Layers,
  AlertTriangle,
  ShieldCheck,
  Receipt,
  Edit3,
  Server,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Trash2,
  Play,
  Terminal,
  Filter,
  ExternalLink,
  Info,
  Laptop
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { AdminAllVendorsHeader } from '../common/AdminAllVendorsHeader';

export interface DailyLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  category: 'AUTH' | 'ORDER' | 'DATA_MUTATION' | 'DATABASE' | 'REDIS' | 'ERROR' | 'SYSTEM';
  message: string;
  actor?: {
    userId?: string;
    email?: string;
    name?: string;
    role?: string;
  };
  vendorId?: string;
  ipAddress?: string;
  userAgent?: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, any>;
  stackTrace?: string;
}

export interface LogFileItem {
  fileName: string;
  date: string;
  sizeBytes: number;
  formattedSize: string;
  mtime: string;
  isToday: boolean;
}

export interface SystemStatusData {
  todayDate: string;
  activeLogFile: string;
  activeFileSize: string;
  totalFiles: number;
  database: {
    type: string;
    status: 'CONNECTED' | 'FALLBACK_IN_MEMORY';
    connected: boolean;
    modeDescription: string;
    uriConfigured: boolean;
  };
  redis: {
    type: string;
    status: 'CONNECTED' | 'FALLBACK_IN_MEMORY';
    connected: boolean;
    modeDescription: string;
    urlConfigured: boolean;
  };
  todayStats?: {
    total: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

export const AdminLogViewerScreen: React.FC = () => {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const fileSelectId = useId();
  const categorySelectId = useId();
  const levelSelectId = useId();
  const testCategorySelectId = useId();
  const testLevelSelectId = useId();

  // State
  const [logFiles, setLogFiles] = useState<LogFileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [statusData, setStatusData] = useState<SystemStatusData | null>(null);
  const [logs, setLogs] = useState<DailyLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [totalEntries, setTotalEntries] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [stats, setStats] = useState<any>(null);

  // Expanded Row
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Test Modal
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [testCategory, setTestCategory] = useState<string>('DATABASE');
  const [testLevel, setTestLevel] = useState<string>('INFO');
  const [testMessage, setTestMessage] = useState<string>('');
  const [isSubmittingTest, setIsSubmittingTest] = useState<boolean>(false);

  // Fetch Log Files & System Status
  const fetchStatusAndFiles = useCallback(async () => {
    try {
      const [filesRes, statusRes] = await Promise.all([
        fetch('/api/admin/system-logs/files', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/admin/system-logs/status', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const filesData = await filesRes.json();
      const statusJson = await statusRes.json();

      if (filesData.success) {
        setLogFiles(filesData.files || []);
        if (!selectedFile && filesData.files?.length > 0) {
          const today = filesData.files.find((f: LogFileItem) => f.isToday);
          setSelectedFile(today ? today.fileName : filesData.files[0].fileName);
        }
      }

      if (statusJson.success) {
        setStatusData(statusJson);
      }
    } catch (err: any) {
      console.error('Failed to load system log status:', err);
    }
  }, [token, selectedFile]);

  // Fetch Log Entries
  const fetchLogs = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const queryParams = new URLSearchParams();
        if (selectedFile) queryParams.set('file', selectedFile);
        if (selectedCategory && selectedCategory !== 'ALL') queryParams.set('category', selectedCategory);
        if (selectedLevel && selectedLevel !== 'ALL') queryParams.set('level', selectedLevel);
        if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());
        queryParams.set('page', page.toString());
        queryParams.set('limit', limit.toString());

        const res = await fetch(`/api/admin/system-logs?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        if (data.success) {
          setLogs(data.entries || []);
          setTotalEntries(data.total || 0);
          setTotalPages(data.totalPages || 1);
          setStats(data.stats || null);
        } else {
          showToast(data.message || 'Gagal memuat log harian', 'error');
        }
      } catch (err: any) {
        showToast('Terjadi kesalahan jaringan saat memuat log', 'error');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedFile, selectedCategory, selectedLevel, searchQuery, page, limit, token, showToast]
  );

  // Initial Load
  useEffect(() => {
    fetchStatusAndFiles();
  }, [fetchStatusAndFiles]);

  // Fetch logs whenever filters/pagination/file change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto Refresh Interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(true);
      fetchStatusAndFiles();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs, fetchStatusAndFiles]);

  // Handle Trigger Test Log
  const handleTriggerTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTest(true);
    try {
      const res = await fetch('/api/admin/system-logs/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          category: testCategory,
          level: testLevel,
          message: testMessage.trim() || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Log [${testCategory}] berhasil dicatat ke file harian!`, 'success');
        setShowTestModal(false);
        setTestMessage('');
        fetchLogs(true);
        fetchStatusAndFiles();
      } else {
        showToast(data.message || 'Gagal menulis test log', 'error');
      }
    } catch (err: any) {
      showToast('Terjadi kesalahan jaringan saat memicu log', 'error');
    } finally {
      setIsSubmittingTest(false);
    }
  };

  // Handle Prune Logs
  const handlePruneLogs = async () => {
    if (!window.confirm('Bersihkan arsip berkas log lama yang telah berusia lebih dari 30 hari?')) {
      return;
    }

    try {
      const res = await fetch('/api/admin/system-logs/prune', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ days: 30 })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        fetchStatusAndFiles();
        fetchLogs(true);
      } else {
        showToast(data.message || 'Gagal membersihkan log lama', 'error');
      }
    } catch (e: any) {
      showToast('Gagal menjalankan pembersihan berkas log', 'error');
    }
  };

  // Copy JSON details
  const handleCopyJson = (entry: DailyLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    setCopiedId(entry.id);
    showToast('Payload JSON log disalin ke papan klip!', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper badge renderers
  const renderLevelBadge = (level: string) => {
    switch (level) {
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <XCircle className="w-3 h-3" /> ERROR
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            <AlertTriangle className="w-3 h-3" /> WARN
          </span>
        );
      case 'DEBUG':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Terminal className="w-3 h-3" /> DEBUG
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            <CheckCircle2 className="w-3 h-3" /> INFO
          </span>
        );
    }
  };

  const renderCategoryBadge = (category: string) => {
    switch (category) {
      case 'AUTH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Autentikasi & Sesi
          </span>
        );
      case 'ORDER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Receipt className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Pesanan Kasir
          </span>
        );
      case 'DATA_MUTATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Edit3 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            Modifikasi Data
          </span>
        );
      case 'DATABASE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Basis Data MongoDB
          </span>
        );
      case 'REDIS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
            <Layers className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            Upstash Redis
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Galat & Pengecualian
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
            <Server className="w-3.5 h-3.5 text-stone-500" />
            Sistem
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-7xl mx-auto space-y-6">


      {/* Top System Health & Connection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#181413] border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${statusData?.database.connected ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-amber-100 dark:bg-amber-950 text-amber-600'}`}>
                <Database className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Koneksi Database</p>
                <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">MongoDB Atlas</h4>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
              statusData?.database.connected
                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusData?.database.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {statusData?.database.status || 'CHECKING'}
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-2.5">
            {statusData?.database.modeDescription || 'Memeriksa status koneksi cluster...'}
          </p>
        </div>

        {/* Redis Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#181413] border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${statusData?.redis.connected ? 'bg-red-100 dark:bg-red-950 text-red-600' : 'bg-sky-100 dark:bg-sky-950 text-sky-600'}`}>
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Koneksi Redis</p>
                <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">Token Bucket / Cache</h4>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
              statusData?.redis.connected
                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                : 'bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusData?.redis.connected ? 'bg-emerald-500 animate-pulse' : 'bg-sky-500'}`} />
              {statusData?.redis.status || 'CHECKING'}
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-2.5">
            {statusData?.redis.modeDescription || 'Memeriksa status token bucket rate limiter...'}
          </p>
        </div>

        {/* Active Rolling File */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#181413] border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Berkas Log Hari Ini</p>
                <h4 className="font-bold text-xs font-mono text-stone-900 dark:text-stone-100 truncate max-w-[140px]">
                  {statusData?.activeLogFile || 'app-YYYY-MM-DD.log'}
                </h4>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300">
              {statusData?.activeFileSize || '0 KB'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mt-2.5">
            <span>Total Arsip Berkas:</span>
            <span className="font-bold text-stone-800 dark:text-stone-200">{statusData?.totalFiles || 0} hari</span>
          </div>
        </div>

        {/* Action Quick Bar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#181413] border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Aksi Cepat Admin</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              {user?.role || 'ADMIN'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="admin-test-log-btn"
              onClick={() => setShowTestModal(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Play className="w-3 h-3" />
              Uji Coba Log
            </button>
            <button
              type="button"
              id="admin-prune-log-btn"
              onClick={handlePruneLogs}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3 h-3 text-stone-500" />
              Pangkas &gt;30h
            </button>
          </div>
        </div>
      </div>

      {/* Today's Activity Metrics Chips */}
      {statusData?.todayStats && (
        <div className="p-4 rounded-2xl bg-stone-100/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-stone-500" />
            Statistik Hari Ini:
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 font-medium text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700">
            Total Catatan: <strong className="text-orange-600">{statusData.todayStats.total}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 font-medium text-blue-700 dark:text-blue-300 border border-stone-200 dark:border-stone-700">
            Login: <strong>{statusData.todayStats.byCategory?.AUTH || 0}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 font-medium text-amber-700 dark:text-amber-300 border border-stone-200 dark:border-stone-700">
            Pesanan: <strong>{statusData.todayStats.byCategory?.ORDER || 0}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 font-medium text-purple-700 dark:text-purple-300 border border-stone-200 dark:border-stone-700">
            Mutasi Data: <strong>{statusData.todayStats.byCategory?.DATA_MUTATION || 0}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 font-medium text-emerald-700 dark:text-emerald-300 border border-stone-200 dark:border-stone-700">
            Database: <strong>{statusData.todayStats.byCategory?.DATABASE || 0}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 font-medium text-red-700 dark:text-red-300 border border-stone-200 dark:border-stone-700">
            Redis: <strong>{statusData.todayStats.byCategory?.REDIS || 0}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 font-medium text-rose-700 dark:text-rose-300 border border-stone-200 dark:border-stone-700">
            Galat/Error: <strong>{statusData.todayStats.byCategory?.ERROR || 0}</strong>
          </span>
        </div>
      )}

      {/* Filter and Control Panel */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#181413] border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* File Selector */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <label htmlFor={fileSelectId} className="text-xs font-bold text-stone-600 dark:text-stone-300 shrink-0 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-orange-500" />
              Berkas Tanggal:
            </label>
            <select
              id={fileSelectId}
              value={selectedFile}
              onChange={(e) => {
                setSelectedFile(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-mono font-medium bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
            >
              {logFiles.map((file) => (
                <option key={file.fileName} value={file.fileName}>
                  {file.isToday ? `[HARI INI] ${file.fileName}` : file.fileName} ({file.formattedSize})
                </option>
              ))}
            </select>

            {/* Download File Button */}
            {selectedFile && (
              <a
                id="download-log-file-link"
                href={`/api/admin/system-logs/download?file=${encodeURIComponent(selectedFile)}`}
                download={selectedFile}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 flex items-center gap-1.5 transition-colors shrink-0"
                title="Unduh Berkas Log Mentah (.log)"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh .log
              </a>
            )}
          </div>

          {/* Refresh Controls */}
          <div className="flex items-center gap-2 self-end lg:self-center">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-3.5 h-3.5 rounded-sm accent-orange-600 cursor-pointer"
              />
              <span className="text-stone-700 dark:text-stone-300">Live Auto-Refresh (5s)</span>
              {autoRefresh && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
            </label>

            <button
              type="button"
              id="refresh-logs-btn"
              onClick={() => {
                fetchLogs(true);
                fetchStatusAndFiles();
              }}
              disabled={isRefreshing || isLoading}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-orange-600' : ''}`} />
              Segarkan
            </button>
          </div>
        </div>

        {/* Second Row: Filters and Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 border-t border-stone-200 dark:border-stone-800">
          {/* Category Filter */}
          <div className="lg:col-span-3">
            <label htmlFor={categorySelectId} className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              Kategori Log
            </label>
            <select
              id={categorySelectId}
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="AUTH">Autentikasi & Sesi (AUTH)</option>
              <option value="ORDER">Pesanan Kasir (ORDER)</option>
              <option value="DATA_MUTATION">Modifikasi Data (DATA_MUTATION)</option>
              <option value="DATABASE">Koneksi Database (DATABASE)</option>
              <option value="REDIS">Koneksi Redis (REDIS)</option>
              <option value="ERROR">Galat / Error (ERROR)</option>
              <option value="SYSTEM">Sistem Umum (SYSTEM)</option>
            </select>
          </div>

          {/* Level Filter */}
          <div className="lg:col-span-2">
            <label htmlFor={levelSelectId} className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              Level Keparahan
            </label>
            <select
              id={levelSelectId}
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">Semua Level</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>

          {/* Text Search */}
          <div className="sm:col-span-2 lg:col-span-7">
            <label htmlFor="log-search-input" className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              Pencarian Teks / IP / Aktor
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="log-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari pesan, kata kunci, nama kasir, IP address, atau ID pesanan..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table Area */}
      <div className="bg-white dark:bg-[#181413] rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs overflow-hidden">
        {/* Table Header / Subtitle */}
        <div className="px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-stone-500" />
            <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
              Daftar Entri Log ({totalEntries} baris ditemukan)
            </span>
          </div>
          <span className="text-xs text-stone-500">
            Halaman {page} dari {totalPages}
          </span>
        </div>

        {/* Content View */}
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-stone-500">
            <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
            <p className="text-sm font-medium">Membaca berkas log harian dari server...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center gap-3 text-stone-500">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-850 flex items-center justify-center text-stone-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h5 className="font-bold text-stone-800 dark:text-stone-200 text-sm">Tidak ada data log yang cocok</h5>
              <p className="text-xs text-stone-500 mt-1 max-w-sm">
                Tidak ditemukan catatan log untuk berkas atau kriteria pencarian yang Anda tentukan. Coba ubah filter atau picu uji coba log.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-stone-200 dark:divide-stone-800">
            {logs.map((entry) => {
              const isExpanded = expandedLogId === entry.id;
              const formattedTime = new Date(entry.timestamp).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });

              return (
                <div
                  key={entry.id}
                  className={`transition-colors ${isExpanded ? 'bg-orange-50/20 dark:bg-stone-900/60' : 'hover:bg-stone-50 dark:hover:bg-stone-900/30'}`}
                >
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : entry.id)}
                    className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    {/* Left: Time, Level, Category, Message */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="text-right shrink-0 pt-0.5 md:pt-0">
                        <span className="font-mono text-xs font-bold text-stone-800 dark:text-stone-200 block">
                          {formattedTime}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {entry.timestamp.split('T')[0]}
                        </span>
                      </div>

                      <div className="shrink-0 pt-0.5 md:pt-0">
                        {renderLevelBadge(entry.level)}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {renderCategoryBadge(entry.category)}
                          {entry.vendorId && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                              {entry.vendorId}
                            </span>
                          )}
                          {entry.ipAddress && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-stone-500 bg-stone-50 dark:bg-stone-850">
                              IP: {entry.ipAddress}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-medium text-stone-900 dark:text-stone-100 break-words leading-relaxed">
                          {entry.message}
                        </p>
                      </div>
                    </div>

                    {/* Right: Actor & Expand Toggle */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      {entry.actor?.name && (
                        <div className="text-right hidden sm:block">
                          <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">
                            {entry.actor.name}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            {entry.actor.role || 'USER'}
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        aria-label="Rincian Log"
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded JSON details payload */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-stone-50/80 dark:bg-black/30 border-t border-stone-200/60 dark:border-stone-800/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5" /> Payload JSON Rinci
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyJson(entry)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 flex items-center gap-1 hover:bg-stone-100 transition-colors cursor-pointer"
                        >
                          {copiedId === entry.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" /> Tersalin!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Salin JSON
                            </>
                          )}
                        </button>
                      </div>

                      <pre className="p-3.5 rounded-xl bg-stone-900 text-stone-100 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed select-all">
                        {JSON.stringify(entry, null, 2)}
                      </pre>

                      {entry.stackTrace && (
                        <div className="mt-3">
                          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block mb-1">
                            Stack Trace Galat:
                          </span>
                          <pre className="p-3 rounded-xl bg-rose-950/40 text-rose-200 text-xs font-mono overflow-x-auto max-h-48 border border-rose-900/50">
                            {entry.stackTrace}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/30 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500">Tampilkan per halaman:</span>
              <select
                aria-label="Tampilkan per halaman"
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10));
                  setPage(1);
                }}
                className="px-2 py-1 rounded-lg text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 inline mr-1" />
                Sebelumnya
              </button>
              <span className="px-3 py-1 text-xs font-bold text-stone-700 dark:text-stone-300">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 disabled:opacity-40 cursor-pointer"
              >
                Berikutnya
                <ChevronRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Uji Coba Log Manual */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#181413] border border-stone-200 dark:border-stone-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-purple-600" />
                <h4 className="font-bold text-base text-stone-900 dark:text-stone-100">Uji Coba Tulis Log</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-500">
              Uji coba ini akan seketika mencatat entri log terstruktur baru ke berkas harian (
              <code>{statusData?.activeLogFile}</code>) sesuai kategori yang dipilih.
            </p>

            <form onSubmit={handleTriggerTest} className="space-y-3">
              <div>
                <label htmlFor={testCategorySelectId} className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Pilih Kategori:
                </label>
                <select
                  id={testCategorySelectId}
                  value={testCategory}
                  onChange={(e) => setTestCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                >
                  <option value="DATABASE">DATABASE (Uji Koneksi MongoDB)</option>
                  <option value="REDIS">REDIS (Uji Token Bucket & Cache)</option>
                  <option value="AUTH">AUTH (Simulasi Login Admin)</option>
                  <option value="ORDER">ORDER (Simulasi Transaksi Pesanan)</option>
                  <option value="DATA_MUTATION">DATA_MUTATION (Simulasi Update Produk)</option>
                  <option value="ERROR">ERROR (Simulasi Galat/Exception)</option>
                  <option value="SYSTEM">SYSTEM (Simulasi Catatan Sistem)</option>
                </select>
              </div>

              <div>
                <label htmlFor={testLevelSelectId} className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Tingkat Keparahan (Level):
                </label>
                <select
                  id={testLevelSelectId}
                  value={testLevel}
                  onChange={(e) => setTestLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                >
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                  <option value="DEBUG">DEBUG</option>
                </select>
              </div>

              <div>
                <label htmlFor="test-log-message-input" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Pesan Kustom (Opsional):
                </label>
                <input
                  id="test-log-message-input"
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Biarkan kosong untuk menggunakan template otomatis..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTest}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingTest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menulis...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Tulis Log Sekarang
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
