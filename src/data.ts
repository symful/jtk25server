import dosenJson from "../data/dosen.json";
import calendarJson from "../data/calendar.json";
import announcementsJson from "../data/announcements.json";
import penggantiJson from "../data/pengganti.json";
import roomsJson from "../data/rooms.json";

// ─── Static list files (still bundled at build time) ─────────────────────────

export const LIST_FILES = [
  "announcements.json",
  "dosen.json",
  "calendar.json",
  "pengganti.json",
  "rooms.json",
] as const;

const LIST_DATA_MAP: Record<string, unknown> = {
  "announcements.json": announcementsJson,
  "dosen.json": dosenJson,
  "calendar.json": calendarJson,
  "pengganti.json": penggantiJson,
  "rooms.json": roomsJson,
};

// ─── Class file names (for backward-compatible metadata) ─────────────────────

export const CLASS_FILES = [
  "schedules_D3_1A.json",
  "schedules_D3_1B.json",
  "schedules_D3_2A.json",
  "schedules_D3_2B.json",
  "schedules_D3_3A.json",
  "schedules_D3_3B.json",
  "schedules_D3_3C.json",
  "schedules_D4_1A.json",
  "schedules_D4_1B.json",
  "schedules_D4_1C.json",
  "schedules_D4_1D.json",
  "schedules_D4_2A.json",
  "schedules_D4_2B.json",
  "schedules_D4_2C.json",
  "schedules_D4_2D.json",
  "schedules_D4_3A.json",
  "schedules_D4_3B.json",
  "schedules_D4_4A.json",
  "schedules_D4_4B.json",
] as const;

export const ALL_FILES: readonly string[] = [...CLASS_FILES, ...LIST_FILES];

// ─── Legacy helpers (for static list files only) ─────────────────────────────

export function getFileData(file: string): unknown {
  return LIST_DATA_MAP[file] ?? null;
}

export function getFilesData(files: readonly string[]): Map<string, unknown> {
  const results = new Map<string, unknown>();
  for (const f of files) {
    results.set(f, LIST_DATA_MAP[f] ?? null);
  }
  return results;
}

// ─── D1 schedule types ───────────────────────────────────────────────────────

interface D1ScheduleRow {
  id: number;
  class_name: string;
  semester: string;
  day: string;
  time: string;
  course_code: string;
  course_name: string;
  type: string;
  lecturer_code: string;
  lecturer: string;
  room: string;
  slot_order: number;
  mode: string;
}

interface ScheduleSession {
  id: number;
  time: string;
  course_code: string;
  course_name: string;
  type: string;
  lecturer_code: string;
  lecturer: string;
  room: string;
  mode: string;
}

interface DaySchedule {
  day: string;
  sessions: ScheduleSession[];
}

export interface ClassSchedule {
  class_name: string;
  schedule: DaySchedule[];
}

interface AdminScheduleRow extends D1ScheduleRow {}

export type { AdminScheduleRow, ClassSchedule, DaySchedule, ScheduleSession };

// ─── D1 schedule queries ─────────────────────────────────────────────────────

export async function getSchedulesFromD1(
  db: D1Database,
): Promise<{ semester: string; classes: ClassSchedule[] }> {
  const { results } = await db
    .prepare(
      `SELECT id, class_name, semester, day, time, course_code, course_name,
              type, lecturer_code, lecturer, room, slot_order,
              COALESCE(mode, 'offline') as mode
       FROM schedules
       ORDER BY class_name, slot_order`,
    )
    .all<D1ScheduleRow>();

  return groupScheduleRows(results);
}

export async function getScheduleFromClass(
  db: D1Database,
  className: string,
): Promise<{ semester: string; data: ClassSchedule } | null> {
  const { results } = await db
    .prepare(
      `SELECT id, class_name, semester, day, time, course_code, course_name,
              type, lecturer_code, lecturer, room, slot_order,
              COALESCE(mode, 'offline') as mode
       FROM schedules
       WHERE class_name = ?
       ORDER BY slot_order`,
    )
    .bind(className)
    .all<D1ScheduleRow>();

  if (results.length === 0) return null;

  const grouped = groupScheduleRows(results);
  return {
    semester: grouped.semester,
    data: grouped.classes[0] ?? { class_name: className, schedule: [] },
  };
}

export async function getScheduleRowById(
  db: D1Database,
  id: number,
): Promise<AdminScheduleRow | null> {
  return db
    .prepare(`SELECT * FROM schedules WHERE id = ?`)
    .bind(id)
    .first<AdminScheduleRow>();
}

export async function getAllScheduleRows(
  db: D1Database,
): Promise<AdminScheduleRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM schedules ORDER BY class_name, slot_order`,
    )
    .all<AdminScheduleRow>();
  return results;
}

export async function insertScheduleRow(
  db: D1Database,
  row: Omit<D1ScheduleRow, "id" | "created_at" | "updated_at">,
): Promise<number> {
  const stmt = db.prepare(
    `INSERT INTO schedules (class_name, semester, day, time, course_code, course_name,
                           type, lecturer_code, lecturer, room, slot_order, mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const result = await stmt
    .bind(
      row.class_name,
      row.semester,
      row.day,
      row.time,
      row.course_code,
      row.course_name,
      row.type,
      row.lecturer_code,
      row.lecturer,
      row.room,
      row.slot_order,
      row.mode ?? 'offline',
    )
    .run();
  return result.meta.last_row_id;
}

export async function updateScheduleRow(
  db: D1Database,
  id: number,
  row: Omit<D1ScheduleRow, "id" | "created_at" | "updated_at">,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE schedules
       SET class_name = ?, semester = ?, day = ?, time = ?,
           course_code = ?, course_name = ?, type = ?,
           lecturer_code = ?, lecturer = ?, room = ?, slot_order = ?,
           mode = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(
      row.class_name,
      row.semester,
      row.day,
      row.time,
      row.course_code,
      row.course_name,
      row.type,
      row.lecturer_code,
      row.lecturer,
      row.room,
      row.slot_order,
      row.mode ?? 'offline',
      id,
    )
    .run();
  return result.success;
}

export async function deleteScheduleRow(
  db: D1Database,
  id: number,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM schedules WHERE id = ?`)
    .bind(id)
    .run();
  return result.success;
}

export async function getAdminPassword(
  db: D1Database,
  scope: string,
): Promise<{ id: number; scope: string; password_hash: string; description: string | null } | null> {
  return db
    .prepare(`SELECT id, scope, password_hash, description FROM admin_passwords WHERE scope = ?`)
    .bind(scope)
    .first();
}

// ─── Content table types ─────────────────────────────────────────────────────

export interface EventRow {
  id: number;
  ext_id: string;
  title: string;
  description: string | null;
  date: string;
  end_date: string;
  location: string | null;
  category: string | null;
  class_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementRow {
  id: number;
  ext_id: string;
  title: string;
  body: string;
  pinned: number;
  class_name: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface PenggantiRow {
  id: number;
  ext_id: string;
  class_code: string;
  date: string;
  kind: "replace" | "add" | "info";
  note: string | null;
  sessions: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

export interface RoomRow {
  id: number;
  ext_id: string;
  name: string;
  type: "kelas" | "lab";
}

// ─── Events CRUD ─────────────────────────────────────────────────────────────

export async function getEventsFromD1(
  db: D1Database,
  className?: string,
): Promise<EventRow[]> {
  if (className) {
    const { results } = await db
      .prepare(
        `SELECT id, ext_id, title, description, date, end_date, location, category,
                class_name, created_at, updated_at
         FROM events
         WHERE class_name = ? OR class_name IS NULL
         ORDER BY date`,
      )
      .bind(className)
      .all<EventRow>();
    return results;
  }
  const { results } = await db
    .prepare(
      `SELECT id, ext_id, title, description, date, end_date, location, category,
              class_name, created_at, updated_at
       FROM events
       ORDER BY date`,
    )
    .all<EventRow>();
  return results;
}

export async function getEventById(
  db: D1Database,
  id: number,
): Promise<EventRow | null> {
  return db
    .prepare(
      `SELECT id, ext_id, title, description, date, end_date, location, category,
              class_name, created_at, updated_at
       FROM events WHERE id = ?`,
    )
    .bind(id)
    .first<EventRow>();
}

export async function insertEvent(
  db: D1Database,
  row: Omit<EventRow, "id" | "created_at" | "updated_at">,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO events (ext_id, title, description, date, end_date, location, category, class_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.ext_id,
      row.title,
      row.description,
      row.date,
      row.end_date,
      row.location,
      row.category,
      row.class_name,
    )
    .run();
  return result.meta.last_row_id;
}

export async function updateEvent(
  db: D1Database,
  id: number,
  row: Partial<Omit<EventRow, "id" | "created_at" | "updated_at">>,
): Promise<boolean> {
  const existing = await getEventById(db, id);
  if (!existing) return false;
  const result = await db
    .prepare(
      `UPDATE events
       SET ext_id = ?, title = ?, description = ?, date = ?, end_date = ?,
           location = ?, category = ?, class_name = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(
      row.ext_id ?? existing.ext_id,
      row.title ?? existing.title,
      row.description ?? existing.description,
      row.date ?? existing.date,
      row.end_date ?? existing.end_date,
      row.location ?? existing.location,
      row.category ?? existing.category,
      row.class_name ?? existing.class_name,
      id,
    )
    .run();
  return result.success;
}

export async function deleteEvent(
  db: D1Database,
  id: number,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM events WHERE id = ?`)
    .bind(id)
    .run();
  return result.success;
}

// ─── Announcements CRUD ──────────────────────────────────────────────────────

export async function getAnnouncementsFromD1(
  db: D1Database,
  className?: string,
): Promise<AnnouncementRow[]> {
  let query = `SELECT id, ext_id, title, body, pinned, class_name, created_at, expires_at FROM announcements`;
  const params: string[] = [];

  if (className) {
    query += ` WHERE class_name = ? OR class_name IS NULL`;
    params.push(className);
  }

  query += ` ORDER BY pinned DESC, created_at DESC`;

  const stmt = params.length > 0
    ? db.prepare(query).bind(...params)
    : db.prepare(query);

  const { results } = await stmt.all<AnnouncementRow>();
  return results;
}

export async function getAnnouncementById(
  db: D1Database,
  id: number,
): Promise<AnnouncementRow | null> {
  return db
    .prepare(
      `SELECT id, ext_id, title, body, pinned, class_name, created_at, expires_at
       FROM announcements WHERE id = ?`,
    )
    .bind(id)
    .first<AnnouncementRow>();
}

export async function insertAnnouncement(
  db: D1Database,
  row: Omit<AnnouncementRow, "id" | "created_at">,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO announcements (ext_id, title, body, pinned, class_name, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.ext_id, row.title, row.body, row.pinned, row.class_name, row.expires_at)
    .run();
  return result.meta.last_row_id;
}

export async function updateAnnouncement(
  db: D1Database,
  id: number,
  row: Partial<Omit<AnnouncementRow, "id" | "created_at">>,
): Promise<boolean> {
  const existing = await getAnnouncementById(db, id);
  if (!existing) return false;
  const result = await db
    .prepare(
      `UPDATE announcements
       SET ext_id = ?, title = ?, body = ?, pinned = ?, class_name = ?, expires_at = ?
       WHERE id = ?`,
    )
    .bind(
      row.ext_id ?? existing.ext_id,
      row.title ?? existing.title,
      row.body ?? existing.body,
      row.pinned ?? existing.pinned,
      row.class_name ?? existing.class_name,
      row.expires_at ?? existing.expires_at,
      id,
    )
    .run();
  return result.success;
}

export async function deleteAnnouncement(
  db: D1Database,
  id: number,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM announcements WHERE id = ?`)
    .bind(id)
    .run();
  return result.success;
}

// ─── Pengganti CRUD ──────────────────────────────────────────────────────────

export async function getPenggantiFromD1(
  db: D1Database,
  classCode?: string,
): Promise<PenggantiRow[]> {
  if (classCode) {
    const { results } = await db
      .prepare(
        `SELECT id, ext_id, class_code, date, kind, note, sessions, created_at, updated_at
         FROM pengganti
         WHERE class_code = ?
         ORDER BY date DESC`,
      )
      .bind(classCode)
      .all<PenggantiRow>();
    return results;
  }
  const { results } = await db
    .prepare(
      `SELECT id, ext_id, class_code, date, kind, note, sessions, created_at, updated_at
       FROM pengganti
       ORDER BY date DESC`,
    )
    .all<PenggantiRow>();
  return results;
}

export async function getPenggantiById(
  db: D1Database,
  id: number,
): Promise<PenggantiRow | null> {
  return db
    .prepare(
      `SELECT id, ext_id, class_code, date, kind, note, sessions, created_at, updated_at
       FROM pengganti WHERE id = ?`,
    )
    .bind(id)
    .first<PenggantiRow>();
}

export async function insertPengganti(
  db: D1Database,
  row: Omit<PenggantiRow, "id" | "created_at" | "updated_at">,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO pengganti (ext_id, class_code, date, kind, note, sessions)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.ext_id,
      row.class_code,
      row.date,
      row.kind,
      row.note,
      row.sessions,
    )
    .run();
  return result.meta.last_row_id;
}

export async function updatePengganti(
  db: D1Database,
  id: number,
  row: Partial<Omit<PenggantiRow, "id" | "created_at" | "updated_at">>,
): Promise<boolean> {
  const existing = await getPenggantiById(db, id);
  if (!existing) return false;
  const result = await db
    .prepare(
      `UPDATE pengganti
       SET ext_id = ?, class_code = ?, date = ?, kind = ?, note = ?, sessions = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(
      row.ext_id ?? existing.ext_id,
      row.class_code ?? existing.class_code,
      row.date ?? existing.date,
      row.kind ?? existing.kind,
      row.note ?? existing.note,
      row.sessions ?? existing.sessions,
      id,
    )
    .run();
  return result.success;
}

export async function deletePengganti(
  db: D1Database,
  id: number,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM pengganti WHERE id = ?`)
    .bind(id)
    .run();
  return result.success;
}

// ─── Rooms CRUD ──────────────────────────────────────────────────────────────

export async function getRoomsFromD1(
  db: D1Database,
): Promise<RoomRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, ext_id, name, type FROM rooms ORDER BY name`,
    )
    .all<RoomRow>();
  return results;
}

export async function getRoomById(
  db: D1Database,
  id: number,
): Promise<RoomRow | null> {
  return db
    .prepare(`SELECT id, ext_id, name, type FROM rooms WHERE id = ?`)
    .bind(id)
    .first<RoomRow>();
}

export async function insertRoom(
  db: D1Database,
  row: Omit<RoomRow, "id">,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO rooms (ext_id, name, type) VALUES (?, ?, ?)`,
    )
    .bind(row.ext_id, row.name, row.type)
    .run();
  return result.meta.last_row_id;
}

export async function updateRoom(
  db: D1Database,
  id: number,
  row: Partial<Omit<RoomRow, "id">>,
): Promise<boolean> {
  const existing = await getRoomById(db, id);
  if (!existing) return false;
  const result = await db
    .prepare(
      `UPDATE rooms SET ext_id = ?, name = ?, type = ? WHERE id = ?`,
    )
    .bind(
      row.ext_id ?? existing.ext_id,
      row.name ?? existing.name,
      row.type ?? existing.type,
      id,
    )
    .run();
  return result.success;
}

export async function deleteRoom(
  db: D1Database,
  id: number,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM rooms WHERE id = ?`)
    .bind(id)
    .run();
  return result.success;
}

// ─── Grouping helper ─────────────────────────────────────────────────────────

function groupScheduleRows(rows: D1ScheduleRow[]): {
  semester: string;
  classes: ClassSchedule[];
} {
  if (rows.length === 0) {
    return { semester: "", classes: [] };
  }

  const semester = rows[0].semester;

  const classMap = new Map<string, D1ScheduleRow[]>();
  for (const row of rows) {
    const existing = classMap.get(row.class_name);
    if (existing) {
      existing.push(row);
    } else {
      classMap.set(row.class_name, [row]);
    }
  }

  const classes: ClassSchedule[] = [];
  for (const [className, classRows] of classMap) {
    const dayMap = new Map<string, ScheduleSession[]>();
    for (const row of classRows) {
      const session: ScheduleSession = {
        id: row.id,
        time: row.time,
        course_code: row.course_code,
        course_name: row.course_name,
        type: row.type,
        lecturer_code: row.lecturer_code,
        lecturer: row.lecturer,
        room: row.room,
        mode: row.mode ?? 'offline',
      };
      const existing = dayMap.get(row.day);
      if (existing) {
        existing.push(session);
      } else {
        dayMap.set(row.day, [session]);
      }
    }

    const schedule: DaySchedule[] = [];
    const dayOrder = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT"];
    for (const day of dayOrder) {
      const sessions = dayMap.get(day);
      if (sessions) {
        schedule.push({ day, sessions });
      }
    }

    classes.push({ class_name: className, schedule });
  }

  return { semester, classes };
}

// ─── Data version hash ───────────────────────────────────────────────────────

/**
 * Compute a deterministic data-version hash from a record of JSON objects.
 * Keys are sorted, values JSON-stringified, concatenated, then SHA-256-hex'd.
 */
export async function computeDataVersion(
  jsons: Record<string, unknown>,
): Promise<string> {
  const sorted = Object.keys(jsons).sort();
  const concatenated = sorted.map((k) => JSON.stringify(jsons[k])).join("");
  const encoded = new TextEncoder().encode(concatenated);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
