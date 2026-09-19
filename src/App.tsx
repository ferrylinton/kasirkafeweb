import React, { useState } from 'react';
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
import { HistoryScreen } from './components/screens/HistoryScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { UserManagementScreen } from './components/screens/UserManagementScreen';
import { DiscountRulesScreen } from './components/screens/DiscountRulesScreen';
import { EmailTemplateScreen } from './components/screens/EmailTemplateScreen';
import { InventoryScreen } from './components/screens/InventoryScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { LoginHistoryScreen } from './components/screens/LoginHistoryScreen';
import { IdleTimeoutModal } from './components/common/IdleTimeoutModal';

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('katalog');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#fff8f6] dark:bg-[#1f1917] text-stone-700 dark:text-stone-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-3 border-orange-500 border-t-transparent animate-spin" />
          <span className="text-xs font-bold font-heading">Memuat POS SipSpot...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Route protection: Manager only tabs
  const isManager = user.role === 'MANAGER';
  let activeView = currentTab;
  if (!isManager && (currentTab === 'users' || currentTab === 'diskon' || currentTab === 'templates' || currentTab === 'inventaris' || currentTab === 'login-history')) {
    activeView = 'katalog';
  }

  return (
    <div className="min-h-screen bg-[#fff8f6] dark:bg-[#1f1917] text-stone-900 dark:text-stone-100 transition-colors selection:bg-orange-500/20 selection:text-orange-900 font-sans">
      {/* Sidebar navigation: drawer on mobile/tablet, dockable/collapsible on desktop */}
      <Sidebar
        currentTab={activeView}
        onSelectTab={tab => setCurrentTab(tab)}
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
          onNavigateTab={tab => setCurrentTab(tab)}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        {/* Main View Area */}
        <main className="w-full flex-1">
          {activeView === 'katalog' && (
            <CatalogScreen onNavigateToCart={() => setCurrentTab('pesanan')} />
          )}

          {activeView === 'pesanan' && (
            <CartScreen
              onProceedToPayment={() => setCurrentTab('pembayaran')}
              onNavigateToCatalog={() => setCurrentTab('katalog')}
            />
          )}

          {activeView === 'pembayaran' && (
            <PaymentScreen
              onBackToCart={() => setCurrentTab('pesanan')}
              onPaymentComplete={() => setCurrentTab('katalog')}
            />
          )}

          {activeView === 'histori' && <HistoryScreen />}

          {activeView === 'profile' && <ProfileScreen />}

          {activeView === 'settings' && <SettingsScreen />}

          {isManager && activeView === 'inventaris' && <InventoryScreen />}

          {isManager && activeView === 'users' && <UserManagementScreen />}

          {isManager && activeView === 'diskon' && <DiscountRulesScreen />}

          {isManager && activeView === 'templates' && <EmailTemplateScreen />}

          {isManager && activeView === 'login-history' && <LoginHistoryScreen />}
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
