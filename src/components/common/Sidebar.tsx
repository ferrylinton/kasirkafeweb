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
import { useLocation } from 'react-router-dom';
import SidebarLink from './SidebarLink';
import { ADMIN, MANAGER, CASHIER, ALL_ROLES } from '../../constants/auth';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, isOpen, onClose }) => {
  const location = useLocation();
  const { t } = useLanguage();
  const { totalItemsCount } = useCart();
  const { user, token, logout } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';
  const isCashier = user?.role === 'CASHIER';

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [rawMaterialAlertCount, setRawMaterialAlertCount] = useState<number>(0);

  // Accordion Submenu (Toggle Expanded/Collapsed) for Pembelian Bahan Baku
  const isPembelianActive =
    currentTab.startsWith('pembelian-bahan') ||
    currentTab === 'pembelian-baru' ||
    currentTab === 'riwayat-pembelian' ||
    currentTab === 'bahan-baku' ||
    currentTab === 'stok-bahan' ||
    currentTab === 'resep-minuman';

  const [isSubmenuOpen, setIsSubmenuOpen] = useState<boolean>(() => isPembelianActive);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose();
    }
  }, [location.pathname]);

  useEffect(() => {
    if (isPembelianActive) {
      setIsSubmenuOpen(true);
    }
  }, [currentTab, isPembelianActive]);

  const handleToggleSubmenu = () => {
    setIsSubmenuOpen(prev => !prev);
  };

  const cashierTabs = ['katalog', 'pesanan', 'pembayaran', 'histori'];
  const managerTabs = [
    'manager-dashboard',
    'manager-top-products',
    'top-products',
    'produk-manajemen',
    'stok-produk',
    'inventaris',
    'kategori',
    'pembelian-bahan',
    'pembelian-baru',
    'riwayat-pembelian',
    'bahan-baku',
    'stok-bahan',
    'resep-minuman',
    'users',
    'diskon',
    'templates',
    'login-history',
    'activity-logs',
    'vendor-client'
  ];
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
          const rawAlerts = (data.summary.rawMaterialLowCount || 0) + (data.summary.rawMaterialOutCount || 0);
          setAlertCount(totalAlerts);
          setRawMaterialAlertCount(rawAlerts);
        }
      } catch (e) { }
    };

    checkAlerts();
    const handleInventoryUpdated = () => checkAlerts();
    window.addEventListener('kasirkafe:inventory-updated', handleInventoryUpdated);
    const interval = setInterval(checkAlerts, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('kasirkafe:inventory-updated', handleInventoryUpdated);
    };
  }, [isManager, token, currentTab]);

  return (
    <>
      {/* Mobile/Tablet Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="sidebar-backdrop"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`sidebar ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-2 p-3.5 border-b border-stone-200/60 dark:border-stone-800/60">
          {/* Logged in User Profile */}
          <div
            onClick={() => handleNavClick('profile')}
            className={`flex-1 min-w-0 p-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-2 ${currentTab === 'profile'
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

        {/* Sidemenu */}
        <div className='sidemenu-container'>
          <div className="sidemenu">

            {/* Group 1: Operasional Kasir */}
            <div className='sidemenu-group'>
              <label>Operasional Kasir</label>

              <SidebarLink to='katalog' allowedRoles={[CASHIER, MANAGER]}>
                <label>
                  <Store />
                  <span>{t('navCatalog')}</span>
                </label>
              </SidebarLink>

              <SidebarLink to='pesanan' allowedRoles={[CASHIER, MANAGER]}>
                <label>
                  <ShoppingBag />
                  <span>{t('navOrders')}</span>
                </label>
                {totalItemsCount > 0 && (
                  <em>
                    {totalItemsCount}
                  </em>
                )}
              </SidebarLink>

              <SidebarLink to='histori' allowedRoles={[CASHIER, MANAGER]}>
                <label>
                  <Receipt />
                  <span>{t('navHistory')}</span>
                </label>
              </SidebarLink>

              <SidebarLink to='manager-dashboard' allowedRoles={[MANAGER]}>
                <label>
                  <TrendingUp />
                  <span>{t('dashboard')}</span>
                </label>
              </SidebarLink>

              <SidebarLink to='manager-top-products' allowedRoles={[MANAGER]}>
                <label>
                  <Trophy />
                  <span>{t('topProducts')}</span>
                </label>
              </SidebarLink>
            </div>

            {/* Group 2: Manajemen Toko */}
            <div className='sidemenu-group'>
              <label>Manajemen Toko</label>

              <SidebarLink to='produk-manajemen' allowedRoles={[MANAGER]}>
                <label>
                  <Coffee />
                  <span>{t('product')}</span>
                </label>
              </SidebarLink>

              <SidebarLink to='stok-produk' allowedRoles={[MANAGER]}>
                <label>
                  <Boxes />
                  <span>{t('stock')}</span>
                </label>
                {alertCount > 0 && (
                  <em>
                    {alertCount}
                  </em>
                )}
              </SidebarLink>

              <SidebarLink to='kategori' allowedRoles={[MANAGER]}>
                <label>
                  <Layers />
                  <span>{t('category')}</span>
                </label>
              </SidebarLink>



              <SidebarLink to='users' allowedRoles={[MANAGER]}>
                <label>
                  <Users />
                  <span>{t('navUsers')}</span>
                </label>
              </SidebarLink>

              <SidebarLink to='diskon' allowedRoles={[MANAGER]}>
                <label>
                  <Tag />
                  <span>{t('navDiscounts')}</span>
                </label>
              </SidebarLink>

              <SidebarLink to='templates' allowedRoles={[MANAGER]}>
                <label>
                  <Mail />
                  <span>{t('navTemplates')}</span>
                </label>
              </SidebarLink>

              <SidebarLink id="nav-login-history-btn" to='login-history' allowedRoles={[MANAGER]}>
                <label>
                  <ShieldCheck />
                  <span>Login Histori</span>
                </label>
              </SidebarLink>

              <SidebarLink id="nav-activity-logs-btn" to='activity-logs' allowedRoles={[MANAGER]}>
                <label>
                  <ClipboardList />
                  <span>{t('navActivityLogs')}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shrink-0">
                  DB Log
                </span>
              </SidebarLink>

              <SidebarLink id="nav-vendor-client-btn" to='vendor-client' allowedRoles={[MANAGER]}>
                <label>
                  <Building2 />
                  <span>Informasi Vendor</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 shrink-0">
                  Cabang
                </span>
              </SidebarLink>
            </div>

            <div className='sidemenu-group'>
              <label>Pembelian</label>

              <SidebarLink id="subnav-pembelian-baru" to='pembelian-bahan' allowedRoles={[MANAGER]}>
                <label>
                  <PackagePlus />
                  <span>Faktur Pembelian Baru</span>
                </label>
              </SidebarLink>

              <SidebarLink id="subnav-riwayat-pembelian" to='riwayat-pembelian' allowedRoles={[MANAGER]}>
                <label>
                  <Receipt />
                  <span>Riwayat Pembelian</span>
                </label>
              </SidebarLink>

              <SidebarLink id="subnav-stok-bahan" to='bahan-baku' allowedRoles={[MANAGER]}>
                <label>
                  <Boxes />
                  <span>Master Stok Bahan Baku</span>
                </label>
                {rawMaterialAlertCount > 0 && (
                  <em>
                    {rawMaterialAlertCount}
                  </em>
                )}
              </SidebarLink>

              <SidebarLink id="subnav-resep-minuman" to='resep-minuman' allowedRoles={[MANAGER]}>
                <label>
                  <FlaskConical />
                  <span>Resep Racikan Minuman</span>
                </label>
              </SidebarLink>
            </div>

            {/* Group 3: Administrasi Sistem (Role ADMIN) */}
            <div className='sidemenu-group'>
              <label className="flex items-center justify-between text-purple-600! dark:text-purple-400!">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                  <span>Administrasi Sistem</span>
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  ALL VENDOR
                </span>
              </label>

              <SidebarLink id="nav-admin-dashboard-btn" to='admin-dashboard' allowedRoles={[ADMIN]}>
                <label>
                  <BarChart3 className="text-purple-500" />
                  <span>{t('navAdminDashboard') || 'Dashboard Grafik Transaksi Semua Vendor'}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  GRAFIK
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-top-products-btn" to='admin-top-products' allowedRoles={[ADMIN]}>
                <label>
                  <Trophy className="text-amber-500" />
                  <span>{t('navAdminTopProducts') || 'Top 10 Produk Terlaris (Hari, Minggu, Bulan)'}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                  TOP 10
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-orders-btn" to='admin-orders' allowedRoles={[ADMIN]}>
                <label>
                  <Receipt className="text-purple-500" />
                  <span>{t('navAdminOrders')}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  SEMUA
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-products-btn" to='admin-products' allowedRoles={[ADMIN]}>
                <label>
                  <Coffee className="text-purple-500" />
                  <span>Katalog Produk Semua Vendor</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  SEMUA
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-stock-btn" to='admin-stock' allowedRoles={[ADMIN]}>
                <label>
                  <Boxes className="text-purple-500" />
                  <span>Stok Produk Semua Vendor</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  SEMUA
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-users-btn" to='admin-users' allowedRoles={[ADMIN]}>
                <label>
                  <Users className="text-purple-500" />
                  <span>{t('navAdminUsers')}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  SEMUA
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-discounts-btn" to='admin-discounts' allowedRoles={[ADMIN]}>
                <label>
                  <Tag className="text-purple-500" />
                  <span>{t('navAdminDiscounts')}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  SEMUA
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-templates-btn" to='admin-templates' allowedRoles={[ADMIN]}>
                <label>
                  <Mail className="text-purple-500" />
                  <span>{t('navAdminTemplates')}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  SEMUA
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-login-history-btn" to='admin-login-history' allowedRoles={[ADMIN]}>
                <label>
                  <ShieldCheck className="text-purple-500" />
                  <span>{t('navAdminLoginHistory')}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  SEMUA
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-activity-logs-btn" to='admin-activity-logs' allowedRoles={[ADMIN]}>
                <label>
                  <ClipboardList className="text-purple-500" />
                  <span>{t('navAdminActivityLogs')}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  SEMUA
                </span>
              </SidebarLink>

              <SidebarLink id="nav-vendor-management-btn" to='vendor-management' allowedRoles={[ADMIN]}>
                <label>
                  <Building2 className="text-purple-500" />
                  <span>{t('navAdminVendors')}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  ADMIN
                </span>
              </SidebarLink>

              <SidebarLink id="nav-log-viewer-btn" to='log-viewer' allowedRoles={[ADMIN]}>
                <label>
                  <Building2 className="text-purple-500" />
                  <span>{t('navLogViewer')}</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  ADMIN
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-locked-users-btn" to='admin-locked-users' allowedRoles={[ADMIN]}>
                <label>
                  <UserX className="text-red-500" />
                  <span>User Terkunci (Redis)</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 shrink-0">
                  REDIS
                </span>
              </SidebarLink>

              <SidebarLink id="nav-admin-housekeeping-btn" to='admin-housekeeping' allowedRoles={[ADMIN]}>
                <label>
                  <Sparkles className="text-orange-500" />
                  <span>Housekeeping Data</span>
                </label>
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 shrink-0">
                  ADMIN
                </span>
              </SidebarLink>
            </div>

            {/* Group 4: Pengaturan & Profil */}
            <div className='sidemenu-group'>
              <label>Sistem &amp; Akun</label>

              <SidebarLink to='settings' allowedRoles={[...ALL_ROLES]}>
                <label>
                  <Settings />
                  <span>{t('navSettings')}</span>
                </label>
              </SidebarLink>

              <SidebarLink to='profile' allowedRoles={[...ALL_ROLES]}>
                <label>
                  <UserCheck />
                  <span>{t('navAccount')}</span>
                </label>
              </SidebarLink>
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

