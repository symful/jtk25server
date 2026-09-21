import { useState, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import { apiClient, notifyCalendar } from '../../api';
import type { CalendarEvent } from '../../types';
import { CLASS_LIST } from '../../types';
import Modal from '../../components/Modal';
import Combobox from '../../components/Combobox';
import { showToast } from '../../components/Toast';
import { required, validate, FieldError, hasError } from '../../lib/validation';

const EMPTY = { title: '', description: '', date: '', end_date: '', location: '', category: '', class_name: '' };

const CLASS_OPTIONS = [
  { value: '', label: 'Semua / Global' },
  ...CLASS_LIST.map((c) => ({ value: c, label: c.replace(/_/g, '-') })),
];

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatDateID(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const month = parseInt(parts[1], 10);
  const year = parts[0];
  if (isNaN(day) || isNaN(month) || month < 1 || month > 12) return dateStr;
  return `${day} ${MONTHS_ID[month - 1]} ${year}`;
}

export default function AdminKalender() {
  const [data, setData] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<CalendarEvent[]>('/admin/events');
      setData(res);
    } catch {
      setError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(e: CalendarEvent) {
    setEditing(e);
    setForm({
      title: e.title,
      description: e.description || '',
      date: e.date,
      end_date: e.end_date,
      location: e.location || '',
      category: e.category || '',
      class_name: e.class_name || '',
    });
    setFieldErrors({});
    setModalOpen(true);
  }

  function validateForm(): boolean {
    const errors: Record<string, string | null> = {
      title: validate(form.title, 'Judul', required),
      date: validate(form.date, 'Tanggal mulai', required),
      end_date: validate(form.end_date, 'Tanggal akhir', required),
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(hasError);
  }

  async function handleSave() {
    if (!validateForm()) return;
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await apiClient.put(`/admin/events/${editing.id}`, form);
      } else {
        await apiClient.post('/admin/events', form);
      }
      if (form.class_name) notifyCalendar([form.class_name]);
      setModalOpen(false);
      showToast(editing ? 'Event berhasil diperbarui' : 'Event berhasil ditambahkan', 'success');
      load();
    } catch (e: any) {
      setError(e.body?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiClient.delete(`/admin/events/${deleteId}`);
      setDeleteId(null);
      showToast('Event berhasil dihapus', 'success');
      load();
    } catch (e: any) {
      setError(e.body?.error || 'Gagal menghapus');
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Memuat...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kelola Kalender</h1>
        <button onClick={openAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          + Tambah Event
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600 dark:hover:text-red-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Judul</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Tanggal</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Kelas</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Lokasi</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Kategori</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{e.title}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDateID(e.date)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {e.class_name ? <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{e.class_name.replace(/_/g, '-')}</span> : <span className="text-gray-400 dark:text-gray-500">Global</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{e.location || '-'}</td>
                  <td className="px-4 py-3">
                    {e.category && <span className="px-2 py-0.5 rounded-full text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{e.category}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(e)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline mr-2">Edit</button>
                    <button onClick={() => setDeleteId(e.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Event' : 'Tambah Event'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
            <FieldError error={fieldErrors.title} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi (Markdown)</label>
            <div className="grid grid-cols-2 gap-3">
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg font-mono text-sm" />
              <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-3 overflow-auto max-h-48 bg-gray-50 dark:bg-gray-800">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Preview:</p>
                <div className="prose prose-sm max-w-none dark:prose-invert"><Markdown>{form.description || '_Tidak ada konten_'}</Markdown></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Mulai *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
              <FieldError error={fieldErrors.date} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Akhir *</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
              <FieldError error={fieldErrors.end_date} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lokasi</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas</label>
            <Combobox value={form.class_name} onChange={(v) => setForm({ ...form, class_name: v })} options={CLASS_OPTIONS} placeholder="Semua / Global" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm">Batal</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Hapus Event">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Yakin ingin menghapus event ini?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm">Batal</button>
          <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Hapus</button>
        </div>
      </Modal>
    </div>
  );
}
