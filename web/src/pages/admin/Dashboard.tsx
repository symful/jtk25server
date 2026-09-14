import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const sections = [
  { path: '/admin/jadwal', title: 'Jadwal', desc: 'Kelola jadwal kuliah', color: 'bg-blue-50 text-blue-600' },
  { path: '/admin/kalender', title: 'Kalender', desc: 'Kelola event & kegiatan', color: 'bg-purple-50 text-purple-600' },
  { path: '/admin/pengumuman', title: 'Pengumuman', desc: 'Kelola pengumuman', color: 'bg-yellow-50 text-yellow-600' },
  { path: '/admin/pengganti', title: 'Pengganti', desc: 'Kelola kelas pengganti', color: 'bg-orange-50 text-orange-600' },
  { path: '/admin/ruangan', title: 'Ruangan', desc: 'Kelola data ruangan', color: 'bg-cyan-50 text-cyan-600' },
];

export default function AdminDashboard() {
  const { scope, isGlobal } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scope: <span className={`font-medium ${isGlobal ? 'text-green-600' : 'text-primary-600'}`}>
            {isGlobal ? 'Global Admin' : scope?.replace('class:', '').replace('_', '-')}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((s) => (
          <Link
            key={s.path}
            to={s.path}
            className="group bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-primary-200 transition-all"
          >
            <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center text-lg font-bold mb-4`}>
              {s.title[0]}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
              {s.title}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
