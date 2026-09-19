import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Check,
  Shield,
  Coffee,
  UserCheck,
  Sparkles,
  KeyRound,
  RefreshCw,
  Mail
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export interface SelectableUser {
  id: string;
  name: string;
  email: string;
  role: 'MANAGER' | 'CASHIER' | string;
  avatar?: string;
  pin?: string;
}

interface SelectUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUserId?: string;
  onSelectUser: (user: SelectableUser) => void;
}

const FALLBACK_USERS: SelectableUser[] = [
  {
    id: 'manager_1',
    name: 'Ferry Manager',
    email: 'manager@beverage.com',
    role: 'MANAGER',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    pin: '123456'
  },
  {
    id: 'cashier_1',
    name: 'Sarah Barista',
    email: 'cashier@beverage.com',
    role: 'CASHIER',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAAjgCQE0xuFbycGsf6WrsOWezNIYgI_Mgqgra6If5l-kM6PFqvc7XWy5YiF5Nz7EygG4k0H2Mtwi3YvU3QNeoo32v6smnPch82-FkkCAsKzcGQi4I6AHfwmT_EX6gLASiAhpg3Id6wKlIGsRatzjG67KlS-ijqvdQ7j0udvFAvMNaF2qsoHvAhSZgovySmbs3wEEzo0f3ygY8yk_4gbXMWCCpyHK8UOowRpDf-Wf_uDLVXJMCXtWJ8Hw',
    pin: '849201'
  }
];

export const SelectUserModal: React.FC<SelectUserModalProps> = ({
  isOpen,
  onClose,
  selectedUserId,
  onSelectUser
}) => {
  const { t } = useLanguage();
  const [users, setUsers] = useState<SelectableUser[]>(FALLBACK_USERS);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'MANAGER' | 'CASHIER'>('ALL');

  // Fetch users from API when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/selectable-users');
        const data = await res.json();
        if (data.success && Array.isArray(data.users) && data.users.length > 0) {
          setUsers(data.users);
        } else {
          setUsers(FALLBACK_USERS);
        }
      } catch (err) {
        setUsers(FALLBACK_USERS);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredUsers = users.filter(user => {
    const matchQuery =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterRole === 'ALL') return matchQuery;
    return matchQuery && user.role.toUpperCase() === filterRole;
  });

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))'
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#251e1c] rounded-3xl shadow-2xl border border-stone-200/80 dark:border-stone-800 overflow-hidden z-10 my-auto flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-stone-100 dark:border-stone-800/80 flex items-start justify-between gap-3 bg-[#fffaf8] dark:bg-[#201917]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/70 text-accent flex items-center justify-center font-bold shadow-xs shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>{t('selectUserModalTitle')}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                    {users.length} Akun
                  </span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  {t('selectUserModalSubtitle')}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-4 sm:px-6 border-b border-stone-100 dark:border-stone-800/80 bg-stone-50/70 dark:bg-[#1e1715] flex flex-col sm:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('searchUserPlaceholder')}
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setFilterRole('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filterRole === 'ALL'
                    ? 'bg-accent text-white shadow-xs'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                }`}
              >
                {t('allRoles')}
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('MANAGER')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filterRole === 'MANAGER'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                }`}
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('CASHIER')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filterRole === 'CASHIER'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100'
                }`}
              >
                Kasir
              </button>
            </div>
          </div>

          {/* User List Body */}
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[50vh] flex flex-col gap-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-stone-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                <span className="text-xs">Memuat daftar pengguna...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-stone-400">
                <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
                  Tidak ada pengguna yang cocok
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  Coba kata kunci pencarian atau ganti filter peran
                </p>
              </div>
            ) : (
              filteredUsers.map(user => {
                const isSelected = selectedUserId === user.id || selectedUserId === user.email;
                const isManager = user.role.toUpperCase() === 'MANAGER';

                return (
                  <div
                    key={user.id}
                    onClick={() => {
                      onSelectUser(user);
                      onClose();
                    }}
                    className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-accent bg-orange-50/70 dark:bg-orange-950/30 ring-2 ring-accent/30 shadow-xs'
                        : 'border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-accent/60 hover:bg-stone-50 dark:hover:bg-stone-850 shadow-2xs'
                    }`}
                  >
                    {/* User Info Left */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Avatar Image with Status */}
                      <div className="relative shrink-0">
                        <div
                          className={`w-13 h-13 rounded-2xl overflow-hidden border-2 p-0.5 bg-stone-100 dark:bg-stone-800 shadow-xs transition-transform group-hover:scale-105 ${
                            isSelected
                              ? 'border-accent ring-2 ring-accent/40'
                              : isManager
                              ? 'border-amber-400'
                              : 'border-emerald-400'
                          }`}
                        >
                          <img
                            src={
                              user.avatar ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                            }
                            alt={user.name}
                            className="w-full h-full object-cover rounded-xl"
                            onError={e => {
                              // Fallback image if broken
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                            }}
                          />
                        </div>

                        {/* Role Icon Overlay */}
                        <div
                          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-xs border border-white dark:border-stone-900 ${
                            isManager ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        >
                          {isManager ? (
                            <Shield className="w-2.5 h-2.5" />
                          ) : (
                            <Coffee className="w-2.5 h-2.5" />
                          )}
                        </div>
                      </div>

                      {/* Name, Email, & Role */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 font-heading truncate">
                            {user.name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isManager
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60'
                            }`}
                          >
                            {isManager ? t('roleManager') : t('roleCashier')}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 dark:text-stone-400 flex-wrap">
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </span>

                          {user.pin && (
                            <span className="flex items-center gap-1 font-mono font-semibold text-[11px] text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded-md">
                              <KeyRound className="w-3 h-3 text-stone-400" />
                              <span>PIN: {user.pin}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Select Action */}
                    <div className="shrink-0 flex items-center gap-2">
                      {isSelected ? (
                        <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-bold shadow-xs">
                          <Check className="w-4 h-4" />
                          <span className="hidden sm:inline">{t('selectedUserBadge')}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onSelectUser(user);
                            onClose();
                          }}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 group-hover:bg-accent group-hover:text-white transition-all shadow-2xs"
                        >
                          {t('chooseThisUser')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="p-4 sm:px-6 bg-stone-50 dark:bg-[#201917] border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Pilih akun untuk mengisi otomatis nama, foto, dan kredensial login</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-stone-600 dark:text-stone-300 hover:underline"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
