# JTK25Server

Repositori jadwal server JTK25 Politeknik Negeri Bandung.

## Struktur Data

Data jadwal tersimpan dalam format JSON di folder `data/` dengan penamaan file mengikuti format:
- `schedules_{kelas}_{program}.json`
- Contoh: `schedules_1A_D3.json`, `schedules_1B_D4.json`

## Cara Berkontribusi

1. **Fork** repositori ini ke akun GitHub Anda
2. **Clone** hasil fork ke komputer lokal:
   git clone https://github.com/username-anda/JTK25Server.git
3. **Buat branch baru** untuk perubahan Anda:
   git checkout -b update-jadwal-kelas-1A
4. **Lakukan perubahan** pada file JSON yang sesuai di folder `data/`
   - Pastikan format JSON tetap valid
   - Sesuaikan dengan kelas yang ingin diubah
5. **Commit** perubahan Anda:
   git add .
   git commit -m "Update jadwal kelas 1A D3"
6. **Push** ke branch Anda:
   git push origin update-jadwal-kelas-1A
7. **Buat Pull Request** ke repositori utama melalui antarmuka GitHub

## Lisensi

Kode ini dilisensikan di bawah **GNU General Public License v3.0**.

### Apa artinya?
- ✅ Anda bebas menggunakan, memodifikasi, dan mendistribusikan kode ini
- ✅ Anda harus menyertakan lisensi yang sama jika mendistribusikan ulang
- ✅ Perubahan harus dicantumkan secara terbuka
- ❌ Tidak boleh digunakan dalam perangkat lunak tertutup/proprietary

---

*Dibuat dengan ❤️ untuk mahasiswa JTK Politeknik Negeri Bandung*
