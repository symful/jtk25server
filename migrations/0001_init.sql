-- JTK25 Database Schema
-- Semester: 2026/2027-GANJIL

-- ─── Schedules ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_name TEXT NOT NULL,
  semester TEXT NOT NULL DEFAULT '2026/2027-GANJIL',
  day TEXT NOT NULL CHECK(day IN ('SENIN','SELASA','RABU','KAMIS','JUMAT')),
  time TEXT NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('TE','PR')),
  lecturer_code TEXT NOT NULL,
  lecturer TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'offline' CHECK(mode IN ('offline','online')),
  slot_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_schedules_class ON schedules(class_name);
CREATE INDEX IF NOT EXISTS idx_schedules_semester ON schedules(semester);
CREATE INDEX IF NOT EXISTS idx_schedules_class_day ON schedules(class_name, day);

-- ─── Admin passwords ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_passwords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  description TEXT
);

-- ─── Events (Kalender) ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ext_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  location TEXT,
  category TEXT,
  class_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_class ON events(class_name);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- ─── Announcements ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ext_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER DEFAULT 0,
  class_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_announcements_class ON announcements(class_name);

-- ─── Pengganti (Schedule Overrides) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pengganti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ext_id TEXT NOT NULL UNIQUE,
  class_code TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('replace','add','info')),
  note TEXT,
  sessions TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pengganti_class ON pengganti(class_code);
CREATE INDEX IF NOT EXISTS idx_pengganti_date ON pengganti(date);

-- ─── Rooms ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ext_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('kelas','lab'))
);
