import React, { useState, useEffect } from 'react';
import { Building2, Shield, RefreshCw, Filter, Layers } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export interface VendorOption {
  id: string;
  name: string;
  code?: string;
}

export const KNOWN_VENDORS: VendorOption[] = [
  { id: 'vnd_sipspot_central', name: 'SipSpot Coffee (Pusat)', code: 'SIP-CENTRAL' },
  { id: 'vnd_kopi_kulo_kemang', name: 'Kopi Kulo & Toast (Kemang)', code: 'KULO-KEMANG' },
  { id: 'vnd_tehpoci_nusantara', name: 'Teh Poci Nusantara (Bekasi)', code: 'POCI-BEKASI' },
  { id: 'vnd_admin', name: 'Admin Sistem Pusat', code: 'ADMIN-SYS' }
];

export function getVendorName(vendorId?: string, vendorsList?: VendorOption[]): string {
  if (!vendorId || vendorId === 'all' || vendorId === 'ALL') return 'Semua Vendor';
  const list = vendorsList && vendorsList.length > 0 ? vendorsList : KNOWN_VENDORS;
  const found = list.find(v => v.id === vendorId);
  if (found) return found.name;
  if (vendorId === 'vnd_sipspot_central') return 'SipSpot Pusat';
  if (vendorId === 'vnd_kopi_kulo_kemang') return 'Kopi Kulo Kemang';
  if (vendorId === 'vnd_tehpoci_nusantara') return 'Teh Poci Bekasi';
  if (vendorId === 'vnd_admin') return 'Admin Pusat';
  return vendorId;
}

export function VendorBadge({ vendorId, vendorsList }: { vendorId?: string; vendorsList?: VendorOption[] }) {
  const vId = vendorId || 'vnd_sipspot_central';
  const name = getVendorName(vId, vendorsList);

  let colorClasses = 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700';
  if (vId === 'vnd_sipspot_central') {
    colorClasses = 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
  } else if (vId === 'vnd_kopi_kulo_kemang') {
    colorClasses = 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60';
  } else if (vId === 'vnd_tehpoci_nusantara') {
    colorClasses = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
  } else if (vId === 'vnd_admin') {
    colorClasses = 'bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800/60';
  }

  return (
    <span
      id={`vendor-badge-${vId}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${colorClasses} whitespace-nowrap`}
      title={`Vendor: ${name} (${vId})`}
    >
      <Building2 className="w-3 h-3 opacity-70" />
      <span className="truncate max-w-[130px]">{name}</span>
    </span>
  );
}

interface AdminAllVendorsHeaderProps {
  title: string;
  subtitle: string;
  selectedVendor: string;
  onVendorChange: (vendorId: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  itemCount?: number;
  itemLabel?: string;
  rightAction?: React.ReactNode;
}

export function AdminAllVendorsHeader({
  title,
  subtitle,
  selectedVendor,
  onVendorChange,
  onRefresh,
  isLoading = false,
  itemCount,
  itemLabel = 'Item',
  rightAction
}: AdminAllVendorsHeaderProps) {
  const { token } = useAuth();
  const [vendors, setVendors] = useState<VendorOption[]>(KNOWN_VENDORS);

  useEffect(() => {
    let isMounted = true;
    async function loadVendors() {
      try {
        const res = await fetch('/api/admin/vendors', {
          headers: { Authorization: `Bearer ${token || ''}` }
        });
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.vendors) && data.vendors.length > 0) {
          const mapped: VendorOption[] = data.vendors.map((v: any) => ({
            id: v.id,
            name: v.name,
            code: v.code
          }));
          setVendors(mapped);
        }
      } catch (e) {
        // Fallback already set to KNOWN_VENDORS
      }
    }
    loadVendors();
    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="flex flex-col gap-3 pb-3 border-b border-stone-200/80 dark:border-stone-800">
      {/* Top Banner Tag */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800/60 text-purple-800 dark:text-purple-300 text-xs font-semibold">
          <Shield className="w-3.5 h-3.5" />
          <span>ADMINISTRASI SISTEM • SEMUA VENDOR</span>
        </div>

        {typeof itemCount === 'number' && (
          <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">
            Total: <span className="font-bold text-stone-800 dark:text-stone-200">{itemCount}</span> {itemLabel}
          </div>
        )}
      </div>

      {/* Main Title and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Layers className="w-6 h-6 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>{title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Vendor Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
            <select
              id="admin-all-vendors-selector"
              value={selectedVendor}
              onChange={(e) => onVendorChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all" className="bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-bold">
                🌐 Semua Vendor (All Vendors)
              </option>
              {vendors.map((v) => (
                <option
                  key={v.id}
                  value={v.id}
                  className="bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                >
                  🏢 {v.name}
                </option>
              ))}
            </select>
          </div>

          {onRefresh && (
            <button
              id="admin-all-vendors-refresh-btn"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors border border-stone-200 dark:border-stone-700"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}

          {rightAction}
        </div>
      </div>
    </div>
  );
}
