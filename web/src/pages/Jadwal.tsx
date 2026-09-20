import { useState, useEffect } from 'react';
import { apiClient } from '../api';
import type { SchedulesResponse, ClassSchedule } from '../types';

const STORAGE_KEY = 'jtk25_selected_class';

export default function Jadwal() {
  const [data, setData] = useState<SchedulesResponse | null>(null);
  const [selectedClass, setSelectedClass] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get<SchedulesResponse>('/schedules')
      .then((sched) => {
        setData(sched);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && sched.classes.some((c) => c.class_name === stored)) {
          setSelectedClass(stored);
        } else {
          const year2 = sched.classes.filter((c) => /[_-]2[A-Z]/.test(c.class_name));
          if (year2.length > 0) setSelectedClass(year2[0].class_name);
        }
      })
      .catch(() => setError('Gagal memuat jadwal'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorMessage message={error} />;

  const classes = (data?.classes ?? []).filter((c) => /[_-]2[A-Z]/.test(c.class_name));
  const selected = classes.find((c) => c.class_name === selectedClass);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Jadwal Kuliah</h1>
        {data?.semester && <p className="text-sm text-gray-500 dark:text-gray-400">{data.semester}</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select
          value={selectedClass}
          onChange={(e) => {
            setSelectedClass(e.target.value);
            localStorage.setItem(STORAGE_KEY, e.target.value);
          }}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {classes.map((c) => (
            <option key={c.class_name} value={c.class_name}>
              {c.class_name.replace(/_/g, '-')}
            </option>
          ))}
        </select>
      </div>

      {selected && <ScheduleTable data={selected} />}

      {!selected && classes.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">Belum ada data jadwal</div>
      )}
    </div>
  );
}

function ScheduleTable({ data }: { data: ClassSchedule }) {
  return (
    <div className="space-y-6">
      {data.schedule.map((day) => (
        <div key={day.day} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800">
            <h3 className="font-semibold text-indigo-700 dark:text-indigo-300">{day.day}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Jam</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Kode</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Mata Kuliah</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Tipe</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Dosen</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Ruang</th>
                </tr>
              </thead>
              <tbody>
                {day.sessions.map((s, i) => (
                  <tr key={i} className="border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">{s.time}</td>
                    <td className="px-4 py-3 text-indigo-600 dark:text-indigo-400 font-medium">{s.course_code}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{s.course_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.type === 'PR' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {s.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.lecturer || s.lecturer_code}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.room}</td>
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

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6 animate-pulse" />
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-6 animate-pulse" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 mb-4 animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-12 bg-gray-100 dark:bg-gray-800 rounded" />
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
      <p className="text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
