import React, { useState, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  FileText,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  X,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Layers,
  ChevronRight,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { Product } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../common/Toast';

export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  onSuccess: () => void;
}

export interface ParsedCsvRow {
  rowNumber: number;
  raw: Record<string, string>;
  id?: string;
  name: string;
  category?: string;
  subCategory?: string;
  price?: number;
  stock?: number;
  lowStockThreshold?: number;
  description?: string;
  image?: string;
  status: 'UPDATE' | 'NEW' | 'INVALID';
  matchedProduct?: Product;
  errors: string[];
}

// Robust CSV parser supporting quotes and auto-delimiters
function parseCsvContent(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Detect delimiter from first line (comma, semicolon, or tab)
  const firstLine = lines[0];
  let delimiter = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  }

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseLine(lines[0]);
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const parsed = parseLine(lines[i]);
    // Skip empty lines
    if (parsed.some(val => val.length > 0)) {
      rows.push(parsed);
    }
  }

  return { headers, rows };
}

// Normalize column header keys
function normalizeHeaderKey(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['name', 'nama', 'produk', 'namaproduk', 'product', 'item', 'title'].includes(h)) return 'name';
  if (['price', 'harga', 'hargasatuan', 'unitprice', 'cost', 'rp', 'hargajual'].includes(h)) return 'price';
  if (['stock', 'stok', 'qty', 'quantity', 'jumlah', 'count', 'stoksaatini'].includes(h)) return 'stock';
  if (['category', 'kategori', 'cat'].includes(h)) return 'category';
  if (['subcategory', 'subkategori', 'subkategori2', 'kelompok'].includes(h)) return 'subCategory';
  if (['threshold', 'lowstockthreshold', 'lowstock', 'minstock', 'batasstok', 'min', 'batikperingatan'].includes(h)) return 'lowStockThreshold';
  if (['description', 'deskripsi', 'keterangan', 'desc', 'detail'].includes(h)) return 'description';
  if (['id', 'productid', 'kode', 'sku', 'idproduk'].includes(h)) return 'id';
  if (['image', 'gambar', 'foto', 'photo', 'img'].includes(h)) return 'image';
  return h;
}

const SAMPLE_CSV_TEMPLATE = `Name,Category,Price,Stock,LowStockThreshold,Description
Espresso Latte,kopi,30000,45,12,Arabika premium dengan fresh milk lembut
Aren Cold Brew,kopi,28000,30,10,Cold brew 16 jam dengan gula aren asli
Matcha Latte Fusion,teh,32000,25,8,Uji matcha artisan dengan susu segar
Lemon Herb Tea,teh,22000,20,5,Teh herbal segar dengan perasan lemon asli
Dragon Fruit Smoothie,jus,27000,18,6,Jus buah naga merah segar dan madu
Croissant Cokelat Belgia,cemilan,24000,15,5,Pastry renyah dengan isian cokelat lumer
Almond Butter Cookie,cemilan,18000,20,8,Kue kering renyah dengan kacang almond panggang`;

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  existingProducts,
  onSuccess
}) => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'paste'>('upload');
  const [rawText, setRawText] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [stockMode, setStockMode] = useState<'set' | 'add'>('set');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'update' | 'new' | 'invalid'>('all');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Parse raw text into structured rows
  const parsedData = useMemo(() => {
    if (!rawText.trim()) return { headers: [], rows: [] as ParsedCsvRow[] };

    const { headers: rawHeaders, rows: rawRows } = parseCsvContent(rawText);
    const headerMap = rawHeaders.map(h => normalizeHeaderKey(h));

    const rows: ParsedCsvRow[] = rawRows.map((cols, idx) => {
      const rawObj: Record<string, string> = {};
      headerMap.forEach((key, colIdx) => {
        rawObj[key] = cols[colIdx] || '';
      });

      const errors: string[] = [];
      const name = (rawObj.name || '').trim();

      if (!name) {
        errors.push('Nama produk wajib diisi');
      }

      // Check price
      let price: number | undefined;
      if (rawObj.price !== undefined && rawObj.price.trim() !== '') {
        // Strip out 'Rp', '.', commas for currency formatting
        const cleanPriceStr = rawObj.price.replace(/[^0-9]/g, '');
        const pNum = Number(cleanPriceStr);
        if (isNaN(pNum) || pNum < 0) {
          errors.push('Harga harus berupa angka valid');
        } else {
          price = pNum;
        }
      }

      // Check stock
      let stock: number | undefined;
      if (rawObj.stock !== undefined && rawObj.stock.trim() !== '') {
        const sNum = Number(rawObj.stock.replace(/[^0-9-]/g, ''));
        if (isNaN(sNum)) {
          errors.push('Stok harus berupa angka');
        } else {
          stock = sNum;
        }
      }

      // Check threshold
      let lowStockThreshold: number | undefined;
      if (rawObj.lowStockThreshold !== undefined && rawObj.lowStockThreshold.trim() !== '') {
        const tNum = Number(rawObj.lowStockThreshold.replace(/[^0-9]/g, ''));
        if (!isNaN(tNum) && tNum >= 0) {
          lowStockThreshold = tNum;
        }
      }

      // Find match in existing products
      const rawId = rawObj.id ? rawObj.id.trim() : null;
      const matched = existingProducts.find(p => {
        if (rawId && p.id === rawId) return true;
        return p.name.toLowerCase().trim() === name.toLowerCase();
      });

      let status: 'UPDATE' | 'NEW' | 'INVALID' = 'NEW';
      if (errors.length > 0) {
        status = 'INVALID';
      } else if (matched) {
        status = 'UPDATE';
      } else {
        status = 'NEW';
      }

      return {
        rowNumber: idx + 2, // 1-based, skipping header
        raw: rawObj,
        id: rawId || undefined,
        name,
        category: rawObj.category ? rawObj.category.toLowerCase().trim() : undefined,
        subCategory: rawObj.subCategory ? rawObj.subCategory.trim() : undefined,
        price,
        stock,
        lowStockThreshold,
        description: rawObj.description ? rawObj.description.trim() : undefined,
        image: rawObj.image ? rawObj.image.trim() : undefined,
        status,
        matchedProduct: matched,
        errors
      };
    });

    return { headers: headerMap, rows };
  }, [rawText, existingProducts]);

  const updateCount = parsedData.rows.filter(r => r.status === 'UPDATE').length;
  const newCount = parsedData.rows.filter(r => r.status === 'NEW').length;
  const invalidCount = parsedData.rows.filter(r => r.status === 'INVALID').length;
  const validRows = parsedData.rows.filter(r => r.status !== 'INVALID');

  const filteredPreviewRows = useMemo(() => {
    if (previewFilter === 'update') return parsedData.rows.filter(r => r.status === 'UPDATE');
    if (previewFilter === 'new') return parsedData.rows.filter(r => r.status === 'NEW');
    if (previewFilter === 'invalid') return parsedData.rows.filter(r => r.status === 'INVALID');
    return parsedData.rows;
  }, [parsedData.rows, previewFilter]);

  // Handle file selection
  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string;
      setRawText(content || '');
    };
    reader.readAsText(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Download Sample CSV
  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_import_inventaris_sipspot.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Template CSV berhasil diunduh!', 'success');
  };

  // Export Current Products to CSV
  const handleExportCurrent = () => {
    if (existingProducts.length === 0) {
      showToast('Belum ada produk untuk diekspor', 'info');
      return;
    }

    const headers = ['ID', 'Name', 'Category', 'Price', 'Stock', 'LowStockThreshold', 'Description'];
    const rows = existingProducts.map(p => [
      `"${p.id}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.category || 'kopi'}"`,
      p.price,
      p.stock,
      p.lowStockThreshold ?? 10,
      `"${(p.description || '').replace(/"/g, '""')}"`
    ]);

    const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventaris_sipspot_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Data produk saat ini berhasil diekspor ke CSV!', 'success');
  };

  // Load sample text directly into textarea
  const handleLoadSample = () => {
    setRawText(SAMPLE_CSV_TEMPLATE);
    setSelectedFile(null);
    setActiveInputTab('paste');
    showToast('Contoh data CSV berhasil dimuat!', 'info');
  };

  // Submit parsed valid items to server
  const handleSubmitImport = async () => {
    if (validRows.length === 0) {
      showToast('Tidak ada baris data valid untuk diimpor', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        stockMode,
        items: validRows.map(r => ({
          id: r.id,
          name: r.name,
          category: r.category,
          subCategory: r.subCategory,
          price: r.price,
          stock: r.stock,
          lowStockThreshold: r.lowStockThreshold,
          description: r.description,
          image: r.image
        }))
      };

      const res = await fetch('/api/products/inventory/import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses import CSV');
      }

      showToast(
        data.message ||
          `Berhasil! ${data.summary?.updatedCount || updateCount} produk diperbarui, ${data.summary?.createdCount || newCount} produk baru ditambahkan.`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('CSV import error:', err);
      showToast(err.message || 'Terjadi kesalahan saat memproses import CSV', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#1f1917] border border-stone-200 dark:border-stone-800 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between shrink-0 bg-stone-50/50 dark:bg-stone-900/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold font-heading text-stone-900 dark:text-stone-100">
                  Import CSV Inventaris
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                  Manager
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Perbarui harga dan stok produk sekaligus, atau tambahkan produk baru dalam satu kali proses
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Quick Helper Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/70 dark:border-stone-800/70">
            <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
              <Info className="w-4 h-4 text-accent shrink-0" />
              <span>Format kolom: <strong>Name, Category, Price, Stock, LowStockThreshold, Description</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#2a2220] border border-stone-200 dark:border-stone-750 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                <span>Unduh Template CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportCurrent}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#2a2220] border border-stone-200 dark:border-stone-750 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors shadow-2xs"
                title="Ekspor daftar produk saat ini ke CSV untuk diedit"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                <span>Ekspor Data Saat Ini</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSample}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gunakan Contoh</span>
              </button>
            </div>
          </div>

          {/* Input Method Selector (Upload File vs Paste Text) */}
          <div>
            <div className="flex border-b border-stone-200 dark:border-stone-800 mb-4">
              <button
                type="button"
                onClick={() => setActiveInputTab('upload')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                  activeInputTab === 'upload'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah File CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveInputTab('paste')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                  activeInputTab === 'paste'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Tempel Teks CSV</span>
              </button>
            </div>

            {activeInputTab === 'upload' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                    isDragging
                      ? 'border-accent bg-accent/5 scale-[0.99]'
                      : selectedFile
                      ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-stone-300 dark:border-stone-750 hover:border-stone-400 dark:hover:border-stone-650 bg-stone-50/50 dark:bg-stone-900/20'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      selectedFile
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
                    }`}
                  >
                    {selectedFile ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                  </div>

                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Klik atau seret file lain untuk mengganti
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        Tarik & lepas file CSV di sini, atau <span className="text-accent underline">pilih file</span>
                      </p>
                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                        Mendukung file .csv atau .txt dengan pemisah koma (,) atau titik-koma (;)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder="Tempel baris data CSV di sini...&#10;Contoh:&#10;Name,Category,Price,Stock,LowStockThreshold&#10;Espresso Latte,kopi,30000,50,12"
                  rows={6}
                  className="w-full font-mono text-xs p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
            )}
          </div>

          {/* Configuration: Stock Update Mode */}
          {parsedData.rows.length > 0 && (
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/40 border border-stone-200/80 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
                  <span>Mode Pembaruan Stok Produk yang Cocok</span>
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Pilih bagaimana nilai stok pada CSV diaplikasikan ke produk yang sudah ada di sistem
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white dark:bg-[#251e1c] p-1 rounded-xl border border-stone-200 dark:border-stone-750">
                <button
                  type="button"
                  onClick={() => setStockMode('set')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    stockMode === 'set'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                  }`}
                >
                  Setel Stok Baru (Absolut)
                </button>
                <button
                  type="button"
                  onClick={() => setStockMode('add')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    stockMode === 'add'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                  }`}
                >
                  Tambahkan ke Stok (+Relatif)
                </button>
              </div>
            </div>
          )}

          {/* Live Preview Table & Metrics */}
          {parsedData.rows.length > 0 && (
            <div className="space-y-3">
              {/* Metric Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Pratinjau Data ({parsedData.rows.length} Baris):
                  </span>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewFilter === 'all'
                        ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    Semua ({parsedData.rows.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('update')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewFilter === 'update'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    <span>Perbarui Produk ({updateCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewFilter('new')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewFilter === 'new'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    <span>Tambah Baru ({newCount})</span>
                  </button>

                  {invalidCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('invalid')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        previewFilter === 'invalid'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                      }`}
                    >
                      <span>Error ({invalidCount})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-100/80 dark:bg-stone-850 sticky top-0 z-10 text-[11px] font-bold text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Nama Produk</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3">Harga (Rp)</th>
                      <th className="py-2.5 px-3">Stok</th>
                      <th className="py-2.5 px-3">Batas Minimum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800 bg-white dark:bg-[#1f1917]">
                    {filteredPreviewRows.map(row => {
                      const isMatch = row.status === 'UPDATE';
                      const matched = row.matchedProduct;

                      const priceDiff =
                        isMatch && matched && row.price !== undefined
                          ? row.price - matched.price
                          : null;

                      let newStockCalc: number | null = null;
                      if (row.stock !== undefined) {
                        if (isMatch && matched && stockMode === 'add') {
                          newStockCalc = Math.max(0, matched.stock + row.stock);
                        } else {
                          newStockCalc = Math.max(0, row.stock);
                        }
                      }

                      return (
                        <tr
                          key={row.rowNumber}
                          className={`hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors ${
                            row.status === 'INVALID'
                              ? 'bg-red-50/30 dark:bg-red-950/20'
                              : row.status === 'NEW'
                              ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                              : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono text-stone-400">
                            {row.rowNumber}
                          </td>

                          {/* Status Badge */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {row.status === 'UPDATE' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                                Perbarui
                              </span>
                            )}
                            {row.status === 'NEW' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                                Tambah Baru
                              </span>
                            )}
                            {row.status === 'INVALID' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400">
                                Error
                              </span>
                            )}
                          </td>

                          {/* Product Name */}
                          <td className="py-2.5 px-3 font-bold text-stone-900 dark:text-stone-100">
                            {row.name || (
                              <span className="text-red-500 italic">Nama kosong</span>
                            )}
                            {row.errors.length > 0 && (
                              <div className="text-[10px] text-red-500 font-normal mt-0.5">
                                {row.errors.join(', ')}
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-2.5 px-3 text-stone-600 dark:text-stone-300 capitalize">
                            {row.category || (matched ? matched.category : 'kopi')}
                          </td>

                          {/* Price */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {row.price !== undefined ? (
                              <div className="flex items-center gap-1.5">
                                {isMatch && matched && matched.price !== row.price && (
                                  <span className="text-[10px] text-stone-400 line-through">
                                    {matched.price.toLocaleString('id-ID')}
                                  </span>
                                )}
                                <span
                                  className={`font-bold ${
                                    priceDiff && priceDiff !== 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-stone-900 dark:text-stone-100'
                                  }`}
                                >
                                  Rp {row.price.toLocaleString('id-ID')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-stone-400 italic">
                                {matched ? `Tetap (Rp ${matched.price.toLocaleString('id-ID')})` : 'Rp 0'}
                              </span>
                            )}
                          </td>

                          {/* Stock */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {row.stock !== undefined ? (
                              <div className="flex items-center gap-1.5">
                                {isMatch && matched && (
                                  <span className="text-[10px] text-stone-400 line-through">
                                    {matched.stock}
                                  </span>
                                )}
                                <span className="font-extrabold text-stone-900 dark:text-stone-100">
                                  {newStockCalc} unit
                                </span>
                                {isMatch && matched && stockMode === 'add' && row.stock > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    (+{row.stock})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-stone-400 italic">
                                {matched ? `Tetap (${matched.stock} unit)` : '0 unit'}
                              </span>
                            )}
                          </td>

                          {/* Threshold */}
                          <td className="py-2.5 px-3 text-stone-600 dark:text-stone-300">
                            {row.lowStockThreshold !== undefined
                              ? `${row.lowStockThreshold} unit`
                              : matched?.lowStockThreshold
                              ? `${matched.lowStockThreshold} unit`
                              : '10 unit'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {parsedData.rows.length > 0 ? (
              <span>
                Siap diproses: <strong className="text-stone-900 dark:text-stone-100">{validRows.length} produk</strong>{' '}
                ({updateCount} pembaruan, {newCount} baru)
              </span>
            ) : (
              <span>Pilih atau tempel data CSV untuk melihat pratinjau</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-750 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSubmitImport}
              disabled={validRows.length === 0 || isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold shadow-md shadow-accent/20 transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses Import...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Terapkan Import ({validRows.length} Produk)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
