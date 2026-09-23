import React, { useState, useEffect } from 'react';
import { Users, UserPlus, KeyRound, Edit2, Trash2, Shield, UserCheck, X, Check, Lock, ShieldAlert, Mail, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { User, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { AdminAllVendorsHeader, VendorBadge } from '../common/AdminAllVendorsHeader';
import { AdminSendPinModal } from '../modals/AdminSendPinModal';

interface PinResetRequest {
  id: string;
  userId: string;
  email: string;
  userName: string;
  vendorId?: string;
  role: string;
  note?: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  requestedAt: string;
}

interface UserManagementScreenProps {
  allVendorsMode?: boolean;
}

export const UserManagementScreen: React.FC<UserManagementScreenProps> = ({ allVendorsMode = false }) => {
  const { user: currentUser, token } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  // PIN Reset Requests (for role ADMIN)
  const [pinResetRequests, setPinResetRequests] = useState<PinResetRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [showAdminSendPinModal, setShowAdminSendPinModal] = useState<boolean>(false);
  const [targetUserForPin, setTargetUserForPin] = useState<{
    email: string;
    name: string;
    role?: string;
    vendorName?: string;
    requestId?: string;
    note?: string;
  } | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Form states for Create/Edit
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER' as UserRole,
    pin: '123456',
    avatar: ''
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = allVendorsMode
        ? (selectedVendor === 'all' ? '/api/users?allVendors=true' : `/api/users?vendorId=${selectedVendor}`)
        : '/api/users';

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.warn('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchPinResetRequests = async () => {
    if (currentUser?.role !== 'ADMIN') return;
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/auth/admin/pin-reset-requests', {
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      if (data.success && data.requests) {
        setPinResetRequests(data.requests);
      }
    } catch (err) {
      console.warn('Failed to fetch PIN reset requests');
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    if (currentUser?.role === 'ADMIN') {
      fetchPinResetRequests();
    }
  }, [token, allVendorsMode, selectedVendor, currentUser?.role]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Pengguna baru berhasil ditambahkan!', 'success');
        setShowAddModal(false);
        setFormData({ name: '', email: '', password: '', role: 'CASHIER', pin: '1234', avatar: '' });
        fetchUsers();
      } else {
        showToast(data.message || data.error || 'Gagal menambahkan user.', 'error');
      }
    } catch (err) {
      showToast('Koneksi server gagal.', 'error');
    }
  };

  const handleOpenEdit = (targetUser: User) => {
    setSelectedUser(targetUser);
    setFormData({
      name: targetUser.name,
      email: targetUser.email,
      password: '',
      role: targetUser.role,
      pin: targetUser.pin || '1234',
      avatar: targetUser.avatar || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        pin: formData.pin,
        avatar: formData.avatar
      };
      if (formData.password) {
        payload.newPassword = formData.password;
      }

      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Data staf & password berhasil diperbarui!', 'success');
        setShowEditModal(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        showToast(data.message || data.error || 'Gagal update user.', 'error');
      }
    } catch (err) {
      showToast('Koneksi server gagal.', 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();
      setUserToDelete(null);

      if (data.success) {
        showToast('Pengguna berhasil dihapus.', 'success');
        fetchUsers();
      } else {
        showToast(data.message || data.error || 'Gagal menghapus user.', 'error');
      }
    } catch (err) {
      setUserToDelete(null);
      showToast('Koneksi server gagal.', 'error');
    }
  };

  const isAuthorized = allVendorsMode
    ? (currentUser?.role === 'ADMIN')
    : (currentUser?.role === 'MANAGER');

  if (!isAuthorized) {
    return (
      <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-full bg-white dark:bg-[#251e1c] rounded-3xl border border-rose-200 dark:border-rose-900/50 p-8 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-heading text-stone-900 dark:text-stone-100">
            {allVendorsMode ? 'Akses Terbatas: Khusus Administrator' : 'Akses Terbatas: Khusus Manajer'}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 mb-6">
            {allVendorsMode
              ? 'Menu Administrasi Pengguna Lintas Vendor hanya dapat diakses oleh Administrator.'
              : 'Menu Manajemen Pengguna Toko hanya dapat diakses oleh akun dengan peran Manajer.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto flex flex-col gap-5">
      {/* 1. Header */}
      {allVendorsMode ? (
        <AdminAllVendorsHeader
          title={t('navAdminUsers')}
          subtitle="Manajemen akun pengguna, role manager, dan kasir di seluruh vendor jaringan"
          selectedVendor={selectedVendor}
          onVendorChange={setSelectedVendor}
          onRefresh={fetchUsers}
          isLoading={loading}
          itemCount={users.length}
          itemLabel="User"
        />
      ) : (
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100">
                {t('userManagementTitle')}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                Khusus Manager
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Tambah, edit role, dan reset password kasir toko
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFormData({ name: '', email: '', password: '', role: 'CASHIER', pin: '1234', avatar: '' });
              setShowAddModal(true);
            }}
            className="py-2.5 px-4 rounded-2xl bg-accent text-white font-bold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addUser')}</span>
          </button>
        </div>
      )}

      {/* Password / PIN Reset Requests Section for Role ADMIN */}
      {currentUser?.role === 'ADMIN' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#251e1c] border border-purple-200/80 dark:border-purple-900/40 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-heading">
                    Permintaan Reset Password / PIN Masuk
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    pinResetRequests.filter(r => r.status === 'PENDING').length > 0
                      ? 'bg-purple-600 text-white animate-pulse'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}>
                    {pinResetRequests.filter(r => r.status === 'PENDING').length} Menunggu
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Daftar permohonan reset password atau PIN yang diajukan pengguna ke Role ADMIN
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchPinResetRequests}
              disabled={loadingRequests}
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
              title="Perbarui Permintaan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingRequests ? (
            <div className="py-4 text-center text-xs text-stone-400">Memuat antrean permintaan...</div>
          ) : pinResetRequests.filter(r => r.status === 'PENDING').length === 0 ? (
            <div className="py-3 px-4 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200/50 dark:border-stone-800/60 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Tidak ada antrean permohonan reset kata sandi yang pending.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pinResetRequests
                .filter(r => r.status === 'PENDING')
                .map(req => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 dark:text-stone-100">{req.userName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold">
                          {req.role}
                        </span>
                        {req.vendorId && (
                          <span className="text-[10px] text-stone-500 dark:text-stone-400">
                            • {req.vendorId}
                          </span>
                        )}
                      </div>
                      <div className="text-stone-600 dark:text-stone-400 flex items-center gap-1.5 text-[11px]">
                        <Mail className="w-3 h-3 text-purple-500" />
                        <span className="font-semibold text-purple-900 dark:text-purple-300">{req.email}</span>
                        <span>• {new Date(req.requestedAt).toLocaleString('id-ID')}</span>
                      </div>
                      {req.note && (
                        <p className="text-[11px] text-stone-600 dark:text-stone-300 italic bg-white/60 dark:bg-stone-900/60 px-2.5 py-1 rounded-lg border border-purple-100 dark:border-purple-900/30">
                          Catatan: "{req.note}"
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTargetUserForPin({
                          email: req.email,
                          name: req.userName,
                          role: req.role,
                          vendorName: req.vendorId,
                          requestId: req.id,
                          note: req.note
                        });
                        setShowAdminSendPinModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Kirim Password / PIN ke Email</span>
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 2. User Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 rounded-3xl bg-stone-200/60 dark:bg-stone-800/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {users.map(u => {
            const isSelf = currentUser?.id === u.id;
            return (
              <div
                key={u.id}
                className="p-4 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0 border border-stone-200 dark:border-stone-700">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-accent text-white font-bold text-sm">
                        {u.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 font-heading truncate">
                        {u.name}
                      </h4>
                      {isSelf && (
                        <span className="text-[9px] font-semibold text-accent bg-orange-100 dark:bg-orange-950/60 px-1.5 py-0.2 rounded-md">
                          Anda
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{u.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                            : u.role === 'MANAGER'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {u.role}
                      </span>
                      {allVendorsMode && (
                        <VendorBadge vendorId={u.vendorId} />
                      )}
                      <span className="text-[10px] text-stone-400 font-mono">
                        PIN: {u.pin || '••••'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {currentUser?.role === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetUserForPin({
                          email: u.email,
                          name: u.name,
                          role: u.role,
                          vendorName: u.vendorId
                        });
                        setShowAdminSendPinModal(true);
                      }}
                      className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-400 transition-colors"
                      title="Kirim Password / PIN Baru ke Email Pengguna"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(u)}
                    className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
                    title="Edit / Reset Password"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!isSelf && (
                    <button
                      type="button"
                      onClick={() => setUserToDelete(u)}
                      className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 transition-colors"
                      title="Hapus Pengguna"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <h3 className="font-bold text-base font-heading">{t('addUser')}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Sarah Jenkins"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="sarah@beverage.com"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    Role Akun
                  </label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent font-semibold"
                  >
                    <option value="CASHIER">CASHIER (Kasir)</option>
                    <option value="MANAGER">MANAGER (Pengelola)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    PIN Kasir (6 Digit)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.pin}
                    onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="123456"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  Password Awal (Min 6 Karakter)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Password123!"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs"
              >
                {t('cancelBtn')}
              </button>
              <button
                type="submit"
                className="py-2.5 rounded-xl bg-accent text-white font-bold text-xs shadow-sm hover:opacity-95"
              >
                {t('saveUser')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User & Reset Password Modal */}
      {showEditModal && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          <form
            onSubmit={handleUpdateUser}
            className="w-full max-w-md bg-white dark:bg-[#251e1c] rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <h3 className="font-bold text-base font-heading">Edit Pengguna: {selectedUser.name}</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  Nama
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent font-semibold"
                  >
                    <option value="CASHIER">CASHIER</option>
                    <option value="MANAGER">MANAGER</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    PIN Kasir (6 Digit)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.pin}
                    onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="123456"
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/40">
                <label className="font-semibold text-stone-800 dark:text-stone-200 block mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-accent" />
                  Reset Password Pengguna
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Isi jika ingin mereset password baru"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs"
              >
                {t('cancelBtn')}
              </button>
              <button
                type="submit"
                className="py-2.5 rounded-xl bg-accent text-white font-bold text-xs shadow-sm hover:opacity-95"
              >
                Perbarui Pengguna
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!userToDelete}
        title={t('confirmDeleteTitle')}
        message={`Apakah Anda yakin ingin menghapus akun ${userToDelete?.name} (${userToDelete?.email})?`}
        confirmText={t('deleteUser')}
        confirmVariant="danger"
        onConfirm={handleDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />

      {/* Admin Send PIN Modal */}
      {targetUserForPin && (
        <AdminSendPinModal
          isOpen={showAdminSendPinModal}
          onClose={() => {
            setShowAdminSendPinModal(false);
            setTargetUserForPin(null);
          }}
          targetUser={targetUserForPin}
          token={token}
          onSuccess={() => {
            fetchUsers();
            fetchPinResetRequests();
          }}
        />
      )}
    </div>
  );
};
