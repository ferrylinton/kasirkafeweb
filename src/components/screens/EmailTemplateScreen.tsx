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
  const { token } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

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

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="py-2.5 px-4 rounded-2xl bg-accent text-white font-bold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
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
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="py-1.5 px-3 rounded-xl bg-accent text-white font-bold text-xs shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
            </button>
          )}
        </div>
      )}

      {/* Subject Input */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#251e1c] border border-stone-200/80 dark:border-stone-800 shadow-2xs">
        <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block mb-1">
          Subject Email
        </label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
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
            onChange={e => setBodyHtml(e.target.value)}
            rows={14}
            className="w-full p-4 rounded-3xl bg-stone-900 text-stone-100 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent shadow-inner"
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
