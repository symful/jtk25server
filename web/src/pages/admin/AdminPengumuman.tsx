import { useState, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import { apiClient } from '../../api';
import type { Announcement } from '../../types';
import { CLASS_LIST } from '../../types';
import Modal from '../../components/Modal';
import Combobox from '../../components/Combobox';
import { showToast } from '../../components/Toast';
import { required, validate, FieldError, hasError } from '../../lib/validation';

const BODY_MAX = 2000;

const EMPTY = { title: '', body: '', pinned: 0, class_name: '', expires_at: '' };

const CLASS_OPTIONS = [
  { value: '', label: 'Semua / Global' },
  ...CLASS_LIST.map((c) => ({ value: c, label: c.replace(/_/g, '-') })),
];

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  // Strip trailing Z and trim to minutes: '2026-09-21T14:30:00Z' → '2026-09-21T14:30'
  const cleaned = iso.replace(/Z$/i, '');
  return cleaned.length >= 16 ? cleaned.slice(0, 16) : cleaned;
}

function toIsoDatetime(val: string): string | null {
  if (!val) return null;
  // datetime-local gives '2026-09-21T14:30'; append seconds for ISO
  return val.length === 16 ? val + ':00' : val;
}

export default function AdminPengumuman() {
  const [data, setData] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<Announcement[]>('/admin/announcements');
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

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title,
      body: a.body,
      pinned: a.pinned,
      class_name: a.class_name || '',
      expires_at: toDatetimeLocal(a.expires_at),
    });
    setFieldErrors({});
    setModalOpen(true);
  }

  function validateForm(): boolean {
    const errors: Record<string, string | null> = {
      title: validate(form.title, 'Judul', required),
      body: validate(form.body, 'Isi pengumuman', required),
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(hasError);
  }

  async function handleSave() {
    if (!validateForm()) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body,
        pinned: form.pinned,
        class_name: form.class_name || null,
        expires_at: toIsoDatetime(form.expires_at),
      };
      if (editing) {
        await apiClient.put(`/admin/announcements/${editing.id}`, payload);
      } else {
        await apiClient.post('/admin/announcements', payload);
      }
      setModalOpen(false);
      showToast(editing ? 'Pengumuman berhasil diperbarui' : 'Pengumuman berhasil ditambahkan', 'success');
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
      await apiClient.delete(`/admin/announcements/${deleteId}`);
      setDeleteId(null);
      showToast('Pengumuman berhasil dihapus', 'success');
      load();
    } catch (e: any) {
      setError(e.body?.error || 'Gagal menghapus');
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Memuat...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kelola Pengumuman</h1>
        <button onClick={openAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          + Tambah Pengumuman
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
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Ringkasan</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Expires</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {a.pinned ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Pinned</span>
                        {a.title}
                      </span>
                    ) : a.title}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{a.body}</td>
                  <td className="px-4 py-3">
                    {a.pinned ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Pinned</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">Normal</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {a.expires_at ? new Date(a.expires_at).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(a)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline mr-2">Edit</button>
                    <button onClick={() => setDeleteId(a.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Pengumuman' : 'Tambah Pengumuman'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
            <FieldError error={fieldErrors.title} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Isi * (Markdown)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg font-mono text-sm" placeholder="**Bold**, *italic*, - list items..." />
                <div className="flex justify-between mt-1">
                  <FieldError error={fieldErrors.body} />
                  <span className={`text-xs ml-auto ${form.body.length > BODY_MAX ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                    {form.body.length} / {BODY_MAX}
                  </span>
                </div>
              </div>
              <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-3 overflow-auto max-h-64 bg-gray-50 dark:bg-gray-800">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Preview:</p>
                <div className="prose prose-sm max-w-none dark:prose-invert"><Markdown>{form.body || '_Tidak ada konten_'}</Markdown></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pinned</label>
              <select value={form.pinned} onChange={(e) => setForm({ ...form, pinned: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg">
                <option value={0}>Tidak</option>
                <option value={1}>Ya</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Berlaku Hingga</label>
              <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas</label>
              <Combobox value={form.class_name} onChange={(v) => setForm({ ...form, class_name: v })} options={CLASS_OPTIONS} placeholder="Semua / Global" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm">Batal</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Hapus Pengumuman">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Yakin ingin menghapus pengumuman ini?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm">Batal</button>
          <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Hapus</button>
        </div>
      </Modal>
    </div>
  );
}
