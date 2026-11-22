import React, { useMemo } from 'react';
import * as Select from '@radix-ui/react-select';
import { Tags, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Category, Product } from '../../types';

export interface CategoryFilterOption {
  value: string;
  label: string;
  count?: number;
}

interface CategoryFilterDropdownProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  categories: Category[];
  products?: Product[];
  label?: string;
  allLabel?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export const CategoryFilterDropdown: React.FC<CategoryFilterDropdownProps> = ({
  id = 'product-category-filter-dropdown',
  value,
  onValueChange,
  categories,
  products,
  label = 'Filter Kategori',
  allLabel = 'Semua Kategori',
  placeholder = 'Pilih kategori...',
  ariaLabel = 'Filter kategori produk',
  className = '',
  disabled = false
}) => {
  const options = useMemo<CategoryFilterOption[]>(() => {
    const base: CategoryFilterOption[] = [
      {
        value: 'all',
        label: allLabel,
        count: products ? products.length : undefined
      }
    ];

    categories.forEach(cat => {
      const catKey = cat.name.toLowerCase();
      const count = products
        ? products.filter(p => (p.category || '').toLowerCase() === catKey).length
        : undefined;
      base.push({
        value: cat.name,
        label: cat.name,
        count
      });
    });

    return base;
  }, [categories, products, allLabel]);

  const matchedOption = useMemo(
    () =>
      options.find(opt => opt.value.toLowerCase() === value.toLowerCase()) ||
      options[0],
    [options, value]
  );

  return (
    <Select.Root
      value={matchedOption?.value ?? 'all'}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100/80 dark:hover:bg-stone-800/80 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <Tags className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <Select.Value placeholder={placeholder} />
          {typeof matchedOption?.count === 'number' && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300 tabular-nums shrink-0">
              {matchedOption.count}
            </span>
          )}
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
          className="z-[100] min-w-[200px] max-h-[300px] overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#251e1c] p-1.5 shadow-xl animate-in fade-in-80 zoom-in-95 select-none"
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
                  <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
                    <Select.ItemText>{option.label}</Select.ItemText>
                    {typeof option.count === 'number' && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 tabular-nums shrink-0">
                        {option.count}
                      </span>
                    )}
                  </div>
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
};
