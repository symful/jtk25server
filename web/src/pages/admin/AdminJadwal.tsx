import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient, notifySchedule } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import type { SchedulesResponse, ClassSchedule, Room } from '../../types';
import { DAYS, CLASS_LIST } from '../../types';
import Modal from '../../components/Modal';
import Combobox from '../../components/Combobox';
import { showToast } from '../../components/Toast';
import { required, FieldError } from '../../lib/validation';

interface FormData {
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
  mode: string;
}

const EMPTY_FORM: FormData = {
  class_name: '',
  semester: '',
  day: 'SENIN',
  time: '',
  course_code: '',
  course_name: '',
  type: 'TE',
  lecturer_code: '',
  lecturer: '',
  room: '',
  slot_order: 0,
  mode: 'offline',
};

export default function AdminJadwal() {
  const { isGlobal, scope } = useAuth();
  const [data, setData] = useState<SchedulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  useEffect(() => {
    apiClient.get<Room[]>('/rooms').then(setRooms).catch(() => {});
  }, []);

  const selected = data?.classes.find((c) => c.class_name === selectedClass);

  const timeOptions = useMemo(() => {
    if (!data) return [];
    const times = new Set<string>();
    data.classes.forEach((c) =>
      c.schedule.forEach((d) => d.sessions.forEach((s) => times.add(s.time))),
    );
    return Array.from(times).sort().map((t) => ({ value: t, label: t }));
  }, [data]);

  const courseLookup = useMemo(() => {
    if (!data) return new Map<string, string>();
    const map = new Map<string, string>();
    data.classes.forEach((c) =>
      c.schedule.forEach((d) =>
        d.sessions.forEach((s) => {
          if (s.course_code && !map.has(s.course_code)) {
            map.set(s.course_code, s.course_name);
          }
        }),
      ),
    );
    return map;
  }, [data]);

  const courseOptions = useMemo(
    () =>
      Array.from(courseLookup.entries()).map(([code, name]) => ({
        value: code,
        label: `${code} - ${name}`,
      })),
    [courseLookup],
  );

  const courseNameLookup = useMemo(() => {
    if (!data) return new Map<string, string>();
    const map = new Map<string, string>();
    data.classes.forEach((c) =>
      c.schedule.forEach((d) =>
        d.sessions.forEach((s) => {
          if (s.course_name && !map.has(s.course_name)) {
            map.set(s.course_name, s.course_code);
          }
        }),
      ),
    );
    return map;
  }, [data]);

  const courseNameOptions = useMemo(
    () =>
      Array.from(courseNameLookup.entries()).map(([name, code]) => ({
        value: name,
        label: `${code} - ${name}`,
      })),
    [courseNameLookup],
  );

  const lecturerLookup = useMemo(() => {
    if (!data) return new Map<string, string>();
    const map = new Map<string, string>();
    data.classes.forEach((c) =>
      c.schedule.forEach((d) =>
        d.sessions.forEach((s) => {
          if (s.lecturer_code && !map.has(s.lecturer_code)) {
            map.set(s.lecturer_code, s.lecturer);
          }
        }),
      ),
    );
    return map;
  }, [data]);

  const lecturerOptions = useMemo(
    () =>
      Array.from(lecturerLookup.entries()).map(([code, name]) => ({
        value: code,
        label: `${code} - ${name}`,
      })),
    [lecturerLookup],
  );

  const lecturerNameLookup = useMemo(() => {
    if (!data) return new Map<string, string>();
    const map = new Map<string, string>();
    data.classes.forEach((c) =>
      c.schedule.forEach((d) =>
        d.sessions.forEach((s) => {
          if (s.lecturer && !map.has(s.lecturer)) {
            map.set(s.lecturer, s.lecturer_code);
          }
        }),
      ),
    );
    return map;
  }, [data]);

  const lecturerNameOptions = useMemo(
    () =>
      Array.from(lecturerNameLookup.entries()).map(([name, code]) => ({
        value: name,
        label: `${code} - ${name}`,
      })),
    [lecturerNameLookup],
  );

  const roomOptions = useMemo(
    () => rooms.map((r) => ({ value: r.name, label: r.name })),
    [rooms],
  );

  function handleCourseCodeChange(val: string) {
    const matchedName = courseLookup.get(val);
    setForm((prev) => ({
      ...prev,
      course_code: val,
      course_name: matchedName ?? prev.course_name,
    }));
  }

  function handleCourseNameChange(val: string) {
    const matchedCode = courseNameLookup.get(val);
    setForm((prev) => ({
      ...prev,
      course_name: val,
      course_code: matchedCode ?? prev.course_code,
    }));
  }

  function handleLecturerCodeChange(val: string) {
    const matchedName = lecturerLookup.get(val);
    setForm((prev) => ({
      ...prev,
      lecturer_code: val,
      lecturer: matchedName ?? prev.lecturer,
    }));
  }

  function handleLecturerNameChange(val: string) {
    const matchedCode = lecturerNameLookup.get(val);
    setForm((prev) => ({
      ...prev,
      lecturer: val,
      lecturer_code: matchedCode ?? prev.lecturer_code,
    }));
  }

  function openAdd() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      class_name: myClass || selectedClass || '',
      semester: data?.semester || '',
    });
    setFieldErrors({});
    setError('');
    setModalOpen(true);
  }

  function openEdit(day: string, time: string, courseCode: string, cls: ClassSchedule) {
    const session = cls.schedule
      .flatMap((d) => d.sessions.map((s) => ({ ...s, day: d.day })))
      .find((s) => s.day === day && s.time === time && s.course_code === courseCode);
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
      semester: data?.semester || '',
      slot_order: 0,
      mode: session.mode || 'offline',
    });
    setEditingId(session.id ?? null);
    setFieldErrors({});
    setError('');
    setModalOpen(true);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    const checks: Array<[string, string, string]> = [
      ['class_name', form.class_name, 'Kelas'],
      ['day', form.day, 'Hari'],
      ['time', form.time, 'Jam'],
      ['course_code', form.course_code, 'Kode MK'],
      ['course_name', form.course_name, 'Nama MK'],
      ['type', form.type, 'Tipe'],
      ['lecturer_code', form.lecturer_code, 'Kode Dosen'],
      ['room', form.room, 'Ruang'],
    ];
    for (const [field, value, label] of checks) {
      const err = required(value, label);
      if (err) errors[field] = err;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      if (editingId === null) {
        await apiClient.post('/admin/schedules', form);
      } else {
        await apiClient.put(`/admin/schedules/${editingId}`, form);
      }
      notifySchedule([form.class_name]).catch(() => {});
      showToast(editingId === null ? 'Jadwal ditambahkan' : 'Jadwal diperbarui', 'success');
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      const msg = (e instanceof Error && 'body' in e)
        ? (e as { body?: { error?: string } }).body?.error || 'Gagal menyimpan'
        : 'Gagal menyimpan';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteTarget === null) return;
    try {
      await apiClient.delete(`/admin/schedules/${deleteTarget}`);
      showToast('Jadwal dihapus', 'success');
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      const msg = (e instanceof Error && 'body' in e)
        ? (e as { body?: { error?: string } }).body?.error || 'Gagal menghapus'
        : 'Gagal menghapus';
      setError(msg);
      showToast(msg, 'error');
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Memuat...</div>;
  }

  const classList = myClass ? CLASS_LIST.filter((c) => c === myClass) : CLASS_LIST;

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

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
          {error}
        </div>
      )}

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
                        <tr
                          key={s.id ?? i}
                          className="border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
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
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => openEdit(daySchedule.day, s.time, s.course_code, selected)}
                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline mr-2"
                            >
                              Edit
                            </button>
                            {s.id != null && (
                              <button
                                onClick={() => setDeleteTarget(s.id!)}
                                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                              >
                                Hapus
                              </button>
                            )}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId !== null ? 'Edit Jadwal' : 'Tambah Jadwal'}
        size="lg"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas *</label>
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
            <FieldError error={fieldErrors.class_name ?? null} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari *</label>
              <select
                value={form.day}
                onChange={(e) => setForm({ ...form, day: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg"
              >
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <FieldError error={fieldErrors.day ?? null} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg"
              >
                <option value="TE">Teori</option>
                <option value="PR">Praktikum</option>
              </select>
              <FieldError error={fieldErrors.type ?? null} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam *</label>
              <Combobox
                value={form.time}
                onChange={(val) => setForm({ ...form, time: val })}
                options={timeOptions}
                placeholder="07.00-07.50"
              />
              <FieldError error={fieldErrors.time ?? null} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruang *</label>
              <Combobox
                value={form.room}
                onChange={(val) => setForm({ ...form, room: val })}
                options={roomOptions}
                placeholder="H504-Kelas"
              />
              <FieldError error={fieldErrors.room ?? null} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode MK *</label>
              <Combobox
                value={form.course_code}
                onChange={handleCourseCodeChange}
                options={courseOptions}
                placeholder="TI201"
              />
              <FieldError error={fieldErrors.course_code ?? null} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama MK *</label>
              <Combobox
                value={form.course_name}
                onChange={handleCourseNameChange}
                options={courseNameOptions}
                placeholder="Basis Data"
              />
              <FieldError error={fieldErrors.course_name ?? null} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kode Dosen *</label>
              <Combobox
                value={form.lecturer_code}
                onChange={handleLecturerCodeChange}
                options={lecturerOptions}
                placeholder="TG"
              />
              <FieldError error={fieldErrors.lecturer_code ?? null} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Dosen</label>
              <Combobox
                value={form.lecturer}
                onChange={handleLecturerNameChange}
                options={lecturerNameOptions}
                placeholder="Trisna Gelar, S.T., M.Kom."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Hapus Jadwal">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Yakin ingin menghapus jadwal ini?</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm"
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            Hapus
          </button>
        </div>
      </Modal>
    </div>
  );
}
