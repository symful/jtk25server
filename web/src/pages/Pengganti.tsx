import { useState, useEffect } from 'react';
import { apiClient } from '../api';
import type { Pengganti } from '../types';

export default function Pengganti() {
  const [data, setData] = useState<Pengganti[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterClass, setFilterClass] = useState('');

  useEffect(() => {
    apiClient.get<Pengganti[]>('/pengganti')
      .then(setData)
      .catch(() => setError('Gagal memuat data pengganti'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  if (error) return <Error msg={error} />;

  const filtered = filterClass
    ? data.filter((p) => p.class_code === filterClass)
    : data;

  const classes = [...new Set(data.map((p) => p.class_code))].sort();

  const kindLabel: Record<string, { text: string; color: string }> = {
    replace: { text: 'Pengganti', color: 'bg-yellow-100 text-yellow-700' },
    add: { text: 'Penambahan', color: 'bg-blue-100 text-blue-700' },
    info: { text: 'Info', color: 'bg-gray-100 text-gray-700' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pengganti</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter Kelas</label>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Semua Kelas</option>
          {classes.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, '-')}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Tidak ada data pengganti</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const kind = kindLabel[item.kind] || kindLabel.info;
            return (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${kind.color}`}>
                      {kind.text}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {item.class_code.replace(/_/g, '-')}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{formatDate(item.date)}</span>
                </div>
                {item.note && (
                  <p className="text-sm text-gray-600 mb-2">{item.note}</p>
                )}
                {item.sessions.length > 0 && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Detail Jadwal:</p>
                    {item.sessions.map((s, i) => (
                      <div key={i} className="text-sm text-gray-700">
                        <span className="font-medium">{s.time}</span> &middot;{' '}
                        {s.course_name} ({s.course_code}) &middot;{' '}
                        {s.lecturer} &middot; {s.room}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function Skeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-8 bg-gray-200 rounded w-48 mb-6 animate-pulse" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function Error({ msg }: { msg: string }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
      <p className="text-gray-500">{msg}</p>
    </div>
  );
}
