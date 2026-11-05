import React from 'react';
import { Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export interface RoleGuardProps {
  allowedRoles: string[];
  children?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Loading state while authentication is being resolved
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#fff8f6] dark:bg-[#1f1917] text-stone-700 dark:text-stone-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-3 border-orange-500 border-t-transparent animate-spin" />
          <span className="text-xs font-bold font-heading">Memverifikasi Hak Akses Pengguna...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state: redirect to login preserving intended path
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Unauthorized role state
  const isAuthorized = allowedRoles.includes(user.role);

  if (!isAuthorized) {
    const defaultHomeRoute =
      user.role === 'ADMIN'
        ? '/admin-dashboard'
        : user.role === 'MANAGER'
        ? '/manager-dashboard'
        : '/katalog';

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#251e1c] rounded-3xl border border-red-200 dark:border-red-900/60 p-6 sm:p-8 shadow-xl text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-red-100 dark:bg-red-950/80 text-red-600 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-600">
              403 - Akses Ditolak
            </span>
            <h2 className="text-lg sm:text-xl font-bold font-heading text-stone-900 dark:text-stone-100 mt-2">
              Hak Akses Terbatas
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
              Halaman ini memerlukan peran akses:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
              {allowedRoles.map((role) => (
                <span
                  key={role}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-[11px] font-bold text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700"
                >
                  {role}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2">
              Peran akun Anda saat ini: <strong className="text-stone-800 dark:text-stone-200">{user.role}</strong> ({user.name})
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(defaultHomeRoute)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-bold shadow-xs hover:opacity-90 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Menu Utama ({user.role})</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authorized: render children if provided, or nested Outlet for route layouts
  return children ? <>{children}</> : <Outlet />;
};
