# JTK25 Server

Backend API untuk jadwal perkuliahan JTK (Jaringan Telekomunikasi dan Komputer) Politeknik Negeri Bali.

Dibangun dengan [Hono](https://hono.dev) di [Cloudflare Workers](https://workers.cloudflare.com). Data di-**bundle langsung ke dalam Worker** (static JSON imports) — zero runtime fetches.

## URL Produksi

- **Custom Domain:** <https://jtk25.my.id>
- **Workers.dev:** <https://jtk25server.careday17.workers.dev>

## Endpoint API

### v1 (Current)

| Endpoint | Method | Deskripsi | Response Shape |
|----------|--------|-----------|----------------|
| `/api/v1/meta` | GET | Data version hash (SHA-256) + ETag/304 | `{ schema: 2, dataVersion: "..." }` |
| `/api/v1/schedules` | GET | Semua jadwal kuliah (6 kelas) | `{ semester, classes: [{ class_name, schedule }] }` |
| `/api/v1/pengganti` | GET | Jadwal pengganti | `[{ id, class_code, date, kind, ... }]` |
| `/api/v1/announcements` | GET | Pengumuman kampus | `[{ id, title, body, pinned, createdAt, expiresAt }]` |
| `/api/v1/events` | GET | Kegiatan kampus | `[{ id, title, date, endDate, location, category }]` |
| `/api/v1/dosen` | GET | Data 42 dosen | `[{ code, name }]` |
| `/api/v1/rooms` | GET | Data 16 ruangan | `[{ id, name, type }]` |

### Legacy

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/version` | GET | Versi API (`"2.0"`) |
| `/api/schedules` | GET | Kompatibilitas format lama (`academic_year`, `semester`, `curriculum`, `classes`) |

### Middleware

- **CORS** — `hono/cors()` untuk semua route
- **ETag** — `hono/etag()` untuk semua route
- **Cache-Control** — `public, max-age=60` untuk `/api/*`

### Caching

- **ETag**: Setiap respons `/api/v1/meta` menyertakan ETag berbasis SHA-256 hash dari seluruh data
- **304 Not Modified**: Mendukung `If-None-Match` untuk efisiensi bandwidth
- **SPA Assets**: Cache-Control diatur via `_headers` file (no-cache entrypoints, 7-day CDN untuk static assets)

## Arsitektur Data

### Data Files (11 file, bundled ke Worker)

```
data/
├── schedules_D3_S3_A.json     # Jadwal D3-2A (semester 3)
├── schedules_D3_S3_B.json     # Jadwal D3-2B
├── schedules_D4_S3_A.json     # Jadwal D4-3T-A
├── schedules_D4_S3_B.json     # Jadwal D4-3T-B
├── schedules_D4_S3_C.json     # Jadwal D4-3T-C
├── schedules_D4_S3_D.json     # Jadwal D4-3T-D
├── pengganti.json             # Jadwal pengganti (saat ini kosong)
├── announcements.json         # Pengumuman (1 seed entry)
├── events.json                # Kegiatan (1 seed entry)
├── dosen.json                 # 42 dosen (code + name)
└── rooms.json                 # 16 ruangan (kelas + lab)
```

### Format Data (Schema v2)

Semua file mengikuti envelope:

```json
{
  "schema": 2,
  "semester": "Ganjil 2025/2026",
  "updatedAt": "2025-09-01T00:00:00Z",
  "data": [...]
}
```

### Session Shape

```json
{
  "time": "07.00-12.20",
  "course_code": "25IF2116",
  "course_name": "Pemrograman RPL",
  "type": "TE",
  "lecturer_code": "MV, LH, RA",
  "lecturer": "Nama Lengkap",
  "room": "H501-Lab. TI"
}
```

### Alur Update Data

1. Edit file JSON di `data/` pada branch `main`
2. Commit dan push
3. Validate: `npm run validate`
4. Deploy: `npm run deploy` (build web + wrangler deploy)
5. Data terbaru langsung tersedia di API

### Data Legacy (6 file, TIDAK dilayani Worker)

```
data/legacy/
├── schedules_1A_D3.json       # Format v1 lama (semester 1)
├── schedules_1A_D4.json
├── schedules_1B_D3.json
├── schedules_1B_D4.json
├── schedules_1C_D4.json
└── schedules_1D_D4.json
```

Format v1 berbeda: tidak ada wrapper `schema`/`semester`/`updatedAt`, shape `{ academic_year, semester, curriculum, class_name, schedule }`.

### Seeding Reference

```
data/seeding/
├── notes.md                              # Aturan transformasi markdown → JSON v2
├── Jadwal_D3_Semester_3_2026-2027.md     # Source markdown D3
├── Jadwal_D4_Semester_3_2026-2027.md     # Source markdown D4
└── ID_Dosen_JTK.md                       # Source 42 lecturer IDs
```

## Validasi

### JSON Schema (6 file)

```
schemas/
├── schedule-class.json    # Jadwal per kelas (DotTime pattern, Day enum, CourseType TE/PR)
├── pengganti.json         # Pengganti (PenggantiKind: replace/add/info)
├── announcements.json     # Pengumuman
├── events.json            # Kegiatan
├── dosen.json             # Dosen
└── rooms.json             # Ruangan
```

### Cross-file Validation Rules

1. **Schedule**: Setiap `lecturer_code` harus ada di `dosen.json`
2. **Pengganti**: `lecturer_code` harus ada di `dosen.json`; date harus valid YYYY-MM-DD
3. **Semua list files**: Duplicate `id` ditolak

```bash
npm run validate                              # Validasi semua data
tsx tools/validate.ts FILE...                 # Validasi file tertentu
tsx tools/validate.ts --dir <path> FILE...    # Custom data directory
```

## Teknologi

| Komponen | Teknologi |
|----------|-----------|
| Runtime | Cloudflare Workers (V8 isolates) |
| Framework | Hono v4 |
| Bahasa | TypeScript |
| Data | Static JSON (bundled at build time) |
| Validasi | AJV + ajv-formats (JSON Schema draft-07) |
| Testing | Vitest |
| Domain | `jtk25.my.id` + `www.jtk25.my.id` (custom domain) |
| CI | GitHub Actions (validate + test) |

## Pengembangan

```bash
npm install                     # Install dependencies
npm run dev                     # Dev server (localhost:8787)
npm run validate                # Validasi data files
npm run test                    # Jalankan test suite
```

### Scripts

| Script | Command | Deskripsi |
|--------|---------|-----------|
| `dev` | `wrangler dev` | Local dev server |
| `build:web` | `cd ../client && flutter build web --release && cd ../server && node scripts/copy-web.js` | Build Flutter web + copy |
| `deploy` | `npm run build:web && wrangler deploy` | Full deploy |
| `validate` | `tsx tools/validate.ts` | Validasi data |
| `test` | `vitest run` | Test suite |

### Dependencies

| Package | Versi | Fungsi |
|---------|-------|--------|
| hono | ^4.13.7 | HTTP framework |
| @cloudflare/workers-types | ^5.20260911.1 | Workers types |
| @types/node | ^26.5.1 | Node.js types |
| ajv | ^8.20.0 | JSON Schema validator |
| ajv-formats | ^3.0.1 | Format plugins |
| tsx | ^4.23.13 | TypeScript execution |
| vitest | ^5.0.0 | Test framework |

## Deploy

Deploy manual — tidak ada CI/CD pipeline untuk deploy.

```bash
npm run deploy        # Build web (Flutter) + deploy Worker
npx wrangler deploy   # Deploy Worker saja (tanpa rebuild web)
```

Jangan pernah commit API token atau credential Cloudflare ke repository.

## Struktur Proyek

```
server/
├── src/
│   ├── index.ts               # Hono app: 9 endpoints + SPA fallback, 112 lines
│   └── data.ts                # Data loading: static imports + SHA-256 hash, 77 lines
│
├── data/                      # 11 JSON files (6 schedules + 5 master data)
│   ├── legacy/                # 6 files format v1 (tidak dilayani Worker)
│   └── seeding/               # Source markdown + aturan transformasi
│
├── schemas/                   # 6 JSON Schema files (draft-07)
├── tools/
│   └── validate.ts            # CLI validator: AJV + cross-file rules, 214 lines
├── scripts/
│   └── copy-web.js            # Copy Flutter build → client_build/web/
│
├── tests/
│   ├── data.test.ts           # Data layer tests (140 lines)
│   ├── validate.test.ts       # Validation tests (60 lines)
│   └── fixtures/bad/          # 5 bad fixture files (rejected by validator)
│
├── client_build/web/          # Build output Flutter web (SPA)
├── wrangler.jsonc             # Cloudflare Workers config
├── package.json               # Node.js project config
├── worker-configuration.d.ts  # Auto-generated Worker env types
├── .github/workflows/ci.yml   # CI: validate + test
├── LICENSE                    # SSPL v1
├── CONTRIBUTING.md            # Panduan kontribusi
└── README.md                  # File ini
```

## CI/CD

### Server CI (`.github/workflows/ci.yml`)

- Trigger: push/PR ke `main`
- Runner: ubuntu-latest, Node 22
- Jobs:
  1. **Validate** — `npm run validate` (cek validitas JSON schema + cross-file rules)
  2. **Test** — `npm run test` (vitest)

## Lisensi

SSPL v1 — Lihat [LICENSE](LICENSE) untuk detail.
