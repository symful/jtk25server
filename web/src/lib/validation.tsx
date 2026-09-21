// All error messages are in Indonesian (Bahasa Indonesia).

export function required(value: string, label: string): string | null {
  return value.trim() ? null : `${label} wajib diisi`;
}

export function email(value: string, label: string): string | null {
  if (!value.trim()) return `${label} wajib diisi`;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : `${label} format tidak valid`;
}

export function minLength(value: string, label: string, min: number): string | null {
  if (!value.trim()) return `${label} wajib diisi`;
  return value.trim().length >= min ? null : `${label} minimal ${min} karakter`;
}

export function validate(value: string, label: string, ...fns: Array<(v: string, l: string) => string | null>): string | null {
  for (const fn of fns) {
    const err = fn(value, label);
    if (err) return err;
  }
  return null;
}

export function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return <span className="text-xs text-red-500 dark:text-red-400 mt-1 block">{error}</span>;
}

export function hasError(error: string | null): boolean {
  return error !== null && error.length > 0;
}
