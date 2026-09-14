import dosenJson from "../data/dosen.json";
import calendarJson from "../data/calendar.json";
import announcementsJson from "../data/announcements.json";
import penggantiJson from "../data/pengganti.json";
import roomsJson from "../data/rooms.json";

interface CalendarItem {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate: string;
  location?: string;
  category?: string;
}

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  expiresAt?: string;
}

interface PenggantiItem {
  id: string;
  class_code: string;
  date: string;
  kind: "replace" | "add" | "info";
  note?: string;
  sessions?: Array<Record<string, unknown>>;
}

interface DosenItem {
  code: string;
  name: string;
  email?: string;
}

interface RoomItem {
  id: string;
  name: string;
  type: "kelas" | "lab";
}

function escapeSql(val: string | null | undefined): string {
  if (val === null || val === undefined) return "NULL";
  return "'" + val.replace(/'/g, "''") + "'";
}

function seedEvents(): string[] {
  const items = calendarJson.data as CalendarItem[];
  const stmts: string[] = [];
  for (const item of items) {
    stmts.push(
      `INSERT OR IGNORE INTO events (ext_id, title, description, date, end_date, location, category, class_name) VALUES (${escapeSql(item.id)}, ${escapeSql(item.title)}, ${escapeSql(item.description)}, ${escapeSql(item.date)}, ${escapeSql(item.endDate)}, ${escapeSql(item.location)}, ${escapeSql(item.category)}, NULL);`
    );
  }
  return stmts;
}

function seedAnnouncements(): string[] {
  const items = announcementsJson.data as AnnouncementItem[];
  const stmts: string[] = [];
  for (const item of items) {
    stmts.push(
      `INSERT OR IGNORE INTO announcements (ext_id, title, body, pinned, expires_at) VALUES (${escapeSql(item.id)}, ${escapeSql(item.title)}, ${escapeSql(item.body)}, ${item.pinned ? 1 : 0}, ${escapeSql(item.expiresAt)});`
    );
  }
  return stmts;
}

function seedPengganti(): string[] {
  const items = penggantiJson.data as PenggantiItem[];
  const stmts: string[] = [];
  for (const item of items) {
    const sessionsJson = item.sessions ? JSON.stringify(item.sessions) : null;
    stmts.push(
      `INSERT OR IGNORE INTO pengganti (ext_id, class_code, date, kind, note, sessions) VALUES (${escapeSql(item.id)}, ${escapeSql(item.class_code)}, ${escapeSql(item.date)}, ${escapeSql(item.kind)}, ${escapeSql(item.note)}, ${escapeSql(sessionsJson)});`
    );
  }
  return stmts;
}

function seedDosen(): string[] {
  const items = dosenJson.data as DosenItem[];
  const stmts: string[] = [];
  for (const item of items) {
    stmts.push(
      `INSERT OR IGNORE INTO dosen (code, name, email) VALUES (${escapeSql(item.code)}, ${escapeSql(item.name)}, ${escapeSql(item.email)});`
    );
  }
  return stmts;
}

function seedRooms(): string[] {
  const items = roomsJson.data as RoomItem[];
  const stmts: string[] = [];
  for (const item of items) {
    stmts.push(
      `INSERT OR IGNORE INTO rooms (ext_id, name, type) VALUES (${escapeSql(item.id)}, ${escapeSql(item.name)}, ${escapeSql(item.type)});`
    );
  }
  return stmts;
}

const lines = [
  "-- Seed content tables from JSON data",
  "-- Idempotent: uses INSERT OR IGNORE",
  "",
  ...seedEvents(),
  "",
  ...seedAnnouncements(),
  "",
  ...seedPengganti(),
  "",
  ...seedDosen(),
  "",
  ...seedRooms(),
  "",
];

process.stdout.write(lines.join("\n") + "\n");
