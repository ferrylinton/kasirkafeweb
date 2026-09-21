import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
  type?: string
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  confirmVariant = 'primary',
  onConfirm,
  onCancel
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#251e1c] p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 flex flex-col gap-4"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <h3 className="text-lg font-bold font-heading leading-tight">{title}</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">{message}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="py-3 px-4 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-sm font-semibold transition-colors"
            >
              {cancelText || t('cancelBtn')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`py-3 px-4 rounded-2xl text-sm font-semibold text-white shadow-md transition-all active:scale-95 ${
                confirmVariant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : confirmVariant === 'success'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-accent hover:opacity-90'
              }`}
            >
              {confirmText || t('confirmBtn')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
