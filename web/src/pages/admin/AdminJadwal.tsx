import { useState, useEffect, useCallback } from 'react';
import { apiClient, notifySchedule } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import type { SchedulesResponse, ClassSchedule } from '../../types';
import { DAYS, CLASS_LIST } from '../../types';
import Modal from '../../components/Modal';

interface ScheduleRow {
  id: number;
  class_name: string;
  semester: string;
  day: string;
  time: string;
  course_code: string;
  course_name: string;
  type: string;
  lecturer_code: string;
  lecturer: string;
  room: string;
  slot_order: number;
}

const EMPTY_FORM = {
  class_name: '', day: 'SENIN', time: '', course_code: '',
  course_name: '', type: 'Teori', lecturer_code: '', lecturer: '', room: '',
  slot_order: 0,
};

export default function AdminJadwal() {
  const { isGlobal, scope } = useAuth();
  const [data, setData] = useState<SchedulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const myClass = !isGlobal ? scope?.replace('class:', '') : null;

  const load = useCallback(() => {
    apiClient.get<SchedulesResponse>('/admin/schedules')
      .then((res) => {
        setData(res);
        if (res.classes.length > 0 && !selectedClass) {
          setSelectedClass(res.classes[0].class_name);
        }
      })
      .catch(() => setError('Gagal memuat jadwal'))
      .finally(() => setLoading(false));
  }, [selectedClass]);

  useEffect(() => { load(); }, [load]);

  const selected = data?.classes.find((c) => c.class_name === selectedClass);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, class_name: myClass || selectedClass || '' });
    setModalOpen(true);
  }

  function openEdit(day: string, time: string, cls: ClassSchedule) {
    const session = cls.schedule
      .flatMap((d) => d.sessions.map((s) => ({ ...s, day: d.day })))
      .find((s) => s.day === day && s.time === time);
    if (!session) return;

    setForm({
      class_name: cls.class_name,
      day: session.day,
      time: session.time,
      course_code: session.course_code,
      course_name: session.course_name,
      type: session.type,
      lecturer_code: session.lecturer_code,
      lecturer: session.lecturer,
      room: session.room,
      slot_order: 0,
    });
    setEditingId(0);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      if (editingId === 0) {
        await apiClient.post('/admin/schedules', form);
      } else {
        await apiClient.put(`/admin/schedules/${editingId}`, form);
      }
      notifySchedule([form.class_name]);
      setModalOpen(false);
      load();
    } catch (e: any) {
      setError(e.body?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Memuat...</div>;

  const classes = data?.classes ?? [];
  const classList = myClass
    ? CLASS_LIST.filter((c) => c === myClass)
    : CLASS_LIST;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kelola Jadwal</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + Tambah Jadwal
        </button>
      </div>

      <div className="mb-6">
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg"
        >
          {classList.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, '-')}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {selected.schedule.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">Belum ada jadwal untuk kelas ini</div>
          ) : (
            selected.schedule.map((daySchedule) => (
              <div key={daySchedule.day} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 font-medium text-sm text-gray-600 dark:text-gray-400">
                  {daySchedule.day}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Jam</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">MK</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Tipe</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Dosen</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Ruang</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daySchedule.sessions.map((s, i) => (
                        <tr key={i} className="border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.time}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{s.course_code}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{s.course_name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">{s.type}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.lecturer || s.lecturer_code}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.room}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openEdit(daySchedule.day, selected.class_name, selected)}
                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline mr-2"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId !== null ? 'Edit Jadwal' : 'Tambah Jadwal'}>
        <div className="space-y-4">
          {error && <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas</label>
            <select
              value={form.class_name}
              onChange={(e) => setForm({ ...form, class_name: e.target.value })}
              disabled={!isGlobal}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg disabled:bg-gray-100 dark:disabled:bg-gray-700"
            >
              {classList.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, '-')}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari</label>
              <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg">
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam</label>
              <input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" placeholder="08:00-09:30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode MK</label>
              <input value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg">
                <option value="Teori">Teori</option>
                <option value="Praktikum">Praktikum</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Mata Kuliah</label>
            <input value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode Dosen</label>
              <input value={form.lecturer_code} onChange={(e) => setForm({ ...form, lecturer_code: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dosen</label>
              <input value={form.lecturer} onChange={(e) => setForm({ ...form, lecturer: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruang</label>
            <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm">Batal</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
