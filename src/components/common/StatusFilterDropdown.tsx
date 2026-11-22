import React from 'react';
import * as Select from '@radix-ui/react-select';
import { Filter, Check, ChevronDown, ChevronUp } from 'lucide-react';

export interface StatusFilterOption<T extends string = string> {
  value: T;
  label: string;
}

export const DEFAULT_PRODUCT_STATUS_OPTIONS: StatusFilterOption<'all' | 'available' | 'unavailable'>[] = [
  { value: 'all', label: 'Semua Status' },
  { value: 'available', label: 'Tersedia Saja' },
  { value: 'unavailable', label: 'Nonaktif / Draft' }
];

interface StatusFilterDropdownProps<T extends string = string> {
  id?: string;
  value: T;
  onValueChange: (value: T) => void;
  options?: StatusFilterOption<T>[];
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function StatusFilterDropdown<T extends string = string>({
  id = 'product-status-filter-dropdown',
  value,
  onValueChange,
  options = DEFAULT_PRODUCT_STATUS_OPTIONS as unknown as StatusFilterOption<T>[],
  label = 'Filter Status',
  placeholder = 'Pilih status...',
  ariaLabel = 'Filter status produk',
  className = '',
  disabled = false
}: StatusFilterDropdownProps<T>) {
  return (
    <Select.Root
      value={value}
      onValueChange={val => onValueChange(val as T)}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100/80 dark:hover:bg-stone-800/80 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <Select.Value placeholder={placeholder} />
        </span>
        <Select.Icon asChild>
          <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          align="end"
          className="z-[100] min-w-[180px] overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#251e1c] p-1.5 shadow-xl animate-in fade-in-80 zoom-in-95 select-none"
        >
          <Select.ScrollUpButton className="flex items-center justify-center h-6 text-stone-400 cursor-default">
            <ChevronUp className="w-3.5 h-3.5" />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-0.5">
            <Select.Group>
              {label && (
                <Select.Label className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  {label}
                </Select.Label>
              )}
              {options.map(option => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex items-center justify-between gap-2 pl-3 pr-8 py-2 rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-200 select-none cursor-pointer outline-none transition-colors data-[highlighted]:bg-orange-50 dark:data-[highlighted]:bg-orange-950/40 data-[highlighted]:text-stone-900 dark:data-[highlighted]:text-stone-50 data-[state=checked]:text-accent"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-2.5 inline-flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Group>
          </Select.Viewport>

          <Select.ScrollDownButton className="flex items-center justify-center h-6 text-stone-400 cursor-default">
            <ChevronDown className="w-3.5 h-3.5" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
