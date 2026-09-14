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
  slot_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_schedules_class ON schedules(class_name);
CREATE INDEX IF NOT EXISTS idx_schedules_semester ON schedules(semester);
CREATE INDEX IF NOT EXISTS idx_schedules_class_day ON schedules(class_name, day);

CREATE TABLE IF NOT EXISTS admin_passwords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  description TEXT
);
