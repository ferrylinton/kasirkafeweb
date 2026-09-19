import React, { useState, useEffect } from 'react';
import {
  Coffee,
  Store,
  ShoppingBag,
  Receipt,
  Boxes,
  Users,
  Tag,
  Mail,
  UserCheck,
  LogOut,
  AlertTriangle,
  Sparkles,
  Settings,
  PanelLeftClose,
  ShieldCheck,
  ClipboardList,
  X
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmationModal } from './ConfirmationModal';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, isOpen, onClose }) => {
  const { t } = useLanguage();
  const { totalItemsCount } = useCart();
  const { user, token, logout } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [alertCount, setAlertCount] = useState<number>(0);

  const handleNavClick = (tab: string) => {
    onSelectTab(tab);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose();
    }
  };

  // Check inventory alerts if manager
  useEffect(() => {
    if (!isManager) return;

    const checkAlerts = async () => {
      try {
        const res = await fetch('/api/products/inventory/alerts', {
          headers: { Authorization: `Bearer ${token || ''}` }
        });
        const data = await res.json();
        if (data.success && data.summary) {
          const totalAlerts = (data.summary.lowStockCount || 0) + (data.summary.outOfStockCount || 0);
          setAlertCount(totalAlerts);
        }
      } catch (e) {}
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 30000);
    return () => clearInterval(interval);
  }, [isManager, token, currentTab]);

  return (
    <>
      {/* Mobile/Tablet Backdrop Overlay */}
      {isOpen && (
        <div
          id="sidebar-backdrop"
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside
        id="desktop-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#fff8f6] dark:bg-[#1f1917] border-r border-stone-200/60 dark:border-stone-800/60 flex flex-col justify-between transition-transform duration-300 ease-in-out select-none shadow-2xl lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)'
        }}
      >
        {/* Top: Brand, Close Button & User Info */}
        <div className="p-5 pb-3 border-b border-stone-200/60 dark:border-stone-800/60">
          {/* Brand Logo, Name & Close Button */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0 shadow-xs">
                <Coffee className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg text-stone-900 dark:text-stone-100 font-heading tracking-tight">
                    SipSpot
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-bold">
                    POS
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate">Senopati • Online</span>
                </div>
              </div>
            </div>

            {/* Close Sidebar Button */}
            <button
              type="button"
              id="close-sidebar-btn"
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center transition-colors shrink-0 active:scale-95"
              title={t('closeSidebar')}
              aria-label={t('closeSidebar')}
            >
              <PanelLeftClose className="w-5 h-5 hidden lg:block" />
              <X className="w-5 h-5 lg:hidden" />
            </button>
          </div>

          {/* Logged in User Profile Card */}
          <div
            onClick={() => handleNavClick('profile')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
              currentTab === 'profile'
                ? 'bg-orange-50/80 dark:bg-orange-950/40 border-accent/40 ring-1 ring-accent/30'
                : 'bg-stone-50/80 dark:bg-stone-900/60 border-stone-200/70 dark:border-stone-800/80 hover:border-accent/40 hover:bg-stone-100/80 dark:hover:bg-stone-850'
            }`}
            title="Klik untuk membuka Profil Akun"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-800 shrink-0 border border-stone-300 dark:border-stone-700">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-accent text-white font-bold text-xs">
                    {user?.name?.[0] || 'U'}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                  {user?.name || 'Kasir'}
                </div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                  {user?.email || 'user@beverage.com'}
                </div>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                isManager
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60'
              }`}
            >
              {isManager ? 'Manager' : 'Kasir'}
            </span>
          </div>
        </div>

        {/* Middle: Navigation Links */}
        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {/* Group 1: Kasir Operasional */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Operasional Kasir
            </div>
            <div className="space-y-1">
              {/* Katalog */}
              <button
                type="button"
                onClick={() => handleNavClick('katalog')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  currentTab === 'katalog'
                    ? 'bg-accent text-white shadow-xs font-bold'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Store className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('navCatalog')}</span>
                </div>
              </button>

              {/* Pesanan / Keranjang */}
              <button
                type="button"
                onClick={() => handleNavClick('pesanan')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  currentTab === 'pesanan'
                    ? 'bg-accent text-white shadow-xs font-bold'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('navOrders')}</span>
                </div>
                {totalItemsCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      currentTab === 'pesanan'
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'bg-accent text-white shadow-2xs'
                    }`}
                  >
                    {totalItemsCount}
                  </span>
                )}
              </button>

              {/* Histori Transaksi */}
              <button
                type="button"
                onClick={() => handleNavClick('histori')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  currentTab === 'histori'
                    ? 'bg-accent text-white shadow-xs font-bold'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Receipt className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('navHistory')}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Group 2: Manajemen Toko (Only for Manager) */}
          {isManager && (
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Manajemen Toko</span>
              </div>
              <div className="space-y-1">
                {/* Inventaris */}
                <button
                  type="button"
                  onClick={() => handleNavClick('inventaris')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    currentTab === 'inventaris'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Boxes className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t('navInventory')}</span>
                  </div>
                  {alertCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white flex items-center gap-1 shrink-0 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{alertCount}</span>
                    </span>
                  )}
                </button>

                {/* Manajemen User */}
                <button
                  type="button"
                  onClick={() => handleNavClick('users')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    currentTab === 'users'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t('navUsers')}</span>
                  </div>
                </button>

                {/* Aturan Diskon */}
                <button
                  type="button"
                  onClick={() => handleNavClick('diskon')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    currentTab === 'diskon'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Tag className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t('navDiscounts')}</span>
                  </div>
                </button>

                {/* Template Email */}
                <button
                  type="button"
                  onClick={() => handleNavClick('templates')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    currentTab === 'templates'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t('navTemplates')}</span>
                  </div>
                </button>

                {/* Login Histori (Khusus Manajer) */}
                <button
                  type="button"
                  id="nav-login-history-btn"
                  onClick={() => handleNavClick('login-history')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    currentTab === 'login-history'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">Login Histori</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    Audit
                  </span>
                </button>

                {/* Log Aktivitas Database (Khusus Manajer) */}
                <button
                  type="button"
                  id="nav-activity-logs-btn"
                  onClick={() => handleNavClick('activity-logs')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    currentTab === 'activity-logs'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t('navActivityLogs')}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    DB Log
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Group 3: Pengaturan & Profil */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Sistem & Akun
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleNavClick('settings')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  currentTab === 'settings'
                    ? 'bg-accent text-white shadow-xs font-bold'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Settings className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('navSettings')}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('profile')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  currentTab === 'profile'
                    ? 'bg-accent text-white shadow-xs font-bold'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('navAccount')}</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: Logout & POS Version Info */}
        <div className="p-4 border-t border-stone-200/60 dark:border-stone-800/60 space-y-3 bg-[#fffaf8] dark:bg-[#1c1715]">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-xs font-bold transition-colors shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout')}</span>
          </button>

          <div className="text-center text-[10px] text-stone-400 dark:text-stone-500 flex items-center justify-center gap-1.5">
            <span>SipSpot POS v2.4</span>
            <span>•</span>
            <span>Enkripsi Aktif</span>
          </div>
        </div>
      </aside>

      {/* Confirmation Modal for Logout */}
      <ConfirmationModal
        isOpen={showLogoutConfirm}
        title={t('confirmLogoutTitle')}
        message={t('confirmLogoutMessage')}
        confirmText={t('logout')}
        confirmVariant="danger"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
};

