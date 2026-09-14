import {
  getSchedulesFromD1,
  getEventsFromD1,
  getAnnouncementsFromD1,
  getPenggantiFromD1,
} from "./data";
import { sendToTopic } from "./fcm";

const CLASS_LIST = [
  "D3-1A", "D3-1B", "D3-2A", "D3-2B", "D3-3A", "D3-3B", "D3-3C",
  "D4-1A", "D4-1B", "D4-1C", "D4-1D", "D4-2A", "D4-2B", "D4-2C", "D4-2D",
  "D4-3A", "D4-3B", "D4-4A", "D4-4B",
];

function todayWib(): { dateStr: string; dayName: string; tomorrowStr: string } {
  const now = new Date();
  const utc = now.toISOString().replace("Z", "+00:00");
  const wibMs = now.getTime() + 7 * 60 * 60 * 1000;
  const wib = new Date(wibMs);

  const year = wib.getUTCFullYear();
  const month = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wib.getUTCDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  const tomorrow = new Date(wibMs + 24 * 60 * 60 * 1000);
  const tYear = tomorrow.getUTCFullYear();
  const tMonth = String(tomorrow.getUTCMonth() + 1).padStart(2, "0");
  const tDay = String(tomorrow.getUTCDate()).padStart(2, "0");
  const tomorrowStr = `${tYear}-${tMonth}-${tDay}`;

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = days[wib.getUTCDay()];

  return { dateStr, dayName, tomorrowStr };
}

function classTopic(className: string): string {
  return `jtk25_${className.replace(/_/g, "-")}`;
}

export async function runScheduledNotifications(env: Env): Promise<void> {
  const db = env.jtk25_schedules;
  const { dateStr, dayName, tomorrowStr } = todayWib();

  console.log(`[cron] Running scheduled notifications for ${dateStr} (${dayName})`);

  await Promise.all([
    notifyPengganti(db, env, tomorrowStr),
    notifyEvents(db, env, dateStr, tomorrowStr),
    notifyAnnouncements(db, env, dateStr),
  ]);
}

async function notifyPengganti(
  db: D1Database,
  env: Env,
  tomorrowStr: string,
): Promise<void> {
  const rows = await getPenggantiFromD1(db);
  const tomorrowEntries = rows.filter((r) => r.date === tomorrowStr);

  if (tomorrowEntries.length === 0) {
    console.log("[cron] No pengganti for tomorrow");
    return;
  }

  const byClass = new Map<string, typeof tomorrowEntries>();
  for (const entry of tomorrowEntries) {
    const list = byClass.get(entry.class_code) || [];
    list.push(entry);
    byClass.set(entry.class_code, list);
  }

  for (const [classCode, entries] of byClass) {
    const kinds = entries.map((e) => e.kind);
    const hasReplace = kinds.includes("replace");
    const hasAdd = kinds.includes("add");

    let title = "Pengganti Besok";
    if (hasReplace && hasAdd) {
      title = "Jadwal Besok Berubah + Tambahan";
    } else if (hasReplace) {
      title = "Jadwal Besok Berubah";
    } else if (hasAdd) {
      title = "Tambahan Jadwal Besok";
    }

    const notes = entries
      .filter((e) => e.note)
      .map((e) => e.note)
      .join("; ");
    const body = notes
      ? `${entries.length} pengganti: ${notes}`
      : `${entries.length} pengganti untuk besok`;

    await sendToTopic(env, classTopic(classCode), title, body, {
      type: "pengganti_incoming",
      classCode,
      date: tomorrowStr,
      count: String(entries.length),
    });
  }

  console.log(`[cron] Sent pengganti notifications for ${byClass.size} classes`);
}

async function notifyEvents(
  db: D1Database,
  env: Env,
  todayStr: string,
  tomorrowStr: string,
): Promise<void> {
  const rows = await getEventsFromD1(db);

  const upcoming = rows.filter((r) => {
    const eventDate = r.date.substring(0, 10);
    return eventDate === todayStr || eventDate === tomorrowStr;
  });

  if (upcoming.length === 0) {
    console.log("[cron] No upcoming events");
    return;
  }

  for (const event of upcoming) {
    const eventDate = event.date.substring(0, 10);
    const isToday = eventDate === todayStr;
    const timeLabel = isToday ? "Hari Ini" : "Besok";

    const location = event.location ? ` di ${event.location}` : "";
    const title = `Acara ${timeLabel}`;
    const body = `${event.title}${location}`;

    if (event.class_name) {
      await sendToTopic(env, classTopic(event.class_name), title, body, {
        type: "event_incoming",
        eventId: String(event.id),
        date: eventDate,
      });
    } else {
      await sendToTopic(env, "jtk25_global", title, body, {
        type: "event_incoming",
        eventId: String(event.id),
        date: eventDate,
      });
    }
  }

  console.log(`[cron] Sent event notifications for ${upcoming.length} events`);
}

async function notifyAnnouncements(
  db: D1Database,
  env: Env,
  todayStr: string,
): Promise<void> {
  const rows = await getAnnouncementsFromD1(db);

  const todayAnnouncements = rows.filter((r) => {
    const created = r.created_at.substring(0, 10);
    return created === todayStr;
  });

  if (todayAnnouncements.length === 0) {
    console.log("[cron] No new announcements today");
    return;
  }

  for (const ann of todayAnnouncements) {
    const title = "Pengumuman Baru";
    const body = ann.title;

    if (ann.class_name) {
      await sendToTopic(env, classTopic(ann.class_name), title, body, {
        type: "announcement_new",
        announcementId: String(ann.id),
      });
    } else {
      await sendToTopic(env, "jtk25_global", title, body, {
        type: "announcement_new",
        announcementId: String(ann.id),
      });
    }
  }

  console.log(`[cron] Sent announcement notifications for ${todayAnnouncements.length} announcements`);
}
