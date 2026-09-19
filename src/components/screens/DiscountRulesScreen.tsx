import React, { useState, useEffect } from 'react';
import { 
  Tag, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Filter, 
  Sparkles, 
  X, 
  Percent, 
  DollarSign, 
  Coffee, 
  Cake, 
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DiscountRule } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { ConfirmationModal } from '../common/ConfirmationModal';

export const DiscountRulesScreen: React.FC = () => {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<DiscountRule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formType, setFormType] = useState<DiscountRule['type']>('MIN_SPEND');
  const [formThreshold, setFormThreshold] = useState<number>(50000);
  const [formRewardType, setFormRewardType] = useState<DiscountRule['rewardType']>('PERCENTAGE');
  const [formRewardValue, setFormRewardValue] = useState<number>(10);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  const fetchRules = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/discounts/rules');
      const data = await res.json();
      if (data.success && data.rules) {
        setRules(data.rules);
      }
    } catch (e) {
      showToast('Gagal memuat aturan diskon dari server.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const openCreateModal = () => {
    setEditingRule(null);
    setFormCode('');
    setFormName('');
    setFormDescription('');
    setFormType('MIN_SPEND');
    setFormThreshold(50000);
    setFormRewardType('PERCENTAGE');
    setFormRewardValue(10);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: DiscountRule) => {
    setEditingRule(rule);
    setFormCode(rule.code);
    setFormName(rule.name);
    setFormDescription(rule.description || '');
    setFormType(rule.type);
    setFormThreshold(rule.threshold || 0);
    setFormRewardType(rule.rewardType);
    setFormRewardValue(rule.rewardValue || 0);
    setFormIsActive(rule.isActive !== false);
    setIsModalOpen(true);
  };

  const handleToggleRule = async (rule: DiscountRule) => {
    const updatedStatus = !rule.isActive;
    const ruleTargetId = rule.id || rule.code;

    try {
      const res = await fetch(`/api/discounts/rules/${ruleTargetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({ isActive: updatedStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `Aturan "${rule.name}" sekarang ${updatedStatus ? 'AKTIF' : 'NON-AKTIF'}!`,
          'success'
        );
        setRules(prev =>
          prev.map(r => ((r.id && r.id === rule.id) || r.code === rule.code ? { ...r, isActive: updatedStatus } : r))
        );
      } else {
        showToast(data.error || 'Gagal mengubah status aturan.', 'error');
      }
    } catch (err) {
      showToast('Koneksi server gagal.', 'error');
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCode.trim()) {
      showToast('Kode aturan tidak boleh kosong!', 'error');
      return;
    }
    if (!formName.trim()) {
      showToast('Nama promo tidak boleh kosong!', 'error');
      return;
    }

    const formattedCode = formCode.trim().toUpperCase().replace(/\s+/g, '_');

    setIsSubmitting(true);
    try {
      const payload = {
        code: formattedCode,
        name: formName.trim(),
        description: formDescription.trim(),
        type: formType,
        threshold: Number(formThreshold) || 0,
        rewardType: formRewardType,
        rewardValue: Number(formRewardValue) || 0,
        isActive: formIsActive
      };

      if (editingRule) {
        // UPDATE (PUT)
        const targetId = editingRule.id || editingRule.code;
        const res = await fetch(`/api/discounts/rules/${targetId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          showToast(`Aturan "${payload.name}" berhasil diperbarui!`, 'success');
          setRules(prev =>
            prev.map(r =>
              (r.id && r.id === editingRule.id) || r.code === editingRule.code
                ? { ...r, ...payload, id: r.id || targetId }
                : r
            )
          );
          setIsModalOpen(false);
        } else {
          showToast(data.error || 'Gagal memperbarui aturan diskon.', 'error');
        }
      } else {
        // CREATE (POST)
        const res = await fetch('/api/discounts/rules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success && data.rule) {
          showToast(`Aturan diskon "${data.rule.name}" berhasil dibuat!`, 'success');
          setRules(prev => [data.rule, ...prev]);
          setIsModalOpen(false);
        } else {
          showToast(data.error || 'Gagal membuat aturan diskon baru.', 'error');
        }
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi ke server.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;

    const targetId = deletingRule.id || deletingRule.code;
    try {
      const res = await fetch(`/api/discounts/rules/${targetId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Aturan "${deletingRule.name}" berhasil dihapus!`, 'success');
        setRules(prev =>
          prev.filter(r => !(r.id && r.id === deletingRule.id) && r.code !== deletingRule.code)
        );
        setDeletingRule(null);
      } else {
        showToast(data.error || 'Gagal menghapus aturan.', 'error');
      }
    } catch (e) {
      showToast('Koneksi server gagal saat menghapus aturan.', 'error');
    }
  };

  // Filtered rules
  const filteredRules = rules.filter(r => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
        ? r.isActive !== false
        : r.isActive === false;

    const matchesType = typeFilter === 'ALL' ? true : r.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const totalRulesCount = rules.length;
  const activeRulesCount = rules.filter(r => r.isActive !== false).length;
  const inactiveRulesCount = totalRulesCount - activeRulesCount;

  // Render reward icon based on rewardType
  const renderRewardIcon = (rewardType: DiscountRule['rewardType']) => {
    switch (rewardType) {
      case 'PERCENTAGE':
        return <Percent className="w-4 h-4 text-emerald-500" />;
      case 'FIXED_AMOUNT':
        return <DollarSign className="w-4 h-4 text-blue-500" />;
      case 'FREE_SNACK':
        return <ShoppingBag className="w-4 h-4 text-amber-500" />;
      case 'FREE_DRINK_OR_SNACK':
      default:
        return <Coffee className="w-4 h-4 text-accent" />;
    }
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-5xl mx-auto flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100">
              {t('discountRulesTitle')}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              {t('roleManager')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            {t('discountRulesSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchRules(true)}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center justify-center transition-colors disabled:opacity-50"
            title="Muat Ulang Aturan"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-accent' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white font-bold text-xs sm:text-sm shadow-xs hover:opacity-95 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addDiscountRule')}</span>
          </button>
        </div>
      </div>

      {/* Metrics Bento Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block">
            {t('totalRulesCard')}
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-heading mt-0.5">
            {totalRulesCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
              {t('activeRulesCard')}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-heading mt-0.5">
            {activeRulesCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
          <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block">
            {t('inactiveRulesCard')}
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-stone-500 dark:text-stone-400 font-heading mt-0.5">
            {inactiveRulesCount}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-50 dark:bg-stone-900/40 p-2.5 rounded-2xl border border-stone-200/80 dark:border-stone-800">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('searchRulesPlaceholder')}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-accent/20 text-stone-900 dark:text-stone-100"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          {/* Status filter tabs */}
          <div className="flex bg-stone-200/70 dark:bg-stone-800 p-0.5 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white dark:bg-[#251e1c] text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                  : 'hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                statusFilter === 'ACTIVE'
                  ? 'bg-white dark:bg-[#251e1c] text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                  : 'hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                statusFilter === 'INACTIVE'
                  ? 'bg-white dark:bg-[#251e1c] text-stone-500 shadow-2xs font-bold'
                  : 'hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Non-Aktif
            </button>
          </div>

          {/* Type dropdown filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-700 py-1.5 px-2.5 rounded-xl text-stone-700 dark:text-stone-300 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
          >
            <option value="ALL">Semua Syarat</option>
            <option value="MIN_SPEND">Min. Belanja</option>
            <option value="QUANTITY_THRESHOLD">Min. Jumlah Item</option>
            <option value="BIRTHDAY">Ulang Tahun</option>
            <option value="CUSTOM">Kustom / Spesial</option>
          </select>
        </div>
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="py-16 text-center text-stone-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm font-medium">Memuat aturan diskon...</p>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-[#251e1c] rounded-3xl border border-dashed border-stone-300 dark:border-stone-800 p-8 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center">
            <Tag className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-stone-800 dark:text-stone-200 text-base">
            {t('noRulesFound')}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm">
            {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'Coba ganti kata kunci pencarian atau ubah filter status di atas.'
              : 'Belum ada aturan diskon yang ditambahkan. Klik tombol Tambah Aturan Diskon untuk membuat promo baru.'}
          </p>
          {(searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
              }}
              className="text-xs font-bold text-accent hover:underline mt-1"
            >
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredRules.map(rule => {
            const isDefaultRule = [
              'BUY_5_FREE_1_SNACK',
              'BUY_10_FREE_1_DRINK_OR_SNACK',
              'SPEND_100K_FREE_ITEM',
              'BIRTHDAY_REWARD'
            ].includes(rule.code);

            return (
              <div
                key={rule.id || rule.code}
                className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                  rule.isActive
                    ? 'bg-white dark:bg-[#251e1c] border-stone-200/80 dark:border-stone-800 shadow-2xs'
                    : 'bg-stone-50 dark:bg-stone-900/30 border-dashed border-stone-300 dark:border-stone-800 opacity-70'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: Icon & Info */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        rule.isActive
                          ? 'bg-orange-100 dark:bg-orange-950/60 text-accent shadow-xs'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-400'
                      }`}
                    >
                      {rule.type === 'BIRTHDAY' ? (
                        <Cake className="w-5 h-5" />
                      ) : (
                        renderRewardIcon(rule.rewardType)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-base sm:text-lg text-stone-900 dark:text-stone-100 font-heading">
                          {rule.name}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                          {rule.code}
                        </span>
                        {isDefaultRule && (
                          <span className="px-1.5 py-0.2 rounded-md text-[9px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                            Sistem
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                        {rule.description}
                      </p>

                      {/* Detail Badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px]">
                        {/* Requirement Badge */}
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 font-medium">
                          <span className="text-stone-400">Syarat:</span>
                          <span className="font-bold">
                            {rule.type === 'MIN_SPEND' && `Min. Belanja Rp ${(rule.threshold || 0).toLocaleString('id-ID')}`}
                            {rule.type === 'QUANTITY_THRESHOLD' && `Min. ${rule.threshold || 0} Minuman`}
                            {rule.type === 'BIRTHDAY' && 'Ulang Tahun Hari/Bulan Ini'}
                            {rule.type === 'CUSTOM' && (rule.threshold ? `Batas ${rule.threshold}` : 'Promo Khusus')}
                          </span>
                        </div>

                        {/* Reward Badge */}
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-accent font-medium border border-orange-200/50 dark:border-orange-800/40">
                          <span className="opacity-80">Hadiah:</span>
                          <span className="font-bold">
                            {rule.rewardType === 'PERCENTAGE' && `Diskon ${rule.rewardValue}%`}
                            {rule.rewardType === 'FIXED_AMOUNT' && `Potongan Rp ${(rule.rewardValue || 0).toLocaleString('id-ID')}`}
                            {rule.rewardType === 'FREE_SNACK' && `Gratis 1 Snack (maks. Rp ${(rule.rewardValue || 20000).toLocaleString('id-ID')})`}
                            {rule.rewardType === 'FREE_DRINK_OR_SNACK' && `Gratis 1 Kopi/Snack (maks. Rp ${(rule.rewardValue || 28000).toLocaleString('id-ID')})`}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            rule.isActive
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : 'bg-stone-200 dark:bg-stone-800 text-stone-500'
                          }`}
                        >
                          {rule.isActive ? 'Aktif di Kasir' : 'Non-Aktif'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions & Switch */}
                  <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-800/80 shrink-0">
                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => openEditModal(rule)}
                      className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors"
                      title={t('editDiscountRule')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setDeletingRule(rule)}
                      className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 transition-colors"
                      title={t('deleteDiscountRule')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Status Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleRule(rule)}
                      className={`w-12 h-7 rounded-full transition-colors relative shrink-0 p-0.5 ml-1 ${
                        rule.isActive ? 'bg-accent' : 'bg-stone-300 dark:bg-stone-700'
                      }`}
                      title={rule.isActive ? 'Klik untuk non-aktifkan' : 'Klik untuk aktifkan'}
                    >
                      <div
                        className={`w-6 h-6 rounded-full bg-white shadow-xs transition-transform ${
                          rule.isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create / Edit Discount Rule */}
      <AnimatePresence>
        {isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            style={{
              paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#251e1c] p-6 shadow-2xl border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 flex flex-col gap-4"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-accent flex items-center justify-center">
                    {editingRule ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-heading">
                      {editingRule ? t('editDiscountRule') : t('addDiscountRule')}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {editingRule ? 'Perbarui rincian syarat & hadiah promo' : 'Buat aturan diskon otomatis baru'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveRule} className="space-y-4 text-xs sm:text-sm">
                {/* Rule Code & Name in 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      {t('ruleCodeLabel')} *
                    </label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={e => setFormCode(e.target.value.toUpperCase())}
                      placeholder={t('ruleCodePlaceholder')}
                      disabled={Boolean(editingRule)}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
                      required
                    />
                    <span className="text-[10px] text-stone-400 mt-0.5 block">
                      Hanya huruf besar, angka, dan underscore
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      {t('ruleNameLabel')} *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder={t('ruleNamePlaceholder')}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
                      required
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    {t('ruleDescLabel')} *
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder={t('ruleDescPlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-accent/20 resize-none"
                    required
                  />
                </div>

                {/* Condition Type & Threshold in 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      {t('ruleTypeLabel')}
                    </label>
                    <select
                      value={formType}
                      onChange={e => setFormType(e.target.value as DiscountRule['type'])}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
                    >
                      <option value="MIN_SPEND">Minimal Total Belanja (Rp)</option>
                      <option value="QUANTITY_THRESHOLD">Minimal Jumlah Minuman</option>
                      <option value="BIRTHDAY">Ulang Tahun Pelanggan</option>
                      <option value="CUSTOM">Promo Bebas / Kustom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      {formType === 'MIN_SPEND'
                        ? 'Minimal Belanja (Rp)'
                        : formType === 'QUANTITY_THRESHOLD'
                        ? 'Minimal Jumlah Minuman (Cup)'
                        : t('ruleThresholdLabel')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formThreshold}
                      onChange={e => setFormThreshold(Number(e.target.value))}
                      disabled={formType === 'BIRTHDAY'}
                      placeholder={formType === 'MIN_SPEND' ? '50000' : '5'}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-accent/20 disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Reward Type & Value in 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      {t('rewardTypeLabel')}
                    </label>
                    <select
                      value={formRewardType}
                      onChange={e => setFormRewardType(e.target.value as DiscountRule['rewardType'])}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
                    >
                      <option value="PERCENTAGE">Diskon Persentase (%)</option>
                      <option value="FIXED_AMOUNT">Potongan Nominal Tetap (Rp)</option>
                      <option value="FREE_SNACK">Gratis 1 Cemilan / Snek</option>
                      <option value="FREE_DRINK_OR_SNACK">Gratis 1 Minuman / Snek</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      {formRewardType === 'PERCENTAGE'
                        ? 'Nilai Diskon (%)'
                        : formRewardType === 'FIXED_AMOUNT'
                        ? 'Nominal Potongan (Rp)'
                        : 'Batas Maksimal Harga Item (Rp)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={formRewardType === 'PERCENTAGE' ? 100 : undefined}
                      value={formRewardValue}
                      onChange={e => setFormRewardValue(Number(e.target.value))}
                      placeholder={formRewardType === 'PERCENTAGE' ? '10' : '20000'}
                      className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 focus:outline-hidden focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                </div>

                {/* Active Switch */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60">
                  <div>
                    <span className="font-bold text-stone-800 dark:text-stone-200 block">
                      {t('ruleActiveLabel')}
                    </span>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">
                      {t('ruleActiveHelp')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`w-12 h-7 rounded-full transition-colors relative shrink-0 p-0.5 ${
                      formIsActive ? 'bg-accent' : 'bg-stone-300 dark:bg-stone-700'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-white shadow-xs transition-transform ${
                        formIsActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Form Buttons */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    {t('cancelBtn')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2.5 rounded-xl bg-accent text-white font-bold shadow-xs hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Menyimpan...' : t('saveRuleBtn')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deletingRule)}
        title={t('deleteRuleConfirmTitle')}
        message={`Apakah Anda yakin ingin menghapus aturan promo "${deletingRule?.name}" (${deletingRule?.code})? Tindakan ini tidak dapat dibatalkan.`}
        confirmText={t('deleteDiscountRule')}
        cancelText={t('cancelBtn')}
        confirmVariant="danger"
        onConfirm={handleDeleteRule}
        onCancel={() => setDeletingRule(null)}
      />
    </div>
  );
};
