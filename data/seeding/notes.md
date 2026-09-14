# Seeding Notes — Transformasi dari Markdown ke JSON Schema v2

## Sumber Data

1. `Jadwal_D3_Semester_3_2026-2027.md` — Jadwal D3 Teknik Informatika Semester 3 (Kelas A & B)
2. `Jadwal_D4_Semester_3_2026-2027.md` — Jadwal D4 Teknik Informatika Semester 3 Transisi (Kelas A, B, C, D)
3. `ID_Dosen_JTK.md` — Daftar 42 dosen JTK dari ID Dosen JTK.pdf

## Transformasi yang Diterapkan

### 1. T → TE, P → PR
- Dalam sumber markdown, jenis sesi ditulis sebagai `T` (Teori) atau `P` (Praktik).
- Di JSON v2, dikonversi menjadi `TE` (Teori) dan `PR` (Praktik) untuk konsistensi dengan legacy format.

### 2. Ruang: Normalisasi Spasi
- Sumber markdown menulis ruang dengan spasi: `D102 - Lab. MT`, `D108 - Kelas`, `H501 - Lab. TI`.
- Di JSON, dinormalisasi ke gaya legacy: `D102-Lab. MT`, `D108-Kelas`, `H501-Lab. TI` (tanpa spasi di sekitar dash).

### 3. Multi-dosen: `+` → `, `
- Sumber markdown memisahkan beberapa dosen dengan `+`: `MV+LH+RA`, `WW+AE+IW`.
- Di JSON, dikonversi menjadi koma: `MV, LH, RA`, `WW, AE, IW`.
- Field `lecturer` juga berisi nama lengkap dipisah koma tanpa `+`.

### 4. Waktu Tetap Verbatim (Tidak Di-explode per 50 menit)
- Setiap baris tabel di markdown merupakan satu session object di JSON.
- Contoh: `07.00-12.20` (6 jam ke) tetap sebagai satu entry, bukan 6 entry terpisah.
- Client merge logic yang menangani penggabungan slot.

### 5. Span yang Melewati Jeda (Break)
- D4-3T-D Kamis: Sistem Basis Data (PR) `11.30-15.20` (jam ke-6 sampai ke-9).
- Waktu ini MELEWATI jeda `12.20-13.00`, tetapi disimpan sebagai span verbatim satu session object.
- Tidak ada fragmentasi per segmen waktu.

### 6. Course Name: Nama Lengkap
- Semua nama mata kuliah menggunakan nama lengkap dari katalog (A.3), bukan singkatan.
- Contoh: `Pengantar Rekayasa Perangkat Lunak` (bukan "Peng. RPL"), `Komunikasi Data dan Jaringan` (bukan "Komdat"), `Matematika Diskrit 2` (bukan "Matdis").

### 7. Lecturer Name: Konsisten sesuai Sumber
- Nama dosen menggunakan format dari source markdown: D3 tanpa gelar, D4 dengan gelar lengkap.
- Semua kode dosen ada di dosen.json (42 entri lengkap).

## File yang Dihasilkan

| File | Isi |
|---|---|
| `schedules_D3_S3_A.json` | Jadwal D3-3A (11 sesi/row) |
| `schedules_D3_S3_B.json` | Jadwal D3-3B (11 sesi/row) |
| `schedules_D4_S3T_A.json` | Jadwal D4-3T-A (13 sesi/row) |
| `schedules_D4_S3T_B.json` | Jadwal D4-3T-B (13 sesi/row) |
| `schedules_D4_S3T_C.json` | Jadwal D4-3T-C (13 sesi/row) |
| `schedules_D4_S3T_D.json` | Jadwal D4-3T-D (13 sesi/row) |
| `dosen.json` | 42 dosen lengkap (code + nama + gelar) |
| `rooms.json` | 16 ruangan unik dari seluruh jadwal |
| `pengganti.json` | Array kosong (belum ada pengganti) |
| `announcements.json` | 1 contoh pengumuman seed |
| `events.json` | 1 contoh event seed |
