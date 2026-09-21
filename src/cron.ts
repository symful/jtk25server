/**
 * ── Dedup Key Formats ──────────────────────────────────────────────────────
 * All keys use the pattern {type}:{identifier}:{dateISO}:{slotStart}
 * or {type}:{identifier}:{variant} for events.
 *
 *   upcoming class:     kelas:{classCode}:{dateISO}:{slotStart}
 *   upcoming pengganti: pengganti:{classCode}:{dateISO}:{slotStart}
 *   upcoming event:     acara:{eventId}:{variant}  (variant = '30m')
 *   morning digest:     pagi:{classCode}:{dateISO}  (one per class per day)
 *   morning pengganti:  pagi-pengganti:{classCode}:{dateISO}
 *   morning events:     acara-pagi:{eventId or 'global'}:{dateISO}
 *
 * Mark-before-send: wasSent() → markSent() → sendToTopic()
 * A lost send on failure is an accepted tradeoff (prevents cron-retry double-fires).
 * ───────────────────────────────────────────────────────────────────────────
 */
import {
  getSchedulesFromD1,
  getEventsFromD1,
  getPenggantiFromD1,
} from "./data";
import { sendToTopic } from "./fcm";
import { wasSent, markSent } from "./dedup";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/**
 * Sanitize a class code for use as an FCM topic name.
 * FCM topics allow `[a-zA-Z0-9\-_.~%]+`; replace invalid chars with `-`.
 */
function sanitizeTopic(classCode: string): string {
  return classCode.replace(/[^a-zA-Z0-9\-_.~%]/g, "-");
}

function classTopic(className: string): string {
  return `jtk25_${sanitizeTopic(className)}`;
}

/** Extract the start time from a range like "07.00-14.40" → "07.00", or bare "07.00" → "07.00". */
function startTime(time: string): string {
  return time.split("-")[0];
}

/** Parse "HH.MM" (or the start of "HH.MM-HH.MM") into minutes since midnight. Returns NaN on unparseable input. */
function timeToMinutes(time: string): number {
  const start = startTime(time);
  const [h, m] = start.split(".").map(Number);
  if (Number.isNaN(h)) return NaN;
  return h * 60 + (m || 0);
}

function isWithinMinutes(scheduleTime: string, nowMinutes: number, beforeMin: number): boolean {
  const schedMin = timeToMinutes(scheduleTime);
  if (Number.isNaN(schedMin)) return false;
  return schedMin > nowMinutes && schedMin <= nowMinutes + beforeMin;
}

function formatSessionLines(
  sessions: Array<{ course_name: string; time: string; room: string }>,
  maxLines: number,
): string {
  const lines = sessions.slice(0, maxLines).map(
    (s) => `${s.course_name} — ${startTime(s.time)} di ${s.room}`,
  );
  const remaining = sessions.length - maxLines;
  if (remaining > 0) lines.push(`+${remaining} lagi`);
  return lines.join("\n");
}

const DAY_MAP: Record<string, string> = {
  Senin: "SENIN", Selasa: "SELASA", Rabu: "RABU",
  Kamis: "KAMIS", Jumat: "JUMAT",
};

// ─── Main entry ─────────────────────────────────────────────────────────────

export async function runScheduledNotifications(env: Env): Promise<void> {
  const db = env.jtk25_schedules;
  const { dateStr, timeStr, hourNum, dayName, tomorrowStr } = getWibNow();
  const nowMinutes = timeToMinutes(timeStr);
  const isMorningSummary = hourNum === 6;

  console.log(`[cron] Running at ${timeStr} WIB (${dayName}) — ${isMorningSummary ? "morning summary" : "interval check"}`);

  if (isMorningSummary) {
    await Promise.all([
      notifyMorningSchedules(db, env, dateStr, dayName),
      notifyMorningPengganti(db, env, tomorrowStr),
      notifyMorningEvents(db, env, dateStr, tomorrowStr),
    ]);
  } else {
    await Promise.all([
      notifyUpcomingSchedules(db, env, dateStr, nowMinutes, dayName),
      notifyUpcomingPengganti(db, env, dateStr, nowMinutes),
      notifyUpcomingEvents(db, env, dateStr, nowMinutes),
    ]);
  }
}

// ─── 06:00 WIB — Morning summary ────────────────────────────────────────────

async function notifyMorningSchedules(
  db: D1Database, env: Env, dateStr: string, dayName: string,
): Promise<void> {
  const { classes } = await getSchedulesFromD1(db);
  const todayEnum = DAY_MAP[dayName];
  if (!todayEnum) return;

  for (const cls of classes) {
    const daySchedule = cls.schedule.find((d) => d.day === todayEnum);
    if (!daySchedule || daySchedule.sessions.length === 0) continue;

    const key = `pagi:${cls.class_name}:${dateStr}`;
    if (await wasSent(env, key)) continue;
    await markSent(env, key);

    const title = "Jadwal Hari Ini";
    const body = formatSessionLines(daySchedule.sessions, 3);

    await sendToTopic(env, classTopic(cls.class_name), title, body, {
      type: "schedule_morning", classCode: cls.class_name, day: dayName,
      count: String(daySchedule.sessions.length),
    });
  }
  console.log("[cron] Morning schedule summary sent");
}

async function notifyMorningPengganti(
  db: D1Database, env: Env, tomorrowStr: string,
): Promise<void> {
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
    const key = `pagi-pengganti:${classCode}:${tomorrowStr}`;
    if (await wasSent(env, key)) continue;
    await markSent(env, key);

    const allSessions: Array<{ course_name: string; time: string; room: string }> = [];
    for (const entry of classEntries) {
      if (entry.sessions) {
        try {
          const parsed = JSON.parse(entry.sessions) as Array<{
            course_name: string; time: string; room: string;
          }>;
          allSessions.push(...parsed);
        } catch { continue; }
      }
    }

    const title = "Pengganti Besok";
    const body = allSessions.length > 0
      ? formatSessionLines(allSessions, 3)
      : `${classEntries.length} pengganti untuk besok`;

    await sendToTopic(env, classTopic(classCode), title, body, {
      type: "pengganti_morning", classCode, date: tomorrowStr,
      count: String(classEntries.length),
    });
  }
  console.log("[cron] Morning pengganti summary sent");
}

async function notifyMorningEvents(
  db: D1Database, env: Env, todayStr: string, tomorrowStr: string,
): Promise<void> {
  const rows = await getEventsFromD1(db);
  const upcoming = rows.filter((r) => {
    const d = r.date.substring(0, 10);
    return d === todayStr || d === tomorrowStr;
  });
  if (upcoming.length === 0) return;

  for (const event of upcoming) {
    const eventDate = event.date.substring(0, 10);
    const label = eventDate === todayStr ? "Hari Ini" : "Besok";

    const topic = event.class_name ? classTopic(event.class_name) : "jtk25_global";
    const eventKey = event.class_name ? String(event.id) : "global";
    const key = `acara-pagi:${eventKey}:${eventDate}`;
    if (await wasSent(env, key)) continue;
    await markSent(env, key);

    const location = event.location ? ` — ${event.location}` : "";
    const title = `Acara ${label}`;
    const body = `${event.title}${location}`;

    await sendToTopic(env, topic, title, body, {
      type: "event_morning", eventId: String(event.id), date: eventDate,
    });
  }
  console.log("[cron] Morning event summary sent");
}

// ─── Interval check — within 30 minutes ─────────────────────────────────────

async function notifyUpcomingSchedules(
  db: D1Database, env: Env, dateStr: string, nowMinutes: number, dayName: string,
): Promise<void> {
  const { classes } = await getSchedulesFromD1(db);
  const todayEnum = DAY_MAP[dayName];
  if (!todayEnum) return;

  for (const cls of classes) {
    const daySchedule = cls.schedule.find((d) => d.day === todayEnum);
    if (!daySchedule) continue;

    for (const session of daySchedule.sessions) {
      if (isWithinMinutes(session.time, nowMinutes, 30)) {
        const key = `kelas:${cls.class_name}:${dateStr}:${session.time}`;
        if (await wasSent(env, key)) continue;
        await markSent(env, key);

        const title = "Kelas Sebentar Lagi";
        const body = `${session.course_name} (${session.type}) — ${startTime(session.time)} di ${session.room}`;
        await sendToTopic(env, classTopic(cls.class_name), title, body, {
          type: "class_incoming", classCode: cls.class_name,
          course: session.course_code, time: session.time, room: session.room,
        });
      }
    }
  }
  console.log("[cron] Upcoming schedules check done");
}

async function notifyUpcomingPengganti(
  db: D1Database, env: Env, todayStr: string, nowMinutes: number,
): Promise<void> {
  const rows = await getPenggantiFromD1(db);
  const todayEntries = rows.filter((r) => r.date === todayStr);
  if (todayEntries.length === 0) return;

  for (const entry of todayEntries) {
    if (!entry.sessions) continue;
    let sessions: Array<{ course_name: string; time: string; room: string; type: string }>;
    try {
      sessions = JSON.parse(entry.sessions);
    } catch { continue; }

    for (const session of sessions) {
      if (isWithinMinutes(session.time, nowMinutes, 30)) {
        const key = `pengganti:${entry.class_code}:${todayStr}:${session.time}`;
        if (await wasSent(env, key)) continue;
        await markSent(env, key);

        const title = "Kelas Pengganti";
        const notePart = entry.note ? ` (${entry.note})` : "";
        const body = `${session.course_name} — ${startTime(session.time)} di ${session.room}${notePart}`;
        await sendToTopic(env, classTopic(entry.class_code), title, body, {
          type: "pengganti_incoming", classCode: entry.class_code,
          time: session.time, room: session.room,
        });
      }
    }
  }
  console.log("[cron] Upcoming pengganti check done");
}

async function notifyUpcomingEvents(
  db: D1Database, env: Env, todayStr: string, nowMinutes: number,
): Promise<void> {
  const rows = await getEventsFromD1(db);

  for (const event of rows) {
    const eventDate = event.date.substring(0, 10);
    if (eventDate !== todayStr) continue;

    const eventTime = event.date.substring(11, 16).replace(":", ".");
    if (isWithinMinutes(eventTime, nowMinutes, 30)) {
      const topic = event.class_name ? classTopic(event.class_name) : "jtk25_global";
      const eventKey = event.class_name ? String(event.id) : "global";
      const key = `acara:${eventKey}:30m`;
      if (await wasSent(env, key)) continue;
      await markSent(env, key);

      const location = event.location ? `${event.location}, ` : "";
      const title = "Acara Sebentar Lagi";
      const body = `${event.title} — ${location}${eventTime}`;

      await sendToTopic(env, topic, title, body, {
        type: "event_incoming", eventId: String(event.id), date: eventDate,
      });
    }
  }
  console.log("[cron] Upcoming events check done");
}
