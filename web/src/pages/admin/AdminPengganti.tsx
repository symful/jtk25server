import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import type { Pengganti } from '../../types';
import { CLASS_LIST } from '../../types';
import Modal from '../../components/Modal';

const EMPTY: { class_code: string; date: string; kind: 'replace' | 'add' | 'info'; note: string; sessions: string } = { class_code: '', date: '', kind: 'replace', note: '', sessions: '' };

export default function AdminPengganti() {
  const { isGlobal, scope } = useAuth();
  const myClass = !isGlobal ? scope?.replace('class:', '') : null;
  const [data, setData] = useState<Pengganti[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pengganti | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<Pengganti[]>('/admin/pengganti');
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
    setForm({ ...EMPTY, class_code: myClass || '' });
    setModalOpen(true);
  }

  function openEdit(p: Pengganti) {
    setEditing(p);
    setForm({
      class_code: p.class_code,
      date: p.date,
      kind: p.kind,
      note: p.note || '',
      sessions: JSON.stringify(p.sessions, null, 2),
    });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      let sessions: unknown[] = [];
      if (form.sessions.trim()) {
        try { sessions = JSON.parse(form.sessions); } catch {
          setError('Format sessions JSON salah');
          setSaving(false);
          return;
        }
      }
      const payload = {
        class_code: form.class_code,
        date: form.date,
        kind: form.kind,
        note: form.note || null,
        sessions,
      };
      if (editing) {
        await apiClient.put(`/admin/pengganti/${editing.id}`, payload);
      } else {
        await apiClient.post('/admin/pengganti', payload);
      }
      setModalOpen(false);
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
      await apiClient.delete(`/admin/pengganti/${deleteId}`);
      setDeleteId(null);
      load();
    } catch (e: any) {
      setError(e.body?.error || 'Gagal menghapus');
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Memuat...</div>;

  const classList = myClass ? CLASS_LIST.filter((c) => c === myClass) : CLASS_LIST;
  const kindMap: Record<string, string> = { replace: 'Pengganti', add: 'Penambahan', info: 'Info' };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kelola Pengganti</h1>
        <button onClick={openAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          + Tambah Pengganti
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Kelas</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tanggal</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Jenis</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Catatan</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.class_code.replace(/_/g, '-')}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.date}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-primary-100 text-primary-700">
                      {kindMap[p.kind] || p.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{p.note || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-xs text-primary-600 hover:underline mr-2">Edit</button>
                    <button onClick={() => setDeleteId(p.id)} className="text-xs text-red-600 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Pengganti' : 'Tambah Pengganti'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kelas *</label>
              <select
                value={form.class_code}
                onChange={(e) => setForm({ ...form, class_code: e.target.value })}
                disabled={!isGlobal}
                className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
              >
                {classList.map((c) => <option key={c} value={c}>{c.replace(/_/g, '-')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis *</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'replace' | 'add' | 'info' })} className="w-full px-3 py-2 border rounded-lg">
              <option value="replace">Pengganti</option>
              <option value="add">Penambahan</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sessions (JSON)</label>
            <textarea
              value={form.sessions}
              onChange={(e) => setForm({ ...form, sessions: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg font-mono text-xs"
              placeholder='[{"time":"08:00","course_code":"IF101","course_name":"Basis Data","type":"Teori","lecturer":"Dr. Budi","room":"R.201"}]'
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Batal</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Hapus Pengganti">
        <p className="text-sm text-gray-600 mb-4">Yakin ingin menghapus data pengganti ini?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Batal</button>
          <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Hapus</button>
        </div>
      </Modal>
    </div>
  );
}
