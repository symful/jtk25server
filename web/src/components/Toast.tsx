import { useState, useEffect, useCallback } from 'react';

interface ToastItem {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
}

let nextId = 0;
const listeners = new Set<(toast: ToastItem) => void>();

export function showToast(message: string, variant: ToastItem['variant'] = 'info'): void {
  const toast: ToastItem = { id: nextId++, message, variant };
  listeners.forEach((fn) => fn(toast));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (toast: ToastItem) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3000);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          data-testid="toast"
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium cursor-pointer transition-opacity ${
            t.variant === 'success'
              ? 'bg-green-600 text-white'
              : t.variant === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-white dark:bg-gray-700'
          }`}
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
