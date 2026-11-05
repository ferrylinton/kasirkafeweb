import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './components/common/Toast';
import { DatabaseAlertModal } from './components/modals/DatabaseAlertModal';
import { router } from './router';

export { RoleGuard, type RoleGuardProps } from './components/security/RoleGuard';
export { router } from './router';

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <RouterProvider router={router} />
              <DatabaseAlertModal />
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
