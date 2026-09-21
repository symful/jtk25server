import { useState, useEffect } from 'react';
import { CLASS_LIST } from '../types';
import { notifySchedule, notifyPengganti, notifyCalendar } from '../api';
import { showToast } from './Toast';
import Modal from './Modal';
import Combobox from './Combobox';

const NOTIFY_OPTIONS = [
  { value: '', label: 'Semua (global)' },
  ...CLASS_LIST.map((c) => ({ value: c, label: c.replace(/_/g, '-') })),
];

export type NotifyType = 'jadwal' | 'pengganti' | 'kalender';

interface NotifyPromptProps {
  open: boolean;
  onClose: () => void;
  defaultClass?: string;
  type: NotifyType;
}

export default function NotifyPrompt({ open, onClose, defaultClass = '', type }: NotifyPromptProps) {
  const [selectedClass, setSelectedClass] = useState(defaultClass);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setSelectedClass(defaultClass);
  }, [open, defaultClass]);

  async function handleSend() {
    setSending(true);
    try {
      const classes = [selectedClass || 'global'];
      if (type === 'jadwal') await notifySchedule(classes);
      else if (type === 'pengganti') await notifyPengganti(classes);
      else await notifyCalendar(classes);
      showToast('Notifikasi terkirim', 'success');
      onClose();
    } catch {
      showToast('Gagal mengirim notifikasi', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Kirim Notifikasi" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Kirim notifikasi ke kelas?
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas</label>
          <Combobox
            value={selectedClass}
            onChange={setSelectedClass}
            options={NOTIFY_OPTIONS}
            placeholder="Semua (global)"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm"
          >
            Nanti saja
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {sending ? 'Mengirim...' : 'Kirim'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
