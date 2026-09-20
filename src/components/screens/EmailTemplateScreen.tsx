import React, { useState, useEffect } from 'react';
import { Mail, Code, Eye, Save, Sparkles, CheckCircle2, Layers } from 'lucide-react';
import { EmailTemplate } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../common/Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { AdminAllVendorsHeader, VendorBadge } from '../common/AdminAllVendorsHeader';

interface EmailTemplateScreenProps {
  allVendorsMode?: boolean;
}

export const EmailTemplateScreen: React.FC<EmailTemplateScreenProps> = ({ allVendorsMode = false }) => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  // Role Rule: Role ADMIN hanya bisa melihat Template Email (Read-Only), tidak bisa menambah, mengubah, dan menghapus.
  const isReadOnly = user?.role === 'ADMIN' || (allVendorsMode && user?.role !== 'MANAGER' && user?.role !== 'SUPERADMIN');

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState<string>('');
  const [bodyHtml, setBodyHtml] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const url = allVendorsMode
        ? (selectedVendor === 'all' ? '/api/templates?allVendors=true' : `/api/templates?vendorId=${selectedVendor}`)
        : '/api/templates';

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token || ''}` }
      });
      const data = await res.json();
      if (data.success && data.templates?.length > 0) {
        setTemplates(data.templates);
        setSelectedTemplate(data.templates[0]);
        setSubject(data.templates[0].subject);
        setBodyHtml(data.templates[0].bodyHtml);
      } else {
        setTemplates([]);
        setSelectedTemplate(null);
      }
    } catch (e) {
      console.warn('Failed to fetch email templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [token, allVendorsMode, selectedVendor]);

  const handleSelectTemplate = (tpl: EmailTemplate) => {
    setSelectedTemplate(tpl);
    setSubject(tpl.subject);
    setBodyHtml(tpl.bodyHtml);
  };

  const handleSave = async () => {
    if (isReadOnly) {
      showToast('Akses ditolak: Role ADMIN hanya memiliki hak akses melihat template email (Read-Only).', 'error');
      return;
    }

    if (!selectedTemplate) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({ subject, bodyHtml })
      });
      const data = await res.json();
      setIsSaving(false);
      if (data.success) {
        showToast('Template email berhasil disimpan!', 'success');
      } else {
        showToast(data.error || 'Gagal menyimpan template.', 'error');
      }
    } catch (err) {
      setIsSaving(false);
      showToast('Koneksi server gagal.', 'error');
    }
  };

  const getPreviewHtml = () => {
    return bodyHtml
      .replace(/{{orderNumber}}/g, '0142')
      .replace(/{{customerName}}/g, 'Kak Adelia')
      .replace(/{{cashierName}}/g, 'Sarah Jenkins')
      .replace(/{{date}}/g, new Date().toLocaleString('id-ID'))
      .replace(
        /{{itemsTable}}/g,
        `<table style="width: 100%; font-size: 13px;">
          <tr><td>Caramel Macchiato x1</td><td style="text-align:right">Rp 34.000</td></tr>
          <tr><td>Jasmine Green Tea x1</td><td style="text-align:right">Rp 22.000</td></tr>
        </table>`
      )
      .replace(/{{subtotal}}/g, 'Rp 56.000')
      .replace(/{{discount}}/g, 'Rp 0')
      .replace(/{{tax}}/g, 'Rp 5.600')
      .replace(/{{total}}/g, 'Rp 61.600')
      .replace(/{{paymentMethod}}/g, 'QRIS Instant')
      .replace(/{{change}}/g, 'Rp 0');
  };

  return (
    <div className="min-h-screen pt-safe-nav pb-safe-screen px-safe max-w-4xl mx-auto flex flex-col gap-5">
      {/* Header */}
      {allVendorsMode ? (
        <AdminAllVendorsHeader
          title={t('navAdminTemplates')}
          subtitle="Konfigurasi template email notifikasi struk dan keamanan untuk seluruh vendor jaringan"
          selectedVendor={selectedVendor}
          onVendorChange={setSelectedVendor}
          onRefresh={fetchTemplates}
          isLoading={loading}
          itemCount={templates.length}
          itemLabel="Template"
        />
      ) : (
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100">
                Template Email Struk (SMTP)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                Khusus Manager
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Format HTML dan variabel dinamis yang dikirim ke email pelanggan via SMTP
            </p>
          </div>

          {!isReadOnly ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="py-2.5 px-4 rounded-2xl bg-accent text-white font-bold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-2xs">
              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Lihat Saja (Read-Only)</span>
            </div>
          )}
        </div>
      )}

      {/* Read-Only Notice Banner for Role ADMIN */}
      {isReadOnly && (
        <div className="rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            <span className="font-bold text-stone-900 dark:text-stone-100">Hak Akses Role ADMIN: Mode Lihat (Read-Only)</span> — Administrator hanya memiliki izin untuk melihat format, susunan HTML, dan pratinjau template email struk/notifikasi. Penambahan, pengubahan, atau penghapusan template email dikelola secara eksklusif oleh role Manager.
          </div>
        </div>
      )}

      {/* Template Selector if multiple templates available */}
      {templates.length > 1 && (
        <div className="p-3 bg-white dark:bg-[#251e1c] border border-stone-200 dark:border-stone-800 rounded-2xl flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-stone-500 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-accent" />
            Pilih Template:
          </span>
          {templates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => handleSelectTemplate(tpl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                selectedTemplate?.id === tpl.id
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
              }`}
            >
              <span>{tpl.name || tpl.type}</span>
              {allVendorsMode && (
                <VendorBadge vendorId={tpl.vendorId} />
              )}
            </button>
          ))}
        </div>
      )}

      {selectedTemplate && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-500">Template Aktif:</span>
            <span className="text-xs font-bold text-stone-800 dark:text-stone-200">{selectedTemplate.name || selectedTemplate.type}</span>
            {allVendorsMode && (
              <VendorBadge vendorId={selectedTemplate.vendorId} />
            )}
          </div>
          {allVendorsMode && (
            !isReadOnly ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="py-1.5 px-3 rounded-xl bg-accent text-white font-bold text-xs shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 text-xs font-medium">
                <Eye className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px]">Mode Pratinjau (Read-Only)</span>
              </div>
            )
          )}
        </div>
      )}

      {/* Subject Input */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-stone-600 dark:text-stone-400">
            Subject Email
          </label>
          {isReadOnly && (
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Eye className="w-3 h-3" />
              Read-Only
            </span>
          )}
        </div>
        <input
          type="text"
          value={subject}
          onChange={e => !isReadOnly && setSubject(e.target.value)}
          readOnly={isReadOnly}
          className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none transition-colors ${
            isReadOnly
              ? 'bg-stone-100/80 dark:bg-stone-900/60 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 cursor-default'
              : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 focus:ring-2 focus:ring-accent'
          }`}
        />
      </div>

      {/* Editor & Preview Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          Isi Template Email (HTML)
        </span>
        <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setPreviewMode(false)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              !previewMode ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-2xs' : 'text-stone-500'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Kode HTML</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode(true)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              previewMode ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-2xs' : 'text-stone-500'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Pratinjau Nyata</span>
          </button>
        </div>
      </div>

      {/* Editor or Preview Container */}
      {!previewMode ? (
        <div className="space-y-2">
          <textarea
            value={bodyHtml}
            onChange={e => !isReadOnly && setBodyHtml(e.target.value)}
            readOnly={isReadOnly}
            rows={14}
            className={`w-full p-4 rounded-3xl font-mono text-xs leading-relaxed focus:outline-none shadow-inner ${
              isReadOnly
                ? 'bg-stone-900/90 text-stone-300 cursor-default select-text'
                : 'bg-stone-900 text-stone-100 focus:ring-2 focus:ring-accent'
            }`}
          />
          <div className="p-3 rounded-2xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/40 text-[11px] text-stone-700 dark:text-stone-300">
            <span className="font-bold text-accent block mb-1">Variabel Dinamis yang Tersedia:</span>
            <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
              {[
                '{{orderNumber}}',
                '{{customerName}}',
                '{{cashierName}}',
                '{{date}}',
                '{{itemsTable}}',
                '{{subtotal}}',
                '{{discount}}',
                '{{tax}}',
                '{{total}}',
                '{{paymentMethod}}',
                '{{change}}'
              ].map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 border border-orange-200 dark:border-orange-800 text-accent font-bold"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-sm overflow-hidden text-stone-900">
          <div
            dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
            className="email-preview-wrapper"
          />
        </div>
      )}
    </div>
  );
};
