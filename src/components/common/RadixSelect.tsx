import React from 'react';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

export interface RadixSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
}

interface RadixSelectProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: RadixSelectOption[];
  placeholder?: string;
  prefixIcon?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
}

export const RadixSelect: React.FC<RadixSelectProps> = ({
  id,
  value,
  onValueChange,
  options,
  placeholder = 'Pilih opsi...',
  prefixIcon,
  ariaLabel,
  className = '',
  contentClassName = '',
  disabled = false
}) => {
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <Select.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        aria-label={ariaLabel}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {prefixIcon && <span className="shrink-0 text-stone-400">{prefixIcon}</span>}
          {selectedOption ? (
            <div className="flex items-center gap-1.5 truncate">
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate font-semibold">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                    selectedOption.badgeColor || 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <Select.Value placeholder={placeholder} />
          )}
        </div>

        <Select.Icon asChild>
          <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className={`z-[100] min-w-[240px] max-h-[320px] overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#251e1c] p-1.5 shadow-2xl animate-in fade-in-80 zoom-in-95 ${contentClassName}`}
        >
          <Select.ScrollUpButton className="flex items-center justify-center h-6 text-stone-400 cursor-default">
            <ChevronUp className="w-4 h-4" />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-1 space-y-0.5">
            {options.map(option => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-stone-800 dark:text-stone-200 select-none cursor-pointer outline-none transition-colors data-[highlighted]:bg-stone-100 dark:data-[highlighted]:bg-stone-800 data-[highlighted]:text-stone-900 dark:data-[highlighted]:text-stone-50"
              >
                <div className="flex items-center gap-2 min-w-0 pr-6">
                  {option.icon && <span className="shrink-0">{option.icon}</span>}
                  <div className="truncate">
                    <Select.ItemText>
                      <span className="font-semibold block truncate">{option.label}</span>
                    </Select.ItemText>
                    {option.sublabel && (
                      <span className="text-[10px] text-stone-400 block truncate">
                        {option.sublabel}
                      </span>
                    )}
                  </div>
                  {option.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                        option.badgeColor || 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {option.badge}
                    </span>
                  )}
                </div>

                <Select.ItemIndicator className="absolute right-2.5 flex items-center justify-center">
                  <Check className="w-4 h-4 text-accent" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>

          <Select.ScrollDownButton className="flex items-center justify-center h-6 text-stone-400 cursor-default">
            <ChevronDown className="w-4 h-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};
