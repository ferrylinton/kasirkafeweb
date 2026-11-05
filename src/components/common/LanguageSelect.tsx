import React from 'react';
import * as Select from '@radix-ui/react-select';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Language } from '../../types';

export interface LanguageOption {
  value: Language;
  label: string;
  shortLabel: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    value: 'id',
    label: 'Bahasa Indonesia',
    shortLabel: 'ID',
    flag: '🇮🇩'
  },
  {
    value: 'en',
    label: 'English',
    shortLabel: 'EN',
    flag: '🇺🇸'
  }
];

export interface LanguageSelectProps {
  id?: string;
  className?: string;
  value?: Language;
  onValueChange?: (lang: Language) => void;
  showIcon?: boolean;
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({
  id = 'language-radix-select',
  className = '',
  value: propValue,
  onValueChange: propOnValueChange,
  showIcon = true
}) => {
  const { language, setLanguage } = useLanguage();

  const currentLang = propValue || language || 'id';

  const handleChange = (val: string) => {
    const langVal = val as Language;
    if (propOnValueChange) {
      propOnValueChange(langVal);
    } else {
      setLanguage(langVal);
    }
  };

  const selectedOption = LANGUAGE_OPTIONS.find(opt => opt.value === currentLang) || LANGUAGE_OPTIONS[0];

  return (
    <Select.Root value={currentLang} onValueChange={handleChange}>
      <Select.Trigger
        id={id}
        aria-label="Pilih Bahasa"
        className={`inline-flex items-center justify-between gap-1.5 h-9 px-2.5 rounded-xl bg-stone-200/60 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700/80 text-xs font-semibold text-stone-700 dark:text-stone-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40 shadow-2xs select-none active:scale-95 ${className}`}
      >
        <div className="flex items-center gap-1.5">
          {showIcon && (
            <Globe className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400 shrink-0" />
          )}
          <span className="text-xs">{selectedOption.flag}</span>
          <span className="font-bold tracking-wider">{selectedOption.shortLabel}</span>
        </div>

        <Select.Icon asChild>
          <ChevronDown className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 shrink-0 transition-transform duration-200" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          align="end"
          className="z-[100] min-w-[170px] overflow-hidden rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#251e1c] p-1.5 shadow-xl animate-in fade-in-80 zoom-in-95 select-none"
        >
          <Select.Viewport className="p-0.5 space-y-0.5">
            {LANGUAGE_OPTIONS.map(opt => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className="relative flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-stone-800 dark:text-stone-200 select-none cursor-pointer outline-none transition-colors data-[highlighted]:bg-orange-50 dark:data-[highlighted]:bg-orange-950/40 data-[highlighted]:text-stone-900 dark:data-[highlighted]:text-stone-50"
              >
                <div className="flex items-center gap-2 min-w-0 pr-5">
                  <span className="text-sm shrink-0">{opt.flag}</span>
                  <div className="flex items-center gap-1.5 truncate">
                    <Select.ItemText>
                      <span className="font-semibold text-stone-900 dark:text-stone-100 truncate block">
                        {opt.label}
                      </span>
                    </Select.ItemText>
                    <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 shrink-0 border border-stone-200/60 dark:border-stone-700/60">
                      {opt.shortLabel}
                    </span>
                  </div>
                </div>

                <Select.ItemIndicator className="absolute right-2.5 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-accent stroke-[2.5]" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};
