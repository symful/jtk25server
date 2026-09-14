import {
  getSchedulesFromD1,
  getEventsFromD1,
  getPenggantiFromD1,
} from "./data";
import { sendToTopic } from "./fcm";

function getWibNow() {
  const now = new Date();
  const wibMs = now.getTime() + 7 * 60 * 60 * 1000;
  const wib = new Date(wibMs);

  const year = wib.getUTCFullYear();
  const month = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wib.getUTCDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  const hours = String(wib.getUTCHours()).padStart(2, "0");
  const minutes = String(wib.getUTCMinutes()).padStart(2, "0");
  const timeStr = `${hours}.${minutes}`;
  const hourNum = wib.getUTCHours();

  const tomorrow = new Date(wibMs + 24 * 60 * 60 * 1000);
  const tYear = tomorrow.getUTCFullYear();
  const tMonth = String(tomorrow.getUTCMonth() + 1).padStart(2, "0");
  const tDay = String(tomorrow.getUTCDate()).padStart(2, "0");
  const tomorrowStr = `${tYear}-${tMonth}-${tDay}`;

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = days[wib.getUTCDay()];

  return { now: wib, dateStr, timeStr, hourNum, dayName, tomorrowStr };
}

function classTopic(className: string): string {
  return `jtk25_${className.replace(/_/g, "-")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(".").map(Number);
  return h * 60 + m;
}

function isWithinMinutes(scheduleTime: string, nowMinutes: number, beforeMin: number): boolean {
  const schedMin = timeToMinutes(scheduleTime);
  return schedMin > nowMinutes && schedMin <= nowMinutes + beforeMin;
}

const DAY_MAP: Record<string, string> = {
  Senin: "SENIN", Selasa: "SELASA", Rabu: "RABU",
  Kamis: "KAMIS", Jumat: "JUMAT",
};

export async function runScheduledNotifications(env: Env): Promise<void> {
  const db = env.jtk25_schedules;
  const { dateStr, timeStr, hourNum, dayName, tomorrowStr } = getWibNow();
  const nowMinutes = timeToMinutes(timeStr);
  const isMorningSummary = hourNum === 6;

  console.log(`[cron] Running at ${timeStr} WIB (${dayName}) — ${isMorningSummary ? "morning summary" : "interval check"}`);

  if (isMorningSummary) {
    await Promise.all([
      notifyMorningSchedules(db, env, dayName),
      notifyMorningPengganti(db, env, tomorrowStr),
      notifyMorningEvents(db, env, dateStr, tomorrowStr),
    ]);
  } else {
    await Promise.all([
      notifyUpcomingSchedules(db, env, nowMinutes, dayName),
      notifyUpcomingPengganti(db, env, dateStr, nowMinutes),
      notifyUpcomingEvents(db, env, dateStr, nowMinutes),
    ]);
  }
}

// ─── 06:00 WIB — Morning summary ────────────────────────────────────────────

async function notifyMorningSchedules(db: D1Database, env: Env, dayName: string): Promise<void> {
  const { classes } = await getSchedulesFromD1(db);
  const todayEnum = DAY_MAP[dayName];
  if (!todayEnum) return;

  for (const cls of classes) {
    const daySchedule = cls.schedule.find((d) => d.day === todayEnum);
    if (!daySchedule || daySchedule.sessions.length === 0) continue;

    const sessionList = daySchedule.sessions.map((s) => `${s.time} ${s.course_code}`).join(", ");
    const title = "Jadwal Hari Ini";
    const body = `${daySchedule.sessions.length} sesi: ${sessionList}`;

    await sendToTopic(env, classTopic(cls.class_name), title, body, {
      type: "schedule_morning", classCode: cls.class_name, day: dayName,
      count: String(daySchedule.sessions.length),
    });
  }
  console.log("[cron] Morning schedule summary sent");
}

async function notifyMorningPengganti(db: D1Database, env: Env, tomorrowStr: string): Promise<void> {
  const rows = await getPenggantiFromD1(db);
  const entries = rows.filter((r) => r.date === tomorrowStr);
  if (entries.length === 0) return;

  const byClass = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = byClass.get(entry.class_code) || [];
    list.push(entry);
    byClass.set(entry.class_code, list);
  }

  for (const [classCode, classEntries] of byClass) {
    const kinds = classEntries.map((e) => e.kind);
    const hasReplace = kinds.includes("replace");
    const hasAdd = kinds.includes("add");

    let title = "Pengganti Besok";
    if (hasReplace && hasAdd) title = "Jadwal Besok Berubah + Tambahan";
    else if (hasReplace) title = "Jadwal Besok Berubah";
    else if (hasAdd) title = "Tambahan Jadwal Besok";

    const notes = classEntries.filter((e) => e.note).map((e) => e.note).join("; ");
    const body = notes || `${classEntries.length} pengganti untuk besok`;

    await sendToTopic(env, classTopic(classCode), title, body, {
      type: "pengganti_morning", classCode, date: tomorrowStr,
      count: String(classEntries.length),
    });
  }
  console.log("[cron] Morning pengganti summary sent");
}

async function notifyMorningEvents(db: D1Database, env: Env, todayStr: string, tomorrowStr: string): Promise<void> {
  const rows = await getEventsFromD1(db);
  const upcoming = rows.filter((r) => {
    const d = r.date.substring(0, 10);
    return d === todayStr || d === tomorrowStr;
  });
  if (upcoming.length === 0) return;

  for (const event of upcoming) {
    const eventDate = event.date.substring(0, 10);
    const label = eventDate === todayStr ? "Hari Ini" : "Besok";
    const location = event.location ? ` di ${event.location}` : "";
    const title = `Acara ${label}`;
    const body = `${event.title}${location}`;

    if (event.class_name) {
      await sendToTopic(env, classTopic(event.class_name), title, body, {
        type: "event_morning", eventId: String(event.id), date: eventDate,
      });
    } else {
      await sendToTopic(env, "jtk25_global", title, body, {
        type: "event_morning", eventId: String(event.id), date: eventDate,
      });
    }
  }
  console.log("[cron] Morning event summary sent");
}

// ─── Interval check — within 30 minutes ─────────────────────────────────────

async function notifyUpcomingSchedules(db: D1Database, env: Env, nowMinutes: number, dayName: string): Promise<void> {
  const { classes } = await getSchedulesFromD1(db);
  const todayEnum = DAY_MAP[dayName];
  if (!todayEnum) return;

  for (const cls of classes) {
    const daySchedule = cls.schedule.find((d) => d.day === todayEnum);
    if (!daySchedule) continue;

    for (const session of daySchedule.sessions) {
      if (isWithinMinutes(session.time, nowMinutes, 30)) {
        const title = "Kelas Sebentar Lagi";
        const body = `${session.course_name} (${session.course_code}) ${session.time} — ${session.room}`;
        await sendToTopic(env, classTopic(cls.class_name), title, body, {
          type: "class_incoming", classCode: cls.class_name,
          course: session.course_code, time: session.time, room: session.room,
        });
      }
    }
  }
  console.log("[cron] Upcoming schedules check done");
}

async function notifyUpcomingPengganti(db: D1Database, env: Env, todayStr: string, nowMinutes: number): Promise<void> {
  const rows = await getPenggantiFromD1(db);
  const todayEntries = rows.filter((r) => r.date === todayStr);
  if (todayEntries.length === 0) return;

  for (const entry of todayEntries) {
    if (!entry.sessions) continue;
    const sessions = JSON.parse(entry.sessions);
    for (const session of sessions) {
      if (isWithinMinutes(session.time, nowMinutes, 30)) {
        const title = "Pengganti Sekarang";
        const body = `${session.course_name} (${session.course_code}) ${session.time} — ${session.room}`;
        await sendToTopic(env, classTopic(entry.class_code), title, body, {
          type: "pengganti_incoming", classCode: entry.class_code,
          time: session.time, room: session.room,
        });
      }
    }
  }
  console.log("[cron] Upcoming pengganti check done");
}

async function notifyUpcomingEvents(db: D1Database, env: Env, todayStr: string, nowMinutes: number): Promise<void> {
  const rows = await getEventsFromD1(db);

  for (const event of rows) {
    const eventDate = event.date.substring(0, 10);
    if (eventDate !== todayStr) continue;

    const eventTime = event.date.substring(11, 16).replace(":", ".");
    if (isWithinMinutes(eventTime, nowMinutes, 30)) {
      const location = event.location ? ` di ${event.location}` : "";
      const title = "Acara Sebentar Lagi";
      const body = `${event.title}${location}`;

      if (event.class_name) {
        await sendToTopic(env, classTopic(event.class_name), title, body, {
          type: "event_incoming", eventId: String(event.id), date: eventDate,
        });
      } else {
        await sendToTopic(env, "jtk25_global", title, body, {
          type: "event_incoming", eventId: String(event.id), date: eventDate,
        });
      }
    }
  }
  console.log("[cron] Upcoming events check done");
}
