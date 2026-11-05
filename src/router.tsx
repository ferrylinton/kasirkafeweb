import React, { useState } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { RoleGuard } from './components/security/RoleGuard';
import { useAuth } from './contexts/AuthContext';

// Common Layout Components
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { IdleTimeoutModal } from './components/common/IdleTimeoutModal';
import { HousekeepingNotificationBanner } from './components/common/HousekeepingNotificationBanner';

// Screens
import { LoginScreen } from './components/screens/LoginScreen';
import { VendorRegisterScreen } from './components/screens/VendorRegisterScreen';
import { ResetPasswordScreen } from './components/screens/ResetPasswordScreen';
import { CatalogScreen } from './components/screens/CatalogScreen';
import { CartScreen } from './components/screens/CartScreen';
import { PaymentScreen } from './components/screens/PaymentScreen';
import { OrderHistoryScreen } from './components/screens/OrderHistoryScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { ManagerDashboardScreen } from './components/screens/ManagerDashboardScreen';
import { TopProductsScreen } from './components/screens/TopProductsScreen';
import { ProductManagementScreen } from './components/screens/ProductManagementScreen';
import { ProductStockScreen } from './components/screens/ProductStockScreen';
import { CategoryManagementScreen } from './components/screens/CategoryManagementScreen';
import { RawMaterialPurchasesScreen } from './components/screens/RawMaterialPurchasesScreen';
import { UserManagementScreen } from './components/screens/UserManagementScreen';
import { DiscountRulesScreen } from './components/screens/DiscountRulesScreen';
import { EmailTemplateScreen } from './components/screens/EmailTemplateScreen';
import { LoginHistoryScreen } from './components/screens/LoginHistoryScreen';
import { ActivityLogScreen } from './components/screens/ActivityLogScreen';
import { VendorClientScreen } from './components/screens/VendorClientScreen';
import { AdminDashboardScreen } from './components/screens/AdminDashboardScreen';
import { VendorManagementScreen } from './components/screens/VendorManagementScreen';
import { AdminLogViewerScreen } from './components/screens/AdminLogViewerScreen';
import { AdminLockedUsersScreen } from './components/screens/AdminLockedUsersScreen';
import { HousekeepingScreen } from './components/screens/HousekeepingScreen';

/**
 * Main Layout Shell wrapping all authenticated application views
 */
export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  // Derive active tab from current route path
  const currentPath = location.pathname.replace(/^\//, '').split('/')[0] || '';
  const activeTab = currentPath || (user?.role === 'ADMIN' ? 'admin-dashboard' : user?.role === 'MANAGER' ? 'manager-dashboard' : 'katalog');

  const handleNavigateTab = (tab: string) => {
    navigate('/' + tab);
  };

  return (
    <div className="min-h-screen bg-theme-app text-theme-primary transition-colors selection:bg-orange-500/20 selection:text-orange-900 font-sans">
      {/* Sidebar navigation */}
      <Sidebar
        currentTab={activeTab}
        onSelectTab={handleNavigateTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Column */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}
        style={{
          paddingLeft: isSidebarOpen ? undefined : 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)'
        }}
      >
        <Navbar
          currentTab={activeTab}
          onNavigateTab={handleNavigateTab}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        <main className="w-full flex-1">
          <HousekeepingNotificationBanner
            onNavigateToHousekeeping={() => navigate('/admin-housekeeping')}
          />
          <Outlet />
        </main>
      </div>

      <IdleTimeoutModal />
    </div>
  );
};

/**
 * Root Index Route Redirector: Routes user to their appropriate role home
 */
const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-theme-app text-theme-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-3 border-orange-500 border-t-transparent animate-spin" />
          <span className="text-xs font-bold font-heading">Memuat POS KasirKafe...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/admin-dashboard" replace />;
  }

  if (user.role === 'MANAGER') {
    return <Navigate to="/manager-dashboard" replace />;
  }

  return <Navigate to="/katalog" replace />;
};

/**
 * Public Authentication Page Wrappers
 */
const LoginPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If already authenticated, redirect to root
  if (user) {
    return <RootRedirect />;
  }

  // Handle URL action parameters if present
  const action = searchParams.get('action');
  const token = searchParams.get('token');

  if (action === 'reset-password' && token) {
    return (
      <ResetPasswordScreen
        token={token}
        onBackToLogin={() => navigate('/login')}
      />
    );
  }

  if (action === 'register-vendor' || action === 'confirm-vendor') {
    return (
      <VendorRegisterScreen
        initialToken={token}
        onBackToLogin={() => navigate('/login')}
      />
    );
  }

  return (
    <LoginScreen
      onOpenRegister={() => navigate('/register-vendor')}
      onOpenResetPassword={(tok) => navigate(tok ? `/reset-password?token=${encodeURIComponent(tok)}` : '/reset-password')}
    />
  );
};

const RegisterVendorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <VendorRegisterScreen
      initialToken={token}
      onBackToLogin={() => navigate('/login')}
    />
  );
};

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <ResetPasswordScreen
      token={token}
      onBackToLogin={() => navigate('/login')}
    />
  );
};

/**
 * Screen Route Wrappers for Navigation Callbacks
 */
const CatalogPage: React.FC = () => {
  const navigate = useNavigate();
  return <CatalogScreen onNavigateToCart={() => navigate('/pesanan')} />;
};

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <CartScreen
      onProceedToPayment={() => navigate('/pembayaran')}
      onNavigateToCatalog={() => navigate('/katalog')}
    />
  );
};

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <PaymentScreen
      onBackToCart={() => navigate('/pesanan')}
      onPaymentComplete={() => navigate('/katalog')}
    />
  );
};

const OrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  return <OrderHistoryScreen onNavigateTab={(tab) => navigate('/' + tab)} />;
};

const AdminOrderHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  return <OrderHistoryScreen allVendorsMode={true} onNavigateTab={(tab) => navigate('/' + tab)} />;
};

const ManagerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  return <ManagerDashboardScreen onNavigateTab={(tab) => navigate('/' + tab)} />;
};

/**
 * React Router Configuration using createBrowserRouter & RoleGuard
 */
export const router = createBrowserRouter([
  // Public Routes
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/register-vendor',
    element: <RegisterVendorPage />
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />
  },

  // Authenticated App Shell Layout
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <RootRedirect />
      },

      // 1. Operasional Kasir (Roles: CASHIER, MANAGER)
      {
        element: <RoleGuard allowedRoles={['CASHIER', 'MANAGER']} />,
        children: [
          { path: 'katalog', element: <CatalogPage /> },
          { path: 'pesanan', element: <CartPage /> },
          { path: 'pembayaran', element: <PaymentPage /> },
          { path: 'histori', element: <OrderHistoryPage /> }
        ]
      },

      // 2. Manajemen Toko & Pembelian Bahan Baku (Role: MANAGER)
      {
        element: <RoleGuard allowedRoles={['MANAGER']} />,
        children: [
          { path: 'manager-dashboard', element: <ManagerDashboardPage /> },
          { path: 'manager-top-products', element: <TopProductsScreen managerMode={true} /> },
          { path: 'top-products', element: <TopProductsScreen managerMode={true} /> },
          { path: 'produk-manajemen', element: <ProductManagementScreen /> },
          { path: 'stok-produk', element: <ProductStockScreen /> },
          { path: 'inventaris', element: <ProductStockScreen /> },
          { path: 'kategori', element: <CategoryManagementScreen /> },
          { path: 'pembelian-bahan', element: <RawMaterialPurchasesScreen /> },
          { path: 'bahan-baku', element: <RawMaterialPurchasesScreen /> },
          { path: 'resep-minuman', element: <RawMaterialPurchasesScreen /> },
          { path: 'users', element: <UserManagementScreen /> },
          { path: 'diskon', element: <DiscountRulesScreen /> },
          { path: 'templates', element: <EmailTemplateScreen /> },
          { path: 'login-history', element: <LoginHistoryScreen /> },
          { path: 'activity-logs', element: <ActivityLogScreen /> },
          { path: 'vendor-client', element: <VendorClientScreen /> }
        ]
      },

      // 3. Administrasi Sistem Lintas Vendor (Role: ADMIN)
      {
        element: <RoleGuard allowedRoles={['ADMIN']} />,
        children: [
          { path: 'admin-dashboard', element: <AdminDashboardScreen /> },
          { path: 'admin-top-products', element: <TopProductsScreen managerMode={false} /> },
          { path: 'vendor-management', element: <VendorManagementScreen /> },
          { path: 'log-viewer', element: <AdminLogViewerScreen /> },
          { path: 'admin-orders', element: <AdminOrderHistoryPage /> },
          { path: 'admin-riwayat', element: <AdminOrderHistoryPage /> },
          { path: 'admin-products', element: <ProductManagementScreen allVendorsMode={true} /> },
          { path: 'admin-stock', element: <ProductStockScreen allVendorsMode={true} /> },
          { path: 'admin-inventory', element: <ProductStockScreen allVendorsMode={true} /> },
          { path: 'admin-inventaris', element: <ProductStockScreen allVendorsMode={true} /> },
          { path: 'admin-users', element: <UserManagementScreen allVendorsMode={true} /> },
          { path: 'admin-discounts', element: <DiscountRulesScreen allVendorsMode={true} /> },
          { path: 'admin-diskon', element: <DiscountRulesScreen allVendorsMode={true} /> },
          { path: 'admin-templates', element: <EmailTemplateScreen allVendorsMode={true} /> },
          { path: 'admin-login-history', element: <LoginHistoryScreen allVendorsMode={true} /> },
          { path: 'admin-activity-logs', element: <ActivityLogScreen allVendorsMode={true} /> },
          { path: 'admin-locked-users', element: <AdminLockedUsersScreen /> },
          { path: 'admin-housekeeping', element: <HousekeepingScreen /> }
        ]
      },

      // 4. Akun & Pengaturan Pengguna (All authenticated roles)
      {
        element: <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'CASHIER']} />,
        children: [
          { path: 'profile', element: <ProfileScreen /> },
          { path: 'settings', element: <SettingsScreen /> }
        ]
      },

      // Fallback: Redirect any unknown path to root
      {
        path: '*',
        element: <Navigate to="/" replace />
      }
    ]
  }
]);
