import { useState, useEffect } from 'react';
import { apiClient } from '../api';
import type { SchedulesResponse, ClassSchedule, DaySchedule, Pengganti } from '../types';
import { DAYS } from '../types';

export default function Jadwal() {
  const [data, setData] = useState<SchedulesResponse | null>(null);
  const [pengganti, setPengganti] = useState<Pengganti[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'jadwal' | 'pengganti'>('jadwal');

  useEffect(() => {
    Promise.all([
      apiClient.get<SchedulesResponse>('/schedules'),
      apiClient.get<Pengganti[]>('/pengganti'),
    ])
      .then(([sched, pg]) => {
        setData(sched);
        setPengganti(pg);
        const year2 = sched.classes.filter((c) => /[_-]2[A-Z]/.test(c.class_name));
        if (year2.length > 0) setSelectedClass(year2[0].class_name);
      })
      .catch(() => setError('Gagal memuat jadwal'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorMessage message={error} />;

  const classes = (data?.classes ?? []).filter((c) => /[_-]2[A-Z]/.test(c.class_name));
  const selected = classes.find((c) => c.class_name === selectedClass);
  const classCode = selectedClass.replace(/_/g, '-');
  const classPengganti = pengganti.filter((p) => p.class_code === classCode);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Jadwal Kuliah</h1>
        {data?.semester && <p className="text-sm text-gray-500">{data.semester}</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {classes.map((c) => (
            <option key={c.class_name} value={c.class_name}>
              {c.class_name.replace(/_/g, '-')}
            </option>
          ))}
        </select>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab('jadwal')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === 'jadwal' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Jadwal
          </button>
          <button
            onClick={() => setTab('pengganti')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === 'pengganti' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pengganti {classPengganti.length > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 rounded-full">{classPengganti.length}</span>
            )}
          </button>
        </div>
      </div>

      {tab === 'jadwal' && selected && <ScheduleTable data={selected} />}
      {tab === 'pengganti' && <PenggantiTable entries={classPengganti} />}

      {!selected && tab === 'jadwal' && classes.length === 0 && (
        <div className="text-center py-12 text-gray-400">Belum ada data jadwal</div>
      )}
    </div>
  );
}

function ScheduleTable({ data }: { data: ClassSchedule }) {
  return (
    <div className="space-y-6">
      {data.schedule.map((day) => (
        <div key={day.day} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
            <h3 className="font-semibold text-indigo-700">{day.day}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Jam</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Kode</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Mata Kuliah</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Tipe</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Dosen</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Ruang</th>
                </tr>
              </thead>
              <tbody>
                {day.sessions.map((s, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{s.time}</td>
                    <td className="px-4 py-3 text-indigo-600 font-medium">{s.course_code}</td>
                    <td className="px-4 py-3">{s.course_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.type === 'PR' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {s.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.lecturer || s.lecturer_code}</td>
                    <td className="px-4 py-3 text-gray-600">{s.room}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function PenggantiTable({ entries }: { entries: Pengganti[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        Tidak ada jadwal pengganti untuk kelas ini
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((pg) => (
        <div key={pg.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
            <div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${
                pg.kind === 'replace' ? 'bg-red-100 text-red-700'
                : pg.kind === 'add' ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
              }`}>
                {pg.kind === 'replace' ? 'Ganti' : pg.kind === 'add' ? 'Tambah' : 'Info'}
              </span>
              <span className="font-medium text-gray-900">{pg.date}</span>
            </div>
            {pg.note && <span className="text-sm text-gray-500">{pg.note}</span>}
          </div>
          {pg.sessions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Jam</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Kode</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Mata Kuliah</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Tipe</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Dosen</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Ruang</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.sessions.map((s, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{s.time}</td>
                      <td className="px-4 py-3 text-indigo-600 font-medium">{s.course_code}</td>
                      <td className="px-4 py-3">{s.course_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.type === 'PR' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {s.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.lecturer}</td>
                      <td className="px-4 py-3 text-gray-600">{s.room}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-8 bg-gray-200 rounded w-48 mb-6 animate-pulse" />
      <div className="h-10 bg-gray-200 rounded w-64 mb-6 animate-pulse" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border p-4 mb-4 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
      <p className="text-gray-500">{message}</p>
    </div>
  );
}
