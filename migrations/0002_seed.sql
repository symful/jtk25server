-- Seed: Events, Announcements, Rooms

INSERT OR IGNORE INTO events (ext_id, title, description, date, end_date, location, category, class_name) VALUES ('evt-001', 'Kuliah Perdana Semester Ganjil 2026/2027', 'Kuliah perdana untuk seluruh kelas D3 dan D4 angkatan 2025. Hadir tepat waktu sesuai jadwal masing-masing.', '2026-09-01T07:00:00+07:00', '2026-09-01T18:00:00+07:00', 'Gedung JTK Polban', 'Akademik', NULL);
INSERT OR IGNORE INTO announcements (ext_id, title, body, pinned, expires_at) VALUES ('ann-001', 'Selamat Datang di Semester Ganjil 2026/2027', 'Selamat datang kembali untuk mahasiswa JTK angkatan 2025. Semoga semester ini berjalan lancar. Periksa jadwal masing-masing di menu Jadwal.', 1, '2026-12-31T23:59:59+07:00');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D101-Kelas', 'D101 Kelas', 'kelas');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D102-Lab. MT', 'D102 Lab. MT', 'lab');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D105-Kelas', 'D105 Kelas', 'kelas');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D106-Lab. SDB', 'D106 Lab. SDB', 'lab');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D107-Lab. RPL', 'D107 Lab. RPL', 'lab');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D108-Kelas', 'D108 Kelas', 'kelas');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D111-Kelas', 'D111 Kelas', 'kelas');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D112-Kelas', 'D112 Kelas', 'kelas');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D115-Lab. PjBL-1', 'D115 Lab. PjBL-1', 'lab');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D116-Lab. PjBL-2', 'D116 Lab. PjBL-2', 'lab');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D217-Kelas', 'D217 Kelas', 'kelas');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D219-Kelas', 'D219 Kelas', 'kelas');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D223-Kelas', 'D223 Kelas', 'kelas');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('D224-Kelas', 'D224 Kelas', 'kelas');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('H501-Lab. TI', 'H501 Lab. TI', 'lab');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('H502-Lab. AI', 'H502 Lab. AI', 'lab');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('H504-Kelas', 'H504 Kelas', 'kelas');
INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES ('H506-Kelas', 'H506 Kelas', 'kelas');
