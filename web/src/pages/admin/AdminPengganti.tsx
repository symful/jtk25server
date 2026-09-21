import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient, notifyPengganti } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import type { Pengganti, SchedulesResponse, Room } from '../../types';
import { CLASS_LIST } from '../../types';
import Modal from '../../components/Modal';
import Combobox from '../../components/Combobox';
import { showToast } from '../../components/Toast';
import { required, FieldError } from '../../lib/validation';

/* ── Session row types ────────────────────────────────────────────────────── */

interface SessionRow {
  id: string;
  time: string;
  course_name: string;
  course_code: string;
  type: 'TE' | 'PR';
  lecturer: string;
  lecturer_code: string;
  room: string;
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const CANONICAL_TIMES = [
  '07.00-07.50', '07.50-08.40', '08.40-09.30', '09.30-10.40',
  '10.40-11.30', '11.30-12.20', '13.00-13.50', '13.50-14.40',
  '14.40-15.20', '15.40-16.30', '16.30-17.20',
];

const TIME_OPTIONS = CANONICAL_TIMES.map((t) => ({ value: t, label: t }));

let rowIdSeq = 0;
function makeRowId(): string {
  return `sr-${++rowIdSeq}-${Date.now()}`;
}

function emptyRow(): SessionRow {
  return {
    id: makeRowId(),
    time: '',
    course_name: '',
    course_code: '',
    type: 'TE',
    lecturer: '',
    lecturer_code: '',
    room: '',
  };
}

interface FormState {
  class_code: string;
  date: string;
  kind: 'replace' | 'add' | 'info';
  note: string;
  sessions: SessionRow[];
}

const EMPTY_FORM: FormState = {
  class_code: '',
  date: '',
  kind: 'replace',
  note: '',
  sessions: [],
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** Serialize SessionRow[] to the JSON shape the API stores (field-order-insensitive). */
function sessionsToJSON(sessions: SessionRow[]): Array<Record<string, string>> {
  return sessions.map((s) => ({
    time: s.time,
    course_code: s.course_code,
    course_name: s.course_name,
    type: s.type,
    lecturer_code: s.lecturer_code,
    lecturer: s.lecturer,
    room: s.room,
  }));
}

function validateRow(row: SessionRow): Record<string, string> {
  const errors: Record<string, string> = {};
  const check = (field: keyof SessionRow, label: string) => {
    const err = required(row[field] as string, label);
    if (err) errors[field] = err;
  };
  check('time', 'Waktu');
  check('course_name', 'Nama Mata Kuliah');
  check('course_code', 'Kode Mata Kuliah');
  check('type', 'Tipe');
  check('lecturer', 'Dosen');
  check('lecturer_code', 'Kode Dosen');
  check('room', 'Ruang');
  return errors;
}

/* ── Session card sub-component ───────────────────────────────────────────── */

interface SessionCardProps {
  row: SessionRow;
  errors?: Record<string, string>;
  courseOptions: { value: string; label: string }[];
  lecturerOptions: { value: string; label: string }[];
  roomOptions: { value: string; label: string }[];
  courseCodeByName: Map<string, string>;
  lecturerCodeByName: Map<string, string>;
  onCourseChange: (value: string) => void;
  onLecturerChange: (value: string) => void;
  onFieldChange: (field: keyof SessionRow, value: string) => void;
  onRemove: () => void;
}

function SessionCard({
  row, errors,
  courseOptions, lecturerOptions, roomOptions,
  courseCodeByName, lecturerCodeByName,
  onCourseChange, onLecturerChange, onFieldChange, onRemove,
}: SessionCardProps) {
  const isExistingCourse = row.course_name.trim() !== '' && courseCodeByName.has(row.course_name);
  const isExistingLecturer = row.lecturer.trim() !== '' && lecturerCodeByName.has(row.lecturer);

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm';
  const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

  return (
    <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
      <div className="flex gap-2 items-start">
        <div className="flex-1 min-w-0">
          <label className={labelCls}>Mata Kuliah *</label>
          <Combobox
            value={row.course_name}
            onChange={onCourseChange}
            options={courseOptions}
            placeholder="Nama mata kuliah"
          />
          {errors?.course_name && <FieldError error={errors.course_name} />}
        </div>
        <div className="w-24 flex-shrink-0">
          <label className={labelCls}>Tipe *</label>
          <select
            value={row.type}
            onChange={(e) => onFieldChange('type', e.target.value as 'TE' | 'PR')}
            className={inputCls}
          >
            <option value="TE">TE</option>
            <option value="PR">PR</option>
          </select>
          {errors?.type && <FieldError error={errors.type} />}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-5 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0"
          title="Hapus sesi"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!isExistingCourse && row.course_name.trim() !== '' && (
        <div>
          <label className={labelCls}>Kode Mata Kuliah *</label>
          <input
            type="text"
            value={row.course_code}
            onChange={(e) => onFieldChange('course_code', e.target.value)}
            placeholder="Kode matkul"
            className={inputCls}
          />
          {errors?.course_code && <FieldError error={errors.course_code} />}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Waktu *</label>
          <Combobox
            value={row.time}
            onChange={(v) => onFieldChange('time', v)}
            options={TIME_OPTIONS}
            placeholder="07.00-08.40"
          />
          {errors?.time && <FieldError error={errors.time} />}
        </div>
        <div>
          <label className={labelCls}>Ruang *</label>
          <Combobox
            value={row.room}
            onChange={(v) => onFieldChange('room', v)}
            options={roomOptions}
            placeholder="H504-Kelas"
          />
          {errors?.room && <FieldError error={errors.room} />}
        </div>
      </div>

      <div>
        <label className={labelCls}>Dosen *</label>
        <Combobox
          value={row.lecturer}
          onChange={onLecturerChange}
          options={lecturerOptions}
          placeholder="Nama dosen"
        />
        {errors?.lecturer && <FieldError error={errors.lecturer} />}
      </div>

      {!isExistingLecturer && row.lecturer.trim() !== '' && (
        <div>
          <label className={labelCls}>Kode Dosen *</label>
          <input
            type="text"
            value={row.lecturer_code}
            onChange={(e) => onFieldChange('lecturer_code', e.target.value)}
            placeholder="Kode dosen"
            className={inputCls}
          />
          {errors?.lecturer_code && <FieldError error={errors.lecturer_code} />}
        </div>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */

export default function AdminPengganti() {
  const { isGlobal, scope } = useAuth();
  const myClass = !isGlobal ? scope?.replace('class:', '') : null;
  const [data, setData] = useState<Pengganti[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pengganti | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [rowErrors, setRowErrors] = useState<Record<number, Record<string, string>>>({});
  const [sessionError, setSessionError] = useState('');
  const [parseWarning, setParseWarning] = useState(false);
  const [useRawFallback, setUseRawFallback] = useState(false);
  const [rawJson, setRawJson] = useState('');
  const [copied, setCopied] = useState(false);

  const [allScheduleSessions, setAllScheduleSessions] = useState<Array<{
    course_code: string; course_name: string; lecturer_code: string; lecturer: string;
  }>>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  /* ── Data loading ─────────────────────────────────────────────────────── */

  const loadPengganti = useCallback(async () => {
    try {
      const res = await apiClient.get<Pengganti[]>('/admin/pengganti');
      setData(res);
    } catch {
      setError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPengganti(); }, [loadPengganti]);

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [schedulesRes, roomsRes] = await Promise.all([
          apiClient.get<SchedulesResponse>('/schedules'),
          apiClient.get<Room[]>('/rooms'),
        ]);
        const sessions: typeof allScheduleSessions = [];
        for (const cls of schedulesRes.classes) {
          for (const day of cls.schedule) {
            for (const s of day.sessions) {
              sessions.push({
                course_code: s.course_code,
                course_name: s.course_name,
                lecturer_code: s.lecturer_code,
                lecturer: s.lecturer,
              });
            }
          }
        }
        setAllScheduleSessions(sessions);
        setRooms(roomsRes);
      } catch {
      }
    }
    fetchOptions();
  }, []);

  /* ── Memoized combobox options + lookup maps ───────────────────────────── */

  const { courseOptions, courseCodeByName, lecturerOptions, lecturerCodeByName, roomOptions } =
    useMemo(() => {
      const cMap = new Map<string, string>(); // course_name → course_code
      const lMap = new Map<string, string>(); // lecturer → lecturer_code

      for (const s of allScheduleSessions) {
        if (s.course_name && s.course_code && !cMap.has(s.course_name)) {
          cMap.set(s.course_name, s.course_code);
        }
        if (s.lecturer && s.lecturer_code && !lMap.has(s.lecturer)) {
          lMap.set(s.lecturer, s.lecturer_code);
        }
      }

      return {
        courseOptions: Array.from(cMap.entries()).map(([name, code]) => ({
          value: name,
          label: `${name} (${code})`,
        })),
        courseCodeByName: cMap,
        lecturerOptions: Array.from(lMap.entries()).map(([name, code]) => ({
          value: name,
          label: `${name} [${code}]`,
        })),
        lecturerCodeByName: lMap,
        roomOptions: rooms.map((r) => ({ value: r.name, label: r.name })),
      };
    }, [allScheduleSessions, rooms]);

  /* ── Session row state helpers ─────────────────────────────────────────── */

  const addSession = useCallback(() => {
    setForm((prev) => ({ ...prev, sessions: [...prev.sessions, emptyRow()] }));
  }, []);

  const removeSession = useCallback((index: number) => {
    setForm((prev) => ({ ...prev, sessions: prev.sessions.filter((_, i) => i !== index) }));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const updateField = useCallback((index: number, field: keyof SessionRow, value: string) => {
    setForm((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
    setRowErrors((prev) => {
      if (!prev[index]) return prev;
      const row = { ...prev[index] };
      delete row[field];
      if (Object.keys(row).length === 0) {
        const next = { ...prev };
        delete next[index];
        return next;
      }
      return { ...prev, [index]: row };
    });
  }, []);

  const handleCourseChange = useCallback((index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s, i) => {
        if (i !== index) return s;
        const code = courseCodeByName.get(value) || '';
        return { ...s, course_name: value, course_code: code };
      }),
    }));
    setRowErrors((prev) => {
      if (!prev[index]) return prev;
      const row = { ...prev[index] };
      delete row.course_name;
      delete row.course_code;
      if (Object.keys(row).length === 0) {
        const next = { ...prev };
        delete next[index];
        return next;
      }
      return { ...prev, [index]: row };
    });
  }, [courseCodeByName]);

  const handleLecturerChange = useCallback((index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s, i) => {
        if (i !== index) return s;
        const code = lecturerCodeByName.get(value) || '';
        return { ...s, lecturer: value, lecturer_code: code };
      }),
    }));
    setRowErrors((prev) => {
      if (!prev[index]) return prev;
      const row = { ...prev[index] };
      delete row.lecturer;
      delete row.lecturer_code;
      if (Object.keys(row).length === 0) {
        const next = { ...prev };
        delete next[index];
        return next;
      }
      return { ...prev, [index]: row };
    });
  }, [lecturerCodeByName]);

  /* ── Validation ────────────────────────────────────────────────────────── */

  const validateSessions = useCallback((): boolean => {
    const newErrors: Record<number, Record<string, string>> = {};
    form.sessions.forEach((row, i) => {
      const errs = validateRow(row);
      if (Object.keys(errs).length > 0) newErrors[i] = errs;
    });
    setRowErrors(newErrors);
    if (form.sessions.length === 0) {
      setSessionError('Minimal 1 sesi diperlukan');
      return false;
    }
    setSessionError('');
    return Object.keys(newErrors).length === 0;
  }, [form.sessions]);

  /* ── Modal open/close ──────────────────────────────────────────────────── */

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, class_code: myClass || '' });
    setParseWarning(false);
    setUseRawFallback(false);
    setRawJson('');
    setRowErrors({});
    setSessionError('');
    setModalOpen(true);
  }

  function openEdit(p: Pengganti) {
    setEditing(p);
    setParseWarning(false);
    setUseRawFallback(false);
    setRawJson('');
    setRowErrors({});
    setSessionError('');

    let parsedSessions: SessionRow[] = [];
    if (Array.isArray(p.sessions)) {
      parsedSessions = p.sessions.map((s) => ({
        id: makeRowId(),
        time: typeof s.time === 'string' ? s.time : '',
        course_name: typeof s.course_name === 'string' ? s.course_name : '',
        course_code: typeof s.course_code === 'string' ? s.course_code : '',
        type: s.type === 'PR' ? 'PR' : 'TE',
        lecturer: typeof s.lecturer === 'string' ? s.lecturer : '',
        lecturer_code: typeof (s as unknown as Record<string, unknown>).lecturer_code === 'string'
          ? (s as unknown as Record<string, unknown>).lecturer_code as string
          : '',
        room: typeof s.room === 'string' ? s.room : '',
      }));
    } else if (p.sessions != null) {
      setParseWarning(true);
      setUseRawFallback(true);
      setRawJson(typeof p.sessions === 'string' ? p.sessions : JSON.stringify(p.sessions, null, 2));
    }

    setForm({
      class_code: p.class_code,
      date: p.date,
      kind: p.kind,
      note: p.note || '',
      sessions: parsedSessions,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setParseWarning(false);
    setUseRawFallback(false);
  }

  /* ── Save ──────────────────────────────────────────────────────────────── */

  async function handleSave() {
    setSaving(true);
    setError('');
    setSessionError('');
    setRowErrors({});

    try {
      let sessions: Array<Record<string, string>> = [];

      if (useRawFallback) {
        if (!rawJson.trim()) {
          setSessionError('Minimal 1 sesi diperlukan');
          setSaving(false);
          return;
        }
        try {
          const parsed = JSON.parse(rawJson);
          if (!Array.isArray(parsed)) {
            setError('Format sessions harus berupa array JSON');
            setSaving(false);
            return;
          }
          sessions = parsed;
        } catch {
          setError('Format sessions JSON salah');
          setSaving(false);
          return;
        }
      } else {
        if (!validateSessions()) {
          setSaving(false);
          return;
        }
        sessions = sessionsToJSON(form.sessions);
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
      notifyPengganti([form.class_code]);
      showToast('Pengganti berhasil disimpan', 'success');
      closeModal();
      loadPengganti();
    } catch (e: unknown) {
      const err = e as { body?: { error?: string } };
      setError(err.body?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete ────────────────────────────────────────────────────────────── */

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiClient.delete(`/admin/pengganti/${deleteId}`);
      setDeleteId(null);
      loadPengganti();
    } catch (e: unknown) {
      const err = e as { body?: { error?: string } };
      setError(err.body?.error || 'Gagal menghapus');
    }
  }

  /* ── Copy JSON preview ─────────────────────────────────────────────────── */

  function handleCopyJson() {
    const json = JSON.stringify(sessionsToJSON(form.sessions), null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (loading) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">Memuat...</div>;

  const classList = myClass ? CLASS_LIST.filter((c) => c === myClass) : CLASS_LIST;
  const kindMap: Record<string, string> = { replace: 'Pengganti', add: 'Penambahan', info: 'Info' };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kelola Pengganti</h1>
        <button onClick={openAdd} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          + Tambah Pengganti
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>}

      {/* ── Data table ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Kelas</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Tanggal</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Jenis</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Catatan</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.class_code.replace(/_/g, '-')}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.date}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                      {kindMap[p.kind] || p.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{p.note || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline mr-2">Edit</button>
                    <button onClick={() => setDeleteId(p.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">Hapus</button>
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

      {/* ── Edit / Add modal ────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Pengganti' : 'Tambah Pengganti'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas *</label>
              <select
                value={form.class_code}
                onChange={(e) => setForm({ ...form, class_code: e.target.value })}
                disabled={!isGlobal}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg disabled:bg-gray-100 dark:disabled:bg-gray-700"
              >
                {classList.map((c) => <option key={c} value={c}>{c.replace(/_/g, '-')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis *</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'replace' | 'add' | 'info' })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg">
              <option value="replace">Pengganti</option>
              <option value="add">Penambahan</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg" />
          </div>

          {/* ── Session builder ─────────────────────────────────────────── */}
          {useRawFallback ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sessions (JSON)</label>
              </div>
              {parseWarning && (
                <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-xs rounded-lg">
                  Data sesi tidak dapat ditampilkan dalam mode terstruktur. Menggunakan editor JSON.
                </div>
              )}
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg font-mono text-xs"
                placeholder='[{"time":"07.00-08.40","course_code":"25IF2114","course_name":"Basis Data","type":"TE","lecturer_code":"AD","lecturer":"Dr. Ade Chandra Nugraha","room":"D224-Kelas"}]'
              />
              {sessionError && <FieldError error={sessionError} />}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sesi Pengganti * {form.sessions.length > 0 && <span className="text-gray-400 dark:text-gray-500 font-normal">({form.sessions.length})</span>}
                </label>
                <button
                  type="button"
                  onClick={addSession}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >
                  + Tambah Sesi
                </button>
              </div>

              {sessionError && <div className="text-xs text-red-500 dark:text-red-400 mb-2">{sessionError}</div>}

              {form.sessions.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  Belum ada sesi. Klik &quot;+ Tambah Sesi&quot; untuk menambah.
                </p>
              )}

              <div className="space-y-3">
                {form.sessions.map((row, i) => (
                  <SessionCard
                    key={row.id}
                    row={row}
                    errors={rowErrors[i]}
                    courseOptions={courseOptions}
                    lecturerOptions={lecturerOptions}
                    roomOptions={roomOptions}
                    courseCodeByName={courseCodeByName}
                    lecturerCodeByName={lecturerCodeByName}
                    onCourseChange={(v) => handleCourseChange(i, v)}
                    onLecturerChange={(v) => handleLecturerChange(i, v)}
                    onFieldChange={(field, v) => updateField(i, field, v)}
                    onRemove={() => removeSession(i)}
                  />
                ))}
              </div>

              {form.sessions.length > 0 && (
                <button
                  type="button"
                  onClick={addSession}
                  className="w-full mt-3 p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  + Tambah Sesi
                </button>
              )}

              {/* ── Advanced: JSON preview ──────────────────────────────── */}
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 select-none">
                  Advanced — JSON Preview
                </summary>
                <div className="mt-2 relative">
                  <pre className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs font-mono overflow-auto max-h-48 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    {JSON.stringify(sessionsToJSON(form.sessions), null, 2)}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    {copied ? 'Tersalin!' : 'Salin'}
                  </button>
                </div>
              </details>
            </div>
          )}

          {/* ── Actions ─────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button onClick={closeModal} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm">Batal</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirmation modal ────────────────────────────────────── */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Hapus Pengganti">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Yakin ingin menghapus data pengganti ini?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm">Batal</button>
          <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Hapus</button>
        </div>
      </Modal>
    </div>
  );
}
