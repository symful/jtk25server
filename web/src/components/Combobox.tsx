import { useState, useRef, useEffect, useCallback } from 'react';

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
}

export default function Combobox({ value, onChange, options, placeholder }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(value.toLowerCase())
  );

  const handleSelect = useCallback((val: string) => {
    onChange(val);
    setOpen(false);
    setHighlight(-1);
  }, [onChange]);

  useEffect(() => {
    if (!open) return;
    setHighlight(-1);
  }, [open]);

  useEffect(() => {
    if (highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setOpen(true);
        setHighlight((h) => (h + 1) % filtered.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (open && highlight >= 0 && highlight < filtered.length) {
          handleSelect(filtered[highlight].value);
        } else {
          setOpen(false);
        }
        break;
      case 'Escape':
        setOpen(false);
        setHighlight(-1);
        break;
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg"
      />
      {value && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onChange('');
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt.value}
              onMouseDown={() => handleSelect(opt.value)}
              className={`px-3 py-2 cursor-pointer text-sm ${
                i === highlight
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
