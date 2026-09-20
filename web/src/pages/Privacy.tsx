export default function Privacy() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Kebijakan Privasi
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Terakhir diperbarui: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <div className="space-y-8 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
        <Section title="1. Pendahuluan">
          <p>
            Kebijakan Privasi ini menjelaskan bagaimana aplikasi <strong className="text-gray-900 dark:text-gray-100">JTK 25</strong> 
            dikembangkan dan dikelola oleh Program Studi Teknik Komputer dan Informatika, Politeknik Negeri Bandung, 
            mengumpulkan, menggunakan, dan melindungi informasi pengguna. Dengan menggunakan aplikasi ini, 
            pengguna dianggap telah membaca dan memahami kebijakan privasi yang berlaku.
          </p>
        </Section>

        <Section title="2. Pengumpulan Data">
          <p>Aplikasi JTK 25 mengumpulkan data yang diperlukan untuk menyediakan layanan jadwal perkuliahan, antara lain:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong className="text-gray-900 dark:text-gray-100">Data Jadwal:</strong> Informasi jadwal perkuliahan termasuk mata kuliah, dosen, waktu, dan kelas.</li>
            <li><strong className="text-gray-900 dark:text-gray-100">Data Ruangan:</strong> Informasi ketersediaan dan penggunaan ruangan kelas.</li>
            <li><strong className="text-gray-900 dark:text-gray-100">Pengumuman:</strong> Berita dan pengumuman terkait kegiatan akademik yang dipublikasikan oleh administrator.</li>
          </ul>
          <p className="mt-2">
            Data tersebut bersifat publik dan tidak memerlukan identitas pribadi pengguna untuk mengaksesnya.
          </p>
        </Section>

        <Section title="3. Firebase Cloud Messaging (Notifikasi Push)">
          <p>
            Aplikasi ini menggunakan layanan <strong className="text-gray-900 dark:text-gray-100">Firebase Cloud Messaging (FCM)</strong> 
            dari Google untuk mengirimkan notifikasi push kepada pengguna. FCM dapat mengumpulkan informasi berikut:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Token perangkat yang digunakan untuk pengiriman notifikasi.</li>
            <li>Informasi jenis perangkat dan sistem operasi.</li>
          </ul>
          <p className="mt-2">
            Informasi ini digunakan semata-mata untuk keperluan pengiriman notifikasi mengenai 
            perubahan jadwal, pengumuman baru, dan informasi akademik lainnya. Pengguna dapat 
            menonaktifkan notifikasi kapan saja melalui pengaturan perangkat atau tombol notifikasi pada aplikasi.
          </p>
          <p className="mt-2">
            Kebijakan privasi Google Firebase dapat dilihat di: <span className="text-indigo-600 dark:text-indigo-400">https://policies.google.com/privacy</span>
          </p>
        </Section>

        <Section title="4. Penyimpanan Lokal">
          <p>
            Aplikasi ini menggunakan <strong className="text-gray-900 dark:text-gray-100">penyimpanan lokal (local storage)</strong> 
            pada perangkat pengguna untuk menyimpan preferensi penggunaan, seperti pengaturan tema 
            (mode gelap/terang) dan status langganan notifikasi. Data ini tidak dikirim ke server 
            manapun dan hanya tersimpan di perangkat pengguna.
          </p>
        </Section>

        <Section title="5. Berbagi Data">
          <p>
            <strong className="text-gray-900 dark:text-gray-100">Kami tidak menjual, menyewakan, atau membagikan data pengguna 
            kepada pihak ketiga untuk tujuan komersial.</strong> Satu-satunya layanan pihak ketiga yang 
            digunakan adalah Firebase Cloud Messaging dari Google untuk pengiriman notifikasi, 
            yang tunduk pada kebijakan privasi Google.
          </p>
        </Section>

        <Section title="6. Keamanan Data">
          <p>
            Kami berkomitmen untuk melindungi data yang dikelola oleh aplikasi ini. Beberapa langkah 
            keamanan yang diterapkan meliputi:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Koneksi menggunakan protokol HTTPS.</li>
            <li>Akses ke panel administrasi dilindungi dengan autentikasi.</li>
            <li>Data sensitif tidak disimpan di sisi klien.</li>
          </ul>
          <p className="mt-2">
            Meskipun demikian, tidak ada metode transmisi atau penyimpanan elektronik yang 
            sepenuhnya aman. Kami terus berusaha menerapkan langkah-langkah keamanan terbaik 
            untuk melindungi informasi.
          </p>
        </Section>

        <Section title="7. Hak Pengguna">
          <p>Pengguna aplikasi JTK 25 memiliki hak untuk:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Mengakses informasi jadwal, ruangan, dan pengumuman secara bebas.</li>
            <li>Menonaktifkan atau mengaktifkan notifikasi push kapan saja.</li>
            <li>Meminta informasi lebih lanjut mengenai data yang dikumpulkan melalui kontak yang tersedia.</li>
          </ul>
        </Section>

        <Section title="8. Perubahan Kebijakan Privasi">
          <p>
            Kebijakan Privasi ini dapat diperbarui dari waktu ke waktu tanpa pemberitahuan sebelumnya. 
            Perubahan akan berlaku segera setelah dipublikasikan pada halaman ini. Pengguna disarankan 
            untuk secara berkala memeriksa halaman ini untuk mengetahui pembaruan yang mungkin terjadi.
          </p>
        </Section>

        <Section title="9. Kontak">
          <p>
            Jika pengguna memiliki pertanyaan atau masalah terkait Kebijakan Privasi ini, 
            silakan hubungi Program Studi Teknik Komputer dan Informatika, Politeknik Negeri Bandung 
            melalui:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Email: <span className="text-indigo-600 dark:text-indigo-400">tkjtk@polban.ac.id</span></li>
            <li>Website: <span className="text-indigo-600 dark:text-indigo-400">https://tkj.polban.ac.id</span></li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h2>
      {children}
    </section>
  );
}
