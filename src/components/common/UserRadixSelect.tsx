import React from 'react';
import * as Select from '@radix-ui/react-select';
import {
  ChevronDown,
  ChevronUp,
  Check,
  ShieldCheck,
  Shield,
  Coffee,
  Store,
  Mail,
  Lock,
  Sparkles,
  Users
} from 'lucide-react';
import { SelectableUser } from '../modals/SelectUserModal';

export interface UserRadixSelectProps {
  id?: string;
  users: SelectableUser[];
  selectedUserId: string;
  onSelectUser: (user: SelectableUser) => void;
  disabled?: boolean;
  className?: string;
}

export const UserRadixSelect: React.FC<UserRadixSelectProps> = ({
  id = 'user-radix-select',
  users,
  selectedUserId,
  onSelectUser,
  disabled = false,
  className = ''
}) => {
  const selectedUser = users.find(u => u.id === selectedUserId || u.email === selectedUserId) || users[0];

  const handleValueChange = (val: string) => {
    const matched = users.find(u => u.id === val || u.email === val);
    if (matched) {
      onSelectUser(matched);
    }
  };

  // Group users by role for clean grouping in Select dropdown
  const adminUsers = users.filter(u => u.role?.toUpperCase() === 'ADMIN');
  const managerUsers = users.filter(u => u.role?.toUpperCase() === 'MANAGER');
  const cashierUsers = users.filter(u => u.role?.toUpperCase() !== 'ADMIN' && u.role?.toUpperCase() !== 'MANAGER');

  const getRoleBadge = (role: string) => {
    const r = role.toUpperCase();
    if (r === 'ADMIN') {
      return {
        label: 'ADMIN',
        bg: 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800/60',
        icon: <ShieldCheck className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
      };
    }
    if (r === 'MANAGER') {
      return {
        label: 'MANAGER',
        bg: 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60',
        icon: <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
      };
    }
    return {
      label: 'KASIR',
      bg: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60',
      icon: <Coffee className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
    };
  };

  const renderUserItem = (user: SelectableUser) => {
    const badge = getRoleBadge(user.role);
    const isSelected = selectedUser && (selectedUser.id === user.id || selectedUser.email === user.email);

    return (
      <Select.Item
        key={user.id}
        value={user.id}
        className="relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs text-stone-800 dark:text-stone-200 select-none cursor-pointer outline-none transition-all data-[highlighted]:bg-orange-50 dark:data-[highlighted]:bg-[#2c221e] data-[highlighted]:text-stone-900 dark:data-[highlighted]:text-stone-50 border border-transparent data-[highlighted]:border-orange-200 dark:data-[highlighted]:border-orange-900/40"
      >
        <div className="flex items-center gap-3 min-w-0 pr-6">
          {/* Avatar Thumbnail */}
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 shadow-2xs">
              <img
                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
                }}
              />
            </div>
          </div>

          {/* User Details */}
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Select.ItemText>
                <span className="font-bold text-stone-900 dark:text-stone-100 truncate block">
                  {user.name}
                </span>
              </Select.ItemText>
              <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider border ${badge.bg}`}>
                {badge.label}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
              <span className="flex items-center gap-1 truncate">
                <Mail className="w-3 h-3 text-stone-400 shrink-0" />
                <span className="truncate">{user.email}</span>
              </span>
              {user.vendorName && (
                <span className="hidden sm:inline-flex items-center gap-0.5 text-stone-400 dark:text-stone-500 truncate">
                  • <Store className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{user.vendorName}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Selected Checkmark Indicator */}
        <Select.ItemIndicator className="absolute right-3 flex items-center justify-center">
          <Check className="w-4 h-4 text-accent stroke-[2.5]" />
        </Select.ItemIndicator>
      </Select.Item>
    );
  };

  const selectedBadge = selectedUser ? getRoleBadge(selectedUser.role) : null;

  return (
    <div className={`w-full ${className}`}>
      <Select.Root
        value={selectedUser?.id || ''}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <Select.Trigger
          id={id}
          aria-label="Pilih akun pengguna kasir"
          className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#201918] border-2 border-stone-200 dark:border-stone-700/80 hover:border-accent/60 dark:hover:border-accent/60 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-3 focus:ring-accent/20 focus:border-accent transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed group text-left"
        >
          {selectedUser ? (
            <div className="flex items-center gap-3 min-w-0">
              {/* User Avatar */}
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 shadow-2xs">
                  <img
                    src={selectedUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                    alt={selectedUser.name}
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>
              </div>

              {/* User Info & Role */}
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-stone-900 dark:text-stone-100 truncate text-xs sm:text-sm font-heading">
                    {selectedUser.name}
                  </span>
                  {selectedBadge && (
                    <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider border ${selectedBadge.bg}`}>
                      {selectedBadge.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 truncate">
                  <span className="truncate">{selectedUser.email}</span>
                  {selectedUser.vendorName && (
                    <span className="hidden xs:inline-flex items-center gap-1 text-stone-400 dark:text-stone-500">
                      • {selectedUser.vendorName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-stone-400">
              <Users className="w-4 h-4 text-accent" />
              <Select.Value placeholder="Pilih akun pengguna..." />
            </div>
          )}

          {/* Right Chevron & Auto-fill hint */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/60 text-accent border border-orange-200/80 dark:border-orange-800/40">
              <Sparkles className="w-3 h-3" />
              <span>Auto-Fill</span>
            </span>

            <Select.Icon asChild>
              <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 group-hover:bg-accent/10 flex items-center justify-center transition-colors">
                <ChevronDown className="w-4 h-4 text-stone-500 group-hover:text-accent transition-colors" />
              </div>
            </Select.Icon>
          </div>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className="z-[100] w-[calc(100vw-2rem)] max-w-md max-h-[360px] overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#251e1c] p-2 shadow-2xl animate-in fade-in-80 zoom-in-95"
          >
            <Select.ScrollUpButton className="flex items-center justify-center h-6 text-stone-400 cursor-default hover:text-stone-600 dark:hover:text-stone-200">
              <ChevronUp className="w-4 h-4" />
            </Select.ScrollUpButton>

            <Select.Viewport className="p-1 space-y-1">
              {/* Header inside popup */}
              <div className="px-3 py-1.5 mb-1 flex items-center justify-between text-[11px] text-stone-400 border-b border-stone-100 dark:border-stone-800">
                <span className="font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  <span>Daftar Akun Pengguna</span>
                </span>
                <span className="text-[10px] flex items-center gap-1 text-accent font-medium">
                  <Lock className="w-3 h-3" />
                  <span>Email & sandi langsung terisi</span>
                </span>
              </div>

              {/* Group: Administrator */}
              {adminUsers.length > 0 && (
                <Select.Group>
                  <Select.Label className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Administrator</span>
                  </Select.Label>
                  {adminUsers.map(renderUserItem)}
                </Select.Group>
              )}

              {adminUsers.length > 0 && (managerUsers.length > 0 || cashierUsers.length > 0) && (
                <Select.Separator className="h-px bg-stone-100 dark:bg-stone-800 my-1.5" />
              )}

              {/* Group: Manager */}
              {managerUsers.length > 0 && (
                <Select.Group>
                  <Select.Label className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Manager Toko</span>
                  </Select.Label>
                  {managerUsers.map(renderUserItem)}
                </Select.Group>
              )}

              {managerUsers.length > 0 && cashierUsers.length > 0 && (
                <Select.Separator className="h-px bg-stone-100 dark:bg-stone-800 my-1.5" />
              )}

              {/* Group: Cashier */}
              {cashierUsers.length > 0 && (
                <Select.Group>
                  <Select.Label className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Coffee className="w-3.5 h-3.5" />
                    <span>Kasir / Barista</span>
                  </Select.Label>
                  {cashierUsers.map(renderUserItem)}
                </Select.Group>
              )}
            </Select.Viewport>

            <Select.ScrollDownButton className="flex items-center justify-center h-6 text-stone-400 cursor-default hover:text-stone-600 dark:hover:text-stone-200">
              <ChevronDown className="w-4 h-4" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
};
