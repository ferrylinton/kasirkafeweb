import React, { useState, useRef } from 'react';
import {
  UserCheck,
  Shield,
  KeyRound,
  Image as ImageIcon,
  Save,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Camera,
  Upload,
  Check,
  Trash2,
  Sparkles,
  FolderOpen,
  RefreshCw,
  Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { LoginHistoryView } from '../security/LoginHistoryView';

interface AvatarPreset {
  id: string;
  name: string;
  url: string;
  category: 'barista' | 'art';
}

const AVATAR_PRESETS: AvatarPreset[] = [
  // Realistic Barista Portraits
  {
    id: 'b1',
    name: 'Sarah (Barista)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80',
    category: 'barista'
  },
  {
    id: 'b2',
    name: 'David (Store Lead)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=250&auto=format&fit=crop&q=80',
    category: 'barista'
  },
  {
    id: 'b3',
    name: 'Ayu (Cashier)',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=250&auto=format&fit=crop&q=80',
    category: 'barista'
  },
  {
    id: 'b4',
    name: 'Ferry (Manager)',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=250&auto=format&fit=crop&q=80',
    category: 'barista'
  },
  {
    id: 'b5',
    name: 'Clara (Specialist)',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=250&auto=format&fit=crop&q=80',
    category: 'barista'
  },
  {
    id: 'b6',
    name: 'Rian (Head Roaster)',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=250&auto=format&fit=crop&q=80',
    category: 'barista'
  },
  // Fun Illustrated & Art Avatars
  {
    id: 'a1',
    name: 'Espresso Bot',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=EspressoMaster&backgroundColor=ffd5dc,b6e3f4,c0aede,d1d4f9',
    category: 'art'
  },
  {
    id: 'a2',
    name: 'Cafe Hero',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=CafeHero&backgroundColor=ffdfbf,ffd5dc,d1d4f9',
    category: 'art'
  },
  {
    id: 'a3',
    name: 'Latte Artist',
    url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=LatteArt&backgroundColor=b6e3f4,c0aede,d1d4f9',
    category: 'art'
  },
  {
    id: 'a4',
    name: 'Cool Brewer',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=CoolBarista&backgroundColor=c0aede,ffd5dc,ffdfbf',
    category: 'art'
  },
  {
    id: 'a5',
    name: 'Happy Cashier',
    url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=HappyCashier&backgroundColor=ffd5dc,ffdfbf',
    category: 'art'
  },
  {
    id: 'a6',
    name: 'Coffee Master',
    url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=CoffeeBrewer&backgroundColor=b6e3f4,d1d4f9',
    category: 'art'
  }
];

export const ProfileScreen: React.FC = () => {
  const { user, updateUserProfile, logout } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'PROFILE' | 'LOGIN_HISTORY'>('PROFILE');
  const [name, setName] = useState<string>(user?.name || '');
  const [avatar, setAvatar] = useState<string>(user?.avatar || '');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);

  // Avatar Management State
  const [avatarMode, setAvatarMode] = useState<'PRESET' | 'UPLOAD' | 'URL'>('PRESET');
  const [avatarCategory, setAvatarCategory] = useState<'ALL' | 'barista' | 'art'>('ALL');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarSectionRef = useRef<HTMLDivElement>(null);

  // Filtered avatar presets
  const filteredPresets = AVATAR_PRESETS.filter(p => {
    if (avatarCategory === 'ALL') return true;
    return p.category === avatarCategory;
  });

  // Client-side image processing (Center-crop square to max 320x320 and compress)
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('INVALID_TYPE'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('FILE_TOO_LARGE'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const size = 320;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(e.target?.result as string);
              return;
            }

            // Smooth image rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Center square crop calculations
            const minDim = Math.min(img.width, img.height);
            const startX = (img.width - minDim) / 2;
            const startY = (img.height - minDim) / 2;

            ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            resolve(dataUrl);
          } catch (err) {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error('LOAD_ERROR'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('READ_ERROR'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessingFile(true);
    try {
      const dataUrl = await processImageFile(file);
      setAvatar(dataUrl);
      showToast(t('photoUploadedSuccess'), 'success');
    } catch (err: any) {
      if (err.message === 'FILE_TOO_LARGE') {
        showToast(t('photoInvalidSize'), 'error');
      } else if (err.message === 'INVALID_TYPE') {
        showToast(t('photoInvalidType'), 'error');
      } else {
        showToast('Gagal memproses file foto.', 'error');
      }
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar('');
    showToast('Foto profil dihapus.', 'info');
  };

  const scrollToAvatarSection = () => {
    avatarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      showToast('Konfirmasi password baru tidak cocok.', 'error');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleSaveProfile = async () => {
    setShowConfirmModal(false);
    setIsSaving(true);

    const payload: any = { name, avatar };
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    const res = await updateUserProfile(payload);
    setIsSaving(false);

    if (res.success) {
      showToast(t('profileSuccessToast'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      showToast(res.message || 'Gagal memperbarui profil.', 'error');
    }
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-2xl mx-auto flex flex-col gap-5">
      {/* 1. Header */}
      <div className="pb-3 border-b border-stone-200/80 dark:border-stone-800">
        <h2 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100">
          {t('myProfile')}
        </h2>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Kelola informasi akun staf, foto avatar, kredensial login, dan keamanan sesi
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200/80 dark:border-stone-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('PROFILE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'PROFILE'
              ? 'bg-accent text-white shadow-xs'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Profil & Kredensial</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('LOGIN_HISTORY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'LOGIN_HISTORY'
              ? 'bg-accent text-white shadow-xs'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{t('loginHistoryTitle')}</span>
        </button>
      </div>

      {activeTab === 'LOGIN_HISTORY' ? (
        <LoginHistoryView />
      ) : (
        <>
          {/* 2. User Identity Card with Interactive Avatar Badge */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs flex items-center gap-4">
            <div className="relative group shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-stone-100 dark:bg-stone-800 border-2 border-accent/40 shadow-xs flex items-center justify-center">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name || user?.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-accent text-white font-bold text-2xl">
                    {(name || user?.name)?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              {/* Floating Camera Button on Avatar */}
              <button
                type="button"
                onClick={scrollToAvatarSection}
                title="Ganti Foto Profil / Avatar"
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-accent text-white shadow-md hover:scale-110 active:scale-95 transition-all border-2 border-white dark:border-[#251e1c]"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100 font-heading truncate">
                  {name || user?.name}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    user?.role === 'MANAGER'
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {user?.role}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">{user?.email}</p>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-stone-400 flex-wrap">
                <span>PIN Kasir: <strong className="text-stone-700 dark:text-stone-300">{user?.pin ? '••••••' : 'Belum disetel'}</strong></span>
                <span className="text-stone-300 dark:text-stone-700">•</span>
                <button
                  type="button"
                  onClick={scrollToAvatarSection}
                  className="text-accent hover:underline font-semibold"
                >
                  {avatar ? 'Ubah Avatar / Foto' : '+ Pasang Avatar / Foto'}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* SECTION A: Photo & Avatar Selector */}
            <div
              ref={avatarSectionRef}
              className="p-5 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-accent" />
                    Foto & Avatar Profil
                  </span>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Pilih avatar kartun/barista atau unggah foto asli Anda
                  </p>
                </div>

                {avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="text-[11px] text-red-500 hover:text-red-700 dark:hover:text-red-400 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t('removePhoto')}</span>
                  </button>
                )}
              </div>

              {/* Segmented Mode Selector */}
              <div className="grid grid-cols-3 p-1 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 text-xs">
                <button
                  type="button"
                  onClick={() => setAvatarMode('PRESET')}
                  className={`py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                    avatarMode === 'PRESET'
                      ? 'bg-white dark:bg-[#251e1c] text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span className="truncate">{t('chooseAvatar')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAvatarMode('UPLOAD')}
                  className={`py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                    avatarMode === 'UPLOAD'
                      ? 'bg-white dark:bg-[#251e1c] text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 text-accent" />
                  <span className="truncate">{t('uploadPhoto')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAvatarMode('URL')}
                  className={`py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                    avatarMode === 'URL'
                      ? 'bg-white dark:bg-[#251e1c] text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-accent" />
                  <span className="truncate">URL Link</span>
                </button>
              </div>

              {/* MODE 1: Curated Avatar Presets */}
              {avatarMode === 'PRESET' && (
                <div className="space-y-3 pt-1">
                  {/* Category Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAvatarCategory('ALL')}
                      className={`px-3 py-1 rounded-full font-semibold transition-all whitespace-nowrap ${
                        avatarCategory === 'ALL'
                          ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                          : 'bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                      }`}
                    >
                      Semua ({AVATAR_PRESETS.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarCategory('barista')}
                      className={`px-3 py-1 rounded-full font-semibold transition-all whitespace-nowrap ${
                        avatarCategory === 'barista'
                          ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                          : 'bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                      }`}
                    >
                      {t('avatarCategoryBarista')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarCategory('art')}
                      className={`px-3 py-1 rounded-full font-semibold transition-all whitespace-nowrap ${
                        avatarCategory === 'art'
                          ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                          : 'bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                      }`}
                    >
                      {t('avatarCategoryArt')}
                    </button>
                  </div>

                  {/* Avatars Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {filteredPresets.map(preset => {
                      const isSelected = avatar === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setAvatar(preset.url);
                            showToast(`Avatar "${preset.name}" dipilih!`, 'info');
                          }}
                          className={`relative group flex flex-col items-center p-2 rounded-2xl transition-all ${
                            isSelected
                              ? 'bg-orange-50/80 dark:bg-orange-950/40 ring-2 ring-accent scale-102 shadow-xs'
                              : 'bg-stone-50 dark:bg-stone-900/60 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/60 dark:border-stone-800'
                          }`}
                        >
                          <div className="w-14 h-14 rounded-full overflow-hidden bg-stone-200 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-2xs relative">
                            <img
                              src={preset.url}
                              alt={preset.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-accent/30 flex items-center justify-center">
                                <div className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center shadow-xs">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-stone-700 dark:text-stone-300 mt-1.5 text-center truncate w-full">
                            {preset.name.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MODE 2: Upload Photo (Drag & Drop + File Picker) */}
              {avatarMode === 'UPLOAD' && (
                <div className="space-y-3 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                      isDragging
                        ? 'border-accent bg-orange-50/50 dark:bg-orange-950/20 scale-101'
                        : 'border-stone-300 dark:border-stone-700 hover:border-accent dark:hover:border-accent bg-stone-50/60 dark:bg-stone-900/40 hover:bg-stone-50 dark:hover:bg-stone-900'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                      isDragging
                        ? 'bg-accent text-white scale-110'
                        : 'bg-orange-100 dark:bg-orange-950/60 text-accent'
                    }`}>
                      {isProcessingFile ? (
                        <RefreshCw className="w-6 h-6 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6" />
                      )}
                    </div>

                    <div>
                      <p className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-200">
                        {isDragging ? 'Lepaskan gambar di sini' : t('dragDropPhoto')}
                      </p>
                      <p className="text-[11px] text-stone-400 mt-1 max-w-sm mx-auto">
                        Mendukung format JPG, PNG, WebP hingga 5MB. Gambar otomatis dipotong persegi dengan resolusi tajam.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessingFile}
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-xs font-bold shadow-xs hover:bg-stone-100 flex items-center gap-1.5 mt-1"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-accent" />
                      <span>{isProcessingFile ? 'Memproses...' : 'Pilih File dari Komputer/HP'}</span>
                    </button>
                  </div>

                  {/* Active Upload Preview Card */}
                  {avatar && (
                    <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={avatar}
                          alt="Preview"
                          className="w-11 h-11 rounded-full object-cover border border-stone-300 dark:border-stone-700"
                        />
                        <div>
                          <div className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                            <span>Foto Aktif Terpasang</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          </div>
                          <div className="text-[11px] text-stone-400">Siap disimpan ke profil Anda</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-300/70 transition-colors"
                        >
                          Ganti
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title="Hapus foto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 3: Direct URL Link */}
              {avatarMode === 'URL' && (
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block">
                    {t('avatarUrl')}
                  </label>
                  <div className="relative">
                    <ImageIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="url"
                      value={avatar}
                      onChange={e => setAvatar(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Masukkan URL gambar langsung yang dapat diakses publik via HTTPS.
                  </p>
                </div>
              )}
            </div>

            {/* SECTION B: Basic Information */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 block">
                Informasi Dasar
              </span>

              <div>
                <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  {t('displayName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  Email Akun (Login)
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 text-xs text-stone-500 cursor-not-allowed"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Email akun tidak dapat diubah sendiri. Hubungi manajer toko untuk perubahan email.
                </span>
              </div>
            </div>

            {/* SECTION C: Change Password */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-accent" />
                Ganti Password Pribadi
              </span>
              <p className="text-[11px] text-stone-400">
                Kosongkan bidang ini jika Anda tidak ingin mengganti password.
              </p>

              <div>
                <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  {t('currentPassword')}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan password lama"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    {t('newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                    Konfirmasi Password Baru
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 rounded-2xl bg-accent text-white font-bold text-xs shadow-md hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : t('saveProfile')}</span>
            </button>
          </form>

          {/* Logout Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="w-full py-3 rounded-2xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('logout')}</span>
            </button>
          </div>
        </>
      )}

      {/* Confirmation Dialog before saving */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        title="Simpan Perubahan Profil"
        message="Apakah Anda yakin ingin menyimpan perubahan informasi akun Anda?"
        confirmText="Simpan"
        confirmVariant="primary"
        onConfirm={handleSaveProfile}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* Confirmation Dialog before logout */}
      <ConfirmationModal
        isOpen={showLogoutModal}
        title={t('confirmLogoutTitle')}
        message={t('confirmLogoutMessage')}
        confirmText={t('logout')}
        confirmVariant="danger"
        onConfirm={() => {
          setShowLogoutModal(false);
          logout();
        }}
        onCancel={() => setShowLogoutModal(false)}
      />
    </div>
  );
};
