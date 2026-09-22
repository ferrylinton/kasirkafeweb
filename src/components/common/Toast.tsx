import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast floating container with safe area insets */}
      <div className="fixed toast-safe-container z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md ${
                toast.type === 'success'
                  ? 'bg-[#10b981] text-white border-emerald-400/30'
                  : toast.type === 'error'
                  ? 'bg-[#dc2626] text-white border-red-400/30'
                  : toast.type === 'warning'
                  ? 'bg-[#f59e0b] text-white border-amber-400/30'
                  : 'bg-[#1e293b] text-white border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
                {toast.type === 'warning' && <AlertCircle className="w-5 h-5 shrink-0" />}
                {toast.type === 'info' && <Info className="w-5 h-5 shrink-0" />}
                <p className="text-sm font-medium leading-snug break-words">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
