import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './components/common/Toast';

import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { LoginScreen } from './components/screens/LoginScreen';
import { CatalogScreen } from './components/screens/CatalogScreen';
import { CartScreen } from './components/screens/CartScreen';
import { PaymentScreen } from './components/screens/PaymentScreen';
import { OrderHistoryScreen } from './components/screens/OrderHistoryScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { UserManagementScreen } from './components/screens/UserManagementScreen';
import { DiscountRulesScreen } from './components/screens/DiscountRulesScreen';
import { EmailTemplateScreen } from './components/screens/EmailTemplateScreen';
import { InventoryScreen } from './components/screens/InventoryScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { LoginHistoryScreen } from './components/screens/LoginHistoryScreen';
import { ActivityLogScreen } from './components/screens/ActivityLogScreen';
import { VendorClientScreen } from './components/screens/VendorClientScreen';
import { VendorManagementScreen } from './components/screens/VendorManagementScreen';
import { AdminDashboardScreen } from './components/screens/AdminDashboardScreen';
import { ManagerDashboardScreen } from './components/screens/ManagerDashboardScreen';
import { TopProductsScreen } from './components/screens/TopProductsScreen';
import { IdleTimeoutModal } from './components/common/IdleTimeoutModal';
import { AdminLogViewerScreen } from './components/screens/AdminLogViewerScreen';
import { AdminLockedUsersScreen } from './components/screens/AdminLockedUsersScreen';
import { HousekeepingScreen } from './components/screens/HousekeepingScreen';
import { HousekeepingNotificationBanner } from './components/common/HousekeepingNotificationBanner';
import { VendorRegisterScreen } from './components/screens/VendorRegisterScreen';
import { ResetPasswordScreen } from './components/screens/ResetPasswordScreen';

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [resetPasswordToken, setResetPasswordToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get('action');
      if (action === 'reset-password') {
        return urlParams.get('token') || '';
      }
    }
    return null;
  });

  const [isRegisteringVendor, setIsRegisteringVendor] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('action') === 'register-vendor' || urlParams.get('action') === 'confirm-vendor';
    }
    return false;
  });

  const [initialConfirmationToken, setInitialConfirmationToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('token') || null;
    }
    return null;
  });

  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (user?.role === 'ADMIN') {
      return 'admin-dashboard';
    }
    if (user?.role === 'MANAGER') {
      return 'manager-dashboard';
    }
    return 'katalog';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  // Kategori Tab Berdasarkan Hak Akses Role
  // 1. Operasional Kasir: Hanya boleh diakses role CASHIER dan role MANAGER
  const cashierTabs = ['katalog', 'pesanan', 'pembayaran', 'histori'];

  // 2. Manajemen Toko: Hanya boleh diakses role MANAGER
  const managerTabs = [
    'manager-dashboard',
    'manager-top-products',
    'top-products',
    'admin-dashboard',
    'admin-top-products',
    'inventaris',
    'users',
    'diskon',
    'templates',
    'login-history',
    'activity-logs',
    'vendor-client'
  ];

  // 3. Administrasi Sistem (Lintas Vendor): Hanya boleh diakses role ADMIN
  const adminTabs = [
    'admin-dashboard',
    'admin-top-products',
    'vendor-management',
    'log-viewer',
    'admin-orders',
    'admin-riwayat',
    'admin-inventory',
    'admin-inventaris',
    'admin-users',
    'admin-discounts',
    'admin-diskon',
    'admin-templates',
    'admin-login-history',
    'admin-activity-logs',
    'admin-locked-users',
    'admin-housekeeping'
  ];

  const accountTabs = ['profile', 'settings'];

  // Sinkronisasi tab saat role user berubah
  useEffect(() => {
    if (!user) return;
    const role = user.role;
    if (role === 'ADMIN') {
      if (!adminTabs.includes(currentTab) && !accountTabs.includes(currentTab)) {
        setCurrentTab('admin-dashboard');
      }
    } else if (role === 'MANAGER') {
      // MANAGER boleh Operasional Kasir (cashierTabs) & Manajemen Toko (managerTabs) & accountTabs
      if (!cashierTabs.includes(currentTab) && !managerTabs.includes(currentTab) && !accountTabs.includes(currentTab)) {
        setCurrentTab('katalog');
      }
    } else {
      // CASHIER: Hanya boleh Operasional Kasir (cashierTabs) & accountTabs
      if (!cashierTabs.includes(currentTab) && !accountTabs.includes(currentTab)) {
        setCurrentTab('katalog');
      }
    }
  }, [user?.role]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#fff8f6] dark:bg-[#1f1917] text-stone-700 dark:text-stone-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-3 border-orange-500 border-t-transparent animate-spin" />
          <span className="text-xs font-bold font-heading">Memuat POS KasirKafe...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (resetPasswordToken !== null) {
      return (
        <ResetPasswordScreen
          token={resetPasswordToken}
          onBackToLogin={() => {
            setResetPasswordToken(null);
            if (typeof window !== 'undefined' && window.history) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }}
        />
      );
    }

    if (isRegisteringVendor) {
      return (
        <VendorRegisterScreen
          initialToken={initialConfirmationToken}
          onBackToLogin={() => {
            setIsRegisteringVendor(false);
            setInitialConfirmationToken(null);
            if (typeof window !== 'undefined' && window.history) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }}
        />
      );
    }
    return (
      <LoginScreen
        onOpenRegister={() => setIsRegisteringVendor(true)}
        onOpenResetPassword={(tok) => setResetPasswordToken(tok || '')}
      />
    );
  }

  // Hak Akses Role
  const isCashierOrManager = user.role === 'CASHIER' || user.role === 'MANAGER';
  const isManager = user.role === 'MANAGER';
  const isAdmin = user.role === 'ADMIN' ;
  const isCashier = user.role === 'CASHIER';

  // Strict activeView validation
  let activeView = currentTab;
  if (isAdmin) {
    // Role ADMIN dilarang mengakses Operasional Kasir & Manajemen Toko lokal
    if (!adminTabs.includes(activeView) && !accountTabs.includes(activeView)) {
      activeView = 'admin-orders';
    }
  } else if (isManager) {
    // Role MANAGER boleh Operasional Kasir & Manajemen Toko, dilarang Administrasi Sistem
    if (!cashierTabs.includes(activeView) && !managerTabs.includes(activeView) && !accountTabs.includes(activeView)) {
      activeView = 'katalog';
    }
  } else if (isCashier) {
    // Role CASHIER hanya boleh Operasional Kasir & Akun/Setting. Dilarang Manajemen Toko & Administrasi Sistem
    if (!cashierTabs.includes(activeView) && !accountTabs.includes(activeView)) {
      activeView = 'katalog';
    }
  } else {
    if (!accountTabs.includes(activeView)) {
      activeView = 'profile';
    }
  }

  // Handler navigasi dengan pengamanan hak akses berlapis
  const handleNavigateTab = (targetTab: string) => {
    if (isAdmin) {
      if (adminTabs.includes(targetTab) || accountTabs.includes(targetTab)) {
        setCurrentTab(targetTab);
      } else {
        setCurrentTab('admin-orders');
      }
    } else if (isManager) {
      // MANAGER boleh Operasional Kasir dan Manajemen Toko
      if (cashierTabs.includes(targetTab) || managerTabs.includes(targetTab) || accountTabs.includes(targetTab)) {
        setCurrentTab(targetTab);
      } else {
        setCurrentTab('katalog');
      }
    } else if (isCashier) {
      // CASHIER hanya boleh Operasional Kasir dan Akun/Setting
      if (cashierTabs.includes(targetTab) || accountTabs.includes(targetTab)) {
        setCurrentTab(targetTab);
      } else {
        setCurrentTab('katalog');
      }
    } else {
      if (accountTabs.includes(targetTab)) {
        setCurrentTab(targetTab);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#fff8f6] dark:bg-[#1f1917] text-stone-900 dark:text-stone-100 transition-colors selection:bg-orange-500/20 selection:text-orange-900 font-sans">
      {/* Sidebar navigation: drawer on mobile/tablet, dockable/collapsible on desktop */}
      <Sidebar
        currentTab={activeView}
        onSelectTab={handleNavigateTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Column: smoothly transitions width based on sidebar state */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}
        style={{
          paddingLeft: isSidebarOpen ? undefined : 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)'
        }}
      >
        {/* Top Navbar with sidebar toggle button */}
        <Navbar
          currentTab={activeView}
          onNavigateTab={handleNavigateTab}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        {/* Main View Area */}
        <main className="w-full flex-1">
          {/* End-of-Month Housekeeping Alert Banner */}
          <HousekeepingNotificationBanner
            onNavigateToHousekeeping={() => handleNavigateTab('admin-housekeeping')}
          />

          {/* Operasional Kasir (Hanya role CASHIER dan role MANAGER) */}
          {isCashierOrManager && activeView === 'katalog' && (
            <CatalogScreen onNavigateToCart={() => handleNavigateTab('pesanan')} />
          )}

          {isCashierOrManager && activeView === 'pesanan' && (
            <CartScreen
              onProceedToPayment={() => handleNavigateTab('pembayaran')}
              onNavigateToCatalog={() => handleNavigateTab('katalog')}
            />
          )}

          {isCashierOrManager && activeView === 'pembayaran' && (
            <PaymentScreen
              onBackToCart={() => handleNavigateTab('pesanan')}
              onPaymentComplete={() => handleNavigateTab('katalog')}
            />
          )}

          {isCashierOrManager && activeView === 'histori' && <OrderHistoryScreen onNavigateTab={handleNavigateTab} />}

          {/* Sistem & Akun (Semua Pengguna Terautentikasi) */}
          {activeView === 'profile' && <ProfileScreen />}
          {activeView === 'settings' && <SettingsScreen />}

          {/* Manajemen Toko (HANYA role MANAGER) */}
          {isManager && activeView === 'manager-dashboard' && <ManagerDashboardScreen onNavigateTab={handleNavigateTab} />}
          {isAdmin && activeView === 'manager-dashboard' && <ManagerDashboardScreen onNavigateTab={handleNavigateTab} />}
          {isManager && (activeView === 'manager-top-products' || activeView === 'top-products') && (
            <TopProductsScreen managerMode={true} />
          )}
          {isManager && activeView === 'inventaris' && <InventoryScreen />}
          {isManager && activeView === 'users' && <UserManagementScreen />}
          {isManager && activeView === 'diskon' && <DiscountRulesScreen />}
          {isManager && activeView === 'templates' && <EmailTemplateScreen />}
          {isManager && activeView === 'login-history' && <LoginHistoryScreen />}
          {isManager && activeView === 'activity-logs' && <ActivityLogScreen />}
          {(isManager || isAdmin) && activeView === 'vendor-client' && <VendorClientScreen />}

          {/* Administrasi Sistem Lintas Vendor */}
          {(isAdmin || isManager) && activeView === 'admin-dashboard' && (
            <AdminDashboardScreen />
          )}
          {(isAdmin || isManager) && activeView === 'admin-top-products' && (
            <TopProductsScreen managerMode={false} />
          )}
          {isAdmin && (activeView === 'admin-orders' || activeView === 'admin-riwayat') && (
            <OrderHistoryScreen allVendorsMode={true} onNavigateTab={handleNavigateTab} />
          )}
          {isAdmin && (activeView === 'admin-inventory' || activeView === 'admin-inventaris') && (
            <InventoryScreen allVendorsMode={true} />
          )}
          {isAdmin && activeView === 'admin-users' && (
            <UserManagementScreen allVendorsMode={true} />
          )}
          {isAdmin && (activeView === 'admin-discounts' || activeView === 'admin-diskon') && (
            <DiscountRulesScreen allVendorsMode={true} />
          )}
          {isAdmin && activeView === 'admin-templates' && (
            <EmailTemplateScreen allVendorsMode={true} />
          )}
          {isAdmin && activeView === 'admin-login-history' && (
            <LoginHistoryScreen allVendorsMode={true} />
          )}
          {isAdmin && activeView === 'admin-activity-logs' && (
            <ActivityLogScreen allVendorsMode={true} />
          )}
          {isAdmin && activeView === 'vendor-management' && (
            <VendorManagementScreen />
          )}
          {isAdmin && activeView === 'log-viewer' && (
            <AdminLogViewerScreen />
          )}
          {isAdmin && activeView === 'admin-locked-users' && (
            <AdminLockedUsersScreen />
          )}
          {isAdmin && activeView === 'admin-housekeeping' && (
            <HousekeepingScreen />
          )}
        </main>
      </div>

      {/* Visual countdown modal 60s before 15-minute idle timeout */}
      <IdleTimeoutModal />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <MainLayout />
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
