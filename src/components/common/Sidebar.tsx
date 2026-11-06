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
  ShieldCheck,
  ClipboardList,
  Building2,
  BarChart3,
  TrendingUp,
  Trophy,
  UserX,
  X,
  Layers,
  PackagePlus,
  FlaskConical,
  ChevronRight
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
  const isCashierOrManager = user?.role === 'CASHIER' || user?.role === 'MANAGER';
  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';
  const isCashier = user?.role === 'CASHIER';

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [alertCount, setAlertCount] = useState<number>(0);

  // Accordion Submenu (Toggle Expanded/Collapsed) for Pembelian Bahan Baku
  const [isSubmenuOpen, setIsSubmenuOpen] = useState<boolean>(() => {
    return currentTab.startsWith('pembelian-bahan') || currentTab === 'bahan-baku' || currentTab === 'resep-minuman';
  });

  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const activeSubTab = searchParams.get('tab') || 'pembelian-baru';

  useEffect(() => {
    if (currentTab.startsWith('pembelian-bahan') || currentTab === 'bahan-baku' || currentTab === 'resep-minuman') {
      setIsSubmenuOpen(true);
    }
  }, [currentTab]);

  const handleToggleSubmenu = () => {
    setIsSubmenuOpen(prev => !prev);
  };

  const handleSubmenuItemClick = (subTabKey: string) => {
    handleNavClick(`pembelian-bahan?tab=${subTabKey}`);
  };

  const cashierTabs = ['katalog', 'pesanan', 'pembayaran', 'histori'];
  const managerTabs = ['manager-dashboard', 'manager-top-products', 'top-products', 'produk-manajemen', 'stok-produk', 'inventaris', 'kategori', 'pembelian-bahan', 'bahan-baku', 'resep-minuman', 'users', 'diskon', 'templates', 'login-history', 'activity-logs', 'vendor-client'];
  const adminTabs = ['admin-dashboard', 'admin-top-products', 'vendor-management', 'log-viewer', 'admin-orders', 'admin-riwayat', 'admin-products', 'admin-stock', 'admin-inventory', 'admin-inventaris', 'admin-users', 'admin-discounts', 'admin-diskon', 'admin-templates', 'admin-login-history', 'admin-activity-logs', 'admin-locked-users', 'admin-housekeeping'];
  const accountTabs = ['profile', 'settings'];

  const handleNavClick = (tab: string) => {
    const baseTab = tab.split('?')[0];
    // Role protection guard
    if (isAdmin && !adminTabs.includes(baseTab) && !accountTabs.includes(baseTab)) return;
    if (isManager && !cashierTabs.includes(baseTab) && !managerTabs.includes(baseTab) && !accountTabs.includes(baseTab)) return;
    if (isCashier && !cashierTabs.includes(baseTab) && !accountTabs.includes(baseTab)) return;

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
      } catch (e) { }
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
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#fff8f6] dark:bg-[#1f1917] border-r border-stone-200/60 dark:border-stone-800/60 flex flex-col justify-between transition-transform duration-300 ease-in-out select-none shadow-2xl lg:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)'
        }}
      >
        {/* Top: User Info & Close Sidebar Button (Satu Baris) */}
        <div className="p-3.5 border-b border-stone-200/60 dark:border-stone-800/60">
          <div className="flex items-center gap-2">
            {/* Logged in User Profile Card */}
            <div
              onClick={() => handleNavClick('profile')}
              className={`flex-1 min-w-0 p-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-2 ${
                currentTab === 'profile'
                  ? 'bg-orange-50/80 dark:bg-orange-950/40 ring-1 ring-accent/30'
                  : 'bg-stone-50/80 dark:bg-stone-900/60 hover:bg-stone-100/80 dark:hover:bg-stone-850'
              }`}
              title="Klik untuk membuka Profil Akun"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-800 shrink-0 border border-stone-300 dark:border-stone-700">
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
                    {isAdmin
                      ? 'Admin'
                      : isManager
                        ? 'Manager'
                        : 'Kasir'}
                  </div>
                </div>
              </div>
            </div>

            {/* Close Sidebar Button */}
            <button
              type="button"
              id="close-sidebar-btn"
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-stone-100/90 dark:bg-stone-800/90 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
              title={t('closeSidebar')}
              aria-label={t('closeSidebar')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Middle: Navigation Links */}
        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {/* Group 1: Kasir Operasional (Hanya role CASHIER dan role MANAGER) */}
          {isCashierOrManager && (
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Operasional Kasir
              </div>
              <div className="space-y-1">
                {/* Katalog */}
                <button
                  type="button"
                  onClick={() => handleNavClick('katalog')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'katalog'
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'pesanan'
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
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${currentTab === 'pesanan'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'bg-accent text-white shadow-2xs'
                        }`}
                    >
                      {totalItemsCount}
                    </span>
                  )}
                </button>

                {/* Riwayat Pesanan */}
                <button
                  type="button"
                  onClick={() => handleNavClick('histori')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'histori'
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
          )}

          {/* Group 2: Manajemen Toko (Only for Manager) */}
          {isManager && (
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Manajemen Toko</span>
              </div>
              <div className="space-y-1">
                {/* Dashboard Transaksi Vendor (Role Manager) */}
                <button
                  type="button"
                  id="nav-manager-dashboard"
                  onClick={() => handleNavClick('manager-dashboard')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'manager-dashboard'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span className="truncate">Dashboard Transaksi</span>
                  </div>
                </button>

                {/* Top 10 Produk Terlaris (Khusus Vendor Manager) */}
                <button
                  type="button"
                  id="nav-manager-top-products"
                  onClick={() => handleNavClick('manager-top-products')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'manager-top-products' || currentTab === 'top-products'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Trophy className="w-4 h-4 shrink-0 text-amber-500" />
                    <span className="truncate">Top 10 Produk</span>
                  </div>
                </button>

                {/* Manajemen Produk (Role Manager) */}
                <button
                  type="button"
                  id="nav-product-management-btn"
                  onClick={() => handleNavClick('produk-manajemen')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'produk-manajemen'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Coffee className="w-4 h-4 shrink-0 text-amber-500" />
                    <span className="truncate">Manajemen Produk</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950 text-accent">
                    Menu
                  </span>
                </button>

                {/* Stok Produk (Role Manager) */}
                <button
                  type="button"
                  id="nav-stock-products-btn"
                  onClick={() => handleNavClick('stok-produk')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'stok-produk' || currentTab === 'inventaris'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Boxes className="w-4 h-4 shrink-0 text-orange-500" />
                    <span className="truncate">Stok Produk</span>
                  </div>
                  {alertCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white flex items-center gap-1 shrink-0 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{alertCount}</span>
                    </span>
                  )}
                </button>

                {/* Kategori */}
                <button
                  type="button"
                  id="nav-kategori-btn"
                  onClick={() => handleNavClick('kategori')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'kategori'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Layers className="w-4 h-4 shrink-0" />
                    <span className="truncate">Kategori</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300">
                    Menu
                  </span>
                </button>

                {/* Pembelian Bahan Baku & Resep Minuman (Khusus Role MANAGER) - Accordion Sub-Menu (Toggle Expanded/Collapsed) */}
                <div className="space-y-1">
                  <button
                    type="button"
                    id="nav-pembelian-bahan-btn"
                    aria-expanded={isSubmenuOpen}
                    onClick={handleToggleSubmenu}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                      currentTab.startsWith('pembelian-bahan') || currentTab === 'bahan-baku' || currentTab === 'resep-minuman'
                        ? 'bg-accent text-white shadow-xs font-bold'
                        : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PackagePlus className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span className="truncate">Pembelian Bahan Baku</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        Racikan
                      </span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isSubmenuOpen ? 'rotate-90' : ''
                        } ${
                          currentTab.startsWith('pembelian-bahan') || currentTab === 'bahan-baku' || currentTab === 'resep-minuman'
                            ? 'text-white'
                            : 'opacity-60'
                        }`}
                      />
                    </div>
                  </button>

                  {/* Submenu Inline (Expanded / Collapsed) */}
                  {isSubmenuOpen && (
                    <div
                      id="submenu-pembelian-bahan-accordion"
                      className="ml-3 pl-3 border-l-2 border-stone-200 dark:border-stone-800 space-y-1 pt-1 pb-1 transition-all duration-200"
                    >
                      {/* 1. Faktur Pembelian Baru */}
                      <button
                        type="button"
                        id="subnav-pembelian-baru"
                        onClick={() => handleSubmenuItemClick('pembelian-baru')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                          currentTab.startsWith('pembelian-bahan') && activeSubTab === 'pembelian-baru'
                            ? 'bg-orange-100/90 dark:bg-orange-950/80 text-accent font-bold ring-1 ring-accent/30'
                            : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                      >
                        <PackagePlus className="w-4 h-4 shrink-0 text-orange-500" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">Faktur Pembelian Baru</div>
                        </div>
                      </button>

                      {/* 2. Riwayat Pembelian */}
                      <button
                        type="button"
                        id="subnav-riwayat-pembelian"
                        onClick={() => handleSubmenuItemClick('riwayat-pembelian')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                          currentTab.startsWith('pembelian-bahan') && activeSubTab === 'riwayat-pembelian'
                            ? 'bg-blue-100/90 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold ring-1 ring-blue-500/30'
                            : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                      >
                        <Receipt className="w-4 h-4 shrink-0 text-blue-500" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">Riwayat Pembelian</div>
                        </div>
                      </button>

                      {/* 3. Master Stok Bahan Baku */}
                      <button
                        type="button"
                        id="subnav-stok-bahan"
                        onClick={() => handleSubmenuItemClick('stok-bahan')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                          currentTab.startsWith('pembelian-bahan') && activeSubTab === 'stok-bahan'
                            ? 'bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-bold ring-1 ring-emerald-500/30'
                            : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                      >
                        <Boxes className="w-4 h-4 shrink-0 text-emerald-500" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">Master Stok Bahan Baku</div>
                        </div>
                      </button>

                      {/* 4. Resep Racikan Minuman (BOM) */}
                      <button
                        type="button"
                        id="subnav-resep-minuman"
                        onClick={() => handleSubmenuItemClick('resep-minuman')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                          currentTab.startsWith('pembelian-bahan') && activeSubTab === 'resep-minuman'
                            ? 'bg-purple-100/90 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 font-bold ring-1 ring-purple-500/30'
                            : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                      >
                        <FlaskConical className="w-4 h-4 shrink-0 text-purple-500" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">Resep Racikan Minuman</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Manajemen User */}
                <button
                  type="button"
                  onClick={() => handleNavClick('users')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'users'
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'diskon'
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'templates'
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'login-history'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">Login Histori</span>
                  </div>
                </button>

                {/* Log Aktivitas Database (Khusus Manajer) */}
                <button
                  type="button"
                  id="nav-activity-logs-btn"
                  onClick={() => handleNavClick('activity-logs')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'activity-logs'
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

                {/* Informasi Vendor (Khusus Manajer) */}
                <button
                  type="button"
                  id="nav-vendor-client-btn"
                  onClick={() => handleNavClick('vendor-client')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'vendor-client'
                      ? 'bg-accent text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">Informasi Vendor</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300">
                    Cabang
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Group 3: Administrasi Sistem (Role ADMIN) */}
          {(isAdmin) && (
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                  <span>Administrasi Sistem</span>
                </div>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  ALL VENDOR
                </span>
              </div>
              <div className="space-y-1">
                {/* 0. Dashboard Grafik Transaksi Semua Vendor */}
                <button
                  type="button"
                  id="nav-admin-dashboard-btn"
                  onClick={() => handleNavClick('admin-dashboard')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-dashboard'
                      ? 'bg-purple-600 text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <BarChart3 className="w-4 h-4 shrink-0 text-purple-500" />
                    <span className="truncate">{t('navAdminDashboard') || 'Dashboard Grafik Transaksi Semua Vendor'}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    GRAFIK
                  </span>
                </button>

                {/* 0.5. Top 10 Produk Terlaris (Hari, Minggu, Bulan) */}
                <button
                  type="button"
                  id="nav-admin-top-products-btn"
                  onClick={() => handleNavClick('admin-top-products')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-top-products'
                      ? 'bg-purple-600 text-white shadow-xs font-bold'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Trophy className="w-4 h-4 shrink-0 text-amber-500" />
                    <span className="truncate">{t('navAdminTopProducts') || 'Top 10 Produk Terlaris (Hari, Minggu, Bulan)'}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    TOP 10
                  </span>
                </button>

                {/* Khusus ADMIN: Akses Fitur Manajemen Sistem Semua Vendor Lainnya */}
                {isAdmin && (
                  <>
                    {/* 1. Riwayat Pesanan Semua Vendor */}
                    <button
                      type="button"
                      id="nav-admin-orders-btn"
                      onClick={() => handleNavClick('admin-orders')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-orders'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Receipt className="w-4 h-4 shrink-0 text-purple-500" />
                        <span className="truncate">{t('navAdminOrders')}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        SEMUA
                      </span>
                    </button>

                    {/* 2. Katalog Produk Semua Vendor */}
                    <button
                      type="button"
                      id="nav-admin-products-btn"
                      onClick={() => handleNavClick('admin-products')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-products'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Coffee className="w-4 h-4 shrink-0 text-purple-500" />
                        <span className="truncate">Katalog Produk Semua Vendor</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        SEMUA
                      </span>
                    </button>

                    {/* 3. Stok Produk Semua Vendor */}
                    <button
                      type="button"
                      id="nav-admin-stock-btn"
                      onClick={() => handleNavClick('admin-stock')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-stock' || currentTab === 'admin-inventory' || currentTab === 'admin-inventaris'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Boxes className="w-4 h-4 shrink-0 text-purple-500" />
                        <span className="truncate">Stok Produk Semua Vendor</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        SEMUA
                      </span>
                    </button>

                    {/* 3. Manajemen User Semua Vendor */}
                    <button
                      type="button"
                      id="nav-admin-users-btn"
                      onClick={() => handleNavClick('admin-users')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-users'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Users className="w-4 h-4 shrink-0 text-purple-500" />
                        <span className="truncate">{t('navAdminUsers')}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        SEMUA
                      </span>
                    </button>

                    {/* 4. Aturan Diskon Semua Vendor */}
                    <button
                      type="button"
                      id="nav-admin-discounts-btn"
                      onClick={() => handleNavClick('admin-discounts')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-discounts'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Tag className="w-4 h-4 shrink-0 text-purple-500" />
                        <span className="truncate">{t('navAdminDiscounts')}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        SEMUA
                      </span>
                    </button>

                    {/* 5. Template Email Semua Vendor */}
                    <button
                      type="button"
                      id="nav-admin-templates-btn"
                      onClick={() => handleNavClick('admin-templates')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-templates'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Mail className="w-4 h-4 shrink-0 text-purple-500" />
                        <span className="truncate">{t('navAdminTemplates')}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        SEMUA
                      </span>
                    </button>

                    {/* 6. Login History Semua Vendor */}
                    <button
                      type="button"
                      id="nav-admin-login-history-btn"
                      onClick={() => handleNavClick('admin-login-history')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-login-history'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ShieldCheck className="w-4 h-4 shrink-0 text-purple-500" />
                        <span className="truncate">{t('navAdminLoginHistory')}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        SEMUA
                      </span>
                    </button>

                    {/* 7. Log Aktivitas DB Semua Vendor */}
                    <button
                      type="button"
                      id="nav-admin-activity-logs-btn"
                      onClick={() => handleNavClick('admin-activity-logs')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-activity-logs'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ClipboardList className="w-4 h-4 shrink-0 text-purple-500" />
                        <span className="truncate">{t('navAdminActivityLogs')}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        SEMUA
                      </span>
                    </button>

                    {/* 8. Manajemen Vendor */}
                    <button
                      type="button"
                      id="nav-vendor-management-btn"
                      onClick={() => handleNavClick('vendor-management')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'vendor-management'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Building2 className="w-4 h-4 shrink-0 text-purple-500" />
                        <span className="truncate">{t('navAdminVendors')}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        ADMIN
                      </span>
                    </button>

                    {/* 8. Log Viewer */}
                    <button
                      type="button"
                      id="nav-log-viewer-btn"
                      onClick={() => handleNavClick('log-viewer')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'log-viewer'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Building2 className="w-4 h-4 shrink-0 text-purple-500" />
                        <span className="truncate">{t('navLogViewer')}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        ADMIN
                      </span>
                    </button>

                    {/* 9. User Terkunci (Redis Lockout) */}
                    <button
                      type="button"
                      id="nav-admin-locked-users-btn"
                      onClick={() => handleNavClick('admin-locked-users')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-locked-users'
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserX className="w-4 h-4 shrink-0 text-red-500" />
                        <span className="truncate">User Terkunci (Redis)</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                        REDIS
                      </span>
                    </button>

                    {/* 10. Housekeeping Data & Retensi */}
                    <button
                      type="button"
                      id="nav-admin-housekeeping-btn"
                      onClick={() => handleNavClick('admin-housekeeping')}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${currentTab === 'admin-housekeeping'
                          ? 'bg-orange-600 text-white shadow-xs font-bold'
                          : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-850 hover:text-stone-900 dark:hover:text-stone-100'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Sparkles className="w-4 h-4 shrink-0 text-orange-500" />
                        <span className="truncate">Housekeeping Data</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                        ADMIN
                      </span>
                    </button>

                  </>
                )}
              </div>
            </div>
          )}

          {/* Group 4: Pengaturan & Profil */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Sistem & Akun
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleNavClick('settings')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'settings'
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
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${currentTab === 'profile'
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

        {/* Bottom: Logout */}
        <div className="p-4 border-t border-stone-200/60 dark:border-stone-800/60 bg-[#fffaf8] dark:bg-[#1c1715]">
          <button
            type="button"
            id="sidebar-logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-xs font-bold transition-colors shadow-2xs cursor-pointer active:scale-98"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout')}</span>
          </button>
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

