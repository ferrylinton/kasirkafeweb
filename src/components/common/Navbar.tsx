import React from 'react';
import { Coffee, ArrowRight, Menu, PanelLeft, Globe } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCart } from '../../contexts/CartContext';

interface NavbarProps {
  currentTab: string;
  onNavigateTab: (tab: string) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onNavigateTab,
  isSidebarOpen,
  onToggleSidebar
}) => {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { totalItemsCount, subtotal } = useCart();
  const isCashierOrManager = user?.role === 'CASHIER' || user?.role === 'MANAGER';
  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  const toggleLanguage = () => {
    setLanguage(language === 'id' ? 'en' : 'id');
  };

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'katalog':
        return t('navCatalog');
      case 'pesanan':
        return t('navOrders');
      case 'histori':
        return t('navHistory');
      case 'inventaris':
        return t('navInventory');
      case 'users':
        return t('navUsers');
      case 'diskon':
        return t('navDiscounts');
      case 'templates':
        return t('navTemplates');
      case 'login-history':
        return t('navLoginHistory');
      case 'activity-logs':
        return t('navActivityLogs');
      case 'vendor-client':
        return 'Vendor & Klien ID (M2M)';
      case 'manager-dashboard':
        return 'Dashboard Transaksi Cabang';
      case 'vendor-management':
        return 'Manajemen Vendor (Admin)';
      case 'admin-dashboard':
        return t('navAdminDashboard') || 'Dashboard Grafik Transaksi';
      case 'admin-top-products':
        return t('navAdminTopProducts') || 'Top 10 Produk Terlaris';
      case 'admin-orders':
      case 'admin-riwayat':
        return t('navAdminOrders');
      case 'admin-inventory':
      case 'admin-inventaris':
        return t('navAdminInventory');
      case 'admin-users':
        return t('navAdminUsers');
      case 'admin-discounts':
      case 'admin-diskon':
        return t('navAdminDiscounts');
      case 'admin-templates':
        return t('navAdminTemplates');
      case 'admin-login-history':
        return t('navAdminLoginHistory');
      case 'admin-activity-logs':
        return t('navAdminActivityLogs');
      case 'profile':
        return t('navAccount');
      case 'settings':
        return t('navSettings');
      default:
        return 'SipSpot POS';
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 bg-[#fff8f6]/90 dark:bg-[#1f1917]/90 backdrop-blur-xl border-b border-stone-200/60 dark:border-stone-800/60 flex flex-col justify-end transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'lg:left-64' : 'lg:left-0'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        height: 'calc(4rem + env(safe-area-inset-top, 0px))'
      }}
    >
      <div className="h-16 w-full flex items-center justify-between gap-3">
        {/* Left: Sidebar Toggle Button + Title */}
      <div className="flex items-center gap-3 min-w-0 shrink">
        {/* Toggle Sidebar Button */}
        <button
          type="button"
          id="toggle-sidebar-btn"
          onClick={onToggleSidebar}
          className="w-10 h-10 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 text-stone-700 dark:text-stone-200 hover:text-accent hover:border-accent/40 flex items-center justify-center transition-all shrink-0 shadow-2xs active:scale-95 cursor-pointer"
          title={isSidebarOpen ? t('closeSidebar') : t('toggleSidebar')}
          aria-label={isSidebarOpen ? t('closeSidebar') : t('toggleSidebar')}
        >
          {isSidebarOpen ? (
            <PanelLeft className="w-5 h-5 text-accent" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        {/* Brand/Tab Title and Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          {!isSidebarOpen && (
            <div className="w-9 h-9 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent items-center justify-center shrink-0 shadow-xs hidden lg:flex">
              <Coffee className="w-5 h-5" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 font-heading truncate">
                <span className="lg:hidden">{getTabTitle(currentTab)}</span>
                <span className="hidden lg:inline">{getTabTitle(currentTab)}</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </div>
            <span className="text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 truncate hidden xs:inline sm:inline">
              {isAdmin
                ? 'Administrasi Sistem Lintas Vendor'
                : isManager
                ? `${t('roleManager')} • Operasional & Manajemen Toko`
                : `${t('shiftPagi')} • ${t('roleCashier')} • Operasional Kasir`} • Senopati
            </span>
          </div>
        </div>
      </div>

      {/* Right Side: Quick Language Switcher & Cart Summary */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {/* Quick Language Toggle */}
        <button
          type="button"
          id="navbar-language-toggle-btn"
          onClick={toggleLanguage}
          className="h-9 px-2.5 sm:px-3 rounded-xl bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-accent/40 hover:text-accent flex items-center gap-1.5 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
          title={`Switch language / Ganti bahasa (Current: ${language.toUpperCase()})`}
          aria-label="Language selector"
        >
          <Globe className="w-3.5 h-3.5 text-accent" />
          <span className="uppercase tracking-wider font-extrabold">{language}</span>
          <span className="text-[10px] text-stone-400 hidden sm:inline">({language === 'id' ? 'ID' : 'EN'})</span>
        </button>

        {/* Cart Summary Bar - Hanya tampil untuk role yang punya akses Operasional Kasir (CASHIER & MANAGER) */}
        {isCashierOrManager && totalItemsCount > 0 && currentTab !== 'pembayaran' && (
          <button
            type="button"
            id="navbar-cart-summary-btn"
            onClick={() => onNavigateTab('pesanan')}
            className={`rounded-2xl transition-all shadow-2xs active:scale-95 flex items-center gap-2 sm:gap-3 px-2.5 py-1.5 sm:px-3.5 sm:py-2 border cursor-pointer ${
              currentTab === 'pesanan'
                ? 'bg-orange-50/80 dark:bg-orange-950/40 border-accent ring-2 ring-accent/25'
                : 'bg-[#fff8f6] dark:bg-[#1f1917] border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 hover:bg-stone-50/80 dark:hover:bg-stone-900/60'
            }`}
            title={t('viewOrder')}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-accent text-white flex items-center justify-center font-extrabold text-xs sm:text-sm shrink-0 shadow-xs">
              {totalItemsCount}
            </div>
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[10px] text-stone-500 dark:text-stone-400 hidden sm:inline">
                {t('selectedItems')}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                Rp {subtotal.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold pl-1.5 sm:pl-2.5 sm:border-l sm:border-stone-200 dark:sm:border-stone-800 text-accent">
              <span className="hidden md:inline">{t('viewOrder')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        )}
      </div>
      </div>
    </header>
  );
};
