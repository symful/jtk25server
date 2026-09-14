import { Link } from 'react-router-dom';

const sections = [
  { path: '/jadwal', title: 'Jadwal Kuliah', desc: 'Lihat jadwal perkuliahan & pengganti per kelas' },
  { path: '/kalender', title: 'Kalender', desc: 'Jadwal kegiatan & event akademik' },
  { path: '/pengumuman', title: 'Pengumuman', desc: 'Pengumuman penting terbaru' },
  { path: '/ruangan', title: 'Ruangan', desc: 'Daftar ruangan kelas & lab' },
];

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">JTK 25</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Portal informasi jadwal dan kegiatan Program Studi Teknik Komputer dan Informatika
          Politeknik Negeri Bandung
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {sections.map((s) => (
          <Link
            key={s.path}
            to={s.path}
            className="group bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2">
              {s.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
