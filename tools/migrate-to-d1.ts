import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const DATA_DIR = join(ROOT, "data");

const DB_ID = "342e1656-9b73-4bc2-9a71-cf57e11889a6";

interface Session {
  time: string;
  course_code: string;
  course_name: string;
  type: string;
  lecturer_code: string;
  lecturer: string;
  room: string;
}

interface DaySchedule {
  day: string;
  sessions: Session[];
}

interface ScheduleFile {
  schema: number;
  semester: string;
  data: {
    class_name: string;
    schedule: DaySchedule[];
  };
}

const dayOrder: Record<string, number> = {
  SENIN: 1,
  SELASA: 2,
  RABU: 3,
  KAMIS: 4,
  JUMAT: 5,
};

function parseTime(time: string): number {
  const match = time.match(/^(\d{2})\.(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1]) * 100 + parseInt(match[2]);
}

const sqlStatements: string[] = [];

const scheduleFiles = readdirSync(DATA_DIR)
  .filter((f) => f.startsWith("schedules_") && f.endsWith(".json"))
  .sort();

for (const file of scheduleFiles) {
  const data: ScheduleFile = JSON.parse(
    readFileSync(join(DATA_DIR, file), "utf-8"),
  );

  const { class_name, schedule } = data.data;
  const semester = data.semester;

  for (const daySchedule of schedule) {
    const sessionsWithOrder = daySchedule.sessions.map((s, i) => ({
      ...s,
      order: i,
      timeStart: parseTime(s.time.split("-")[0]),
    }));

    sessionsWithOrder.sort((a, b) => a.timeStart - b.timeStart);

    for (let i = 0; i < sessionsWithOrder.length; i++) {
      const s = sessionsWithOrder[i];
      const slotOrder = (dayOrder[daySchedule.day] ?? 0) * 100 + i;

      const esc = (v: string) => v.replace(/'/g, "''");

      sqlStatements.push(
        `INSERT INTO schedules (class_name, semester, day, time, course_code, course_name, type, lecturer_code, lecturer, room, slot_order) VALUES ('${esc(class_name)}', '${esc(semester)}', '${esc(daySchedule.day)}', '${esc(s.time)}', '${esc(s.course_code)}', '${esc(s.course_name)}', '${esc(s.type)}', '${esc(s.lecturer_code)}', '${esc(s.lecturer)}', '${esc(s.room)}', ${slotOrder});`,
      );
    }
  }
}

import { writeFileSync } from "node:fs";
const outPath = join(ROOT, "migrations", "0002_seed.sql");
const sql = `-- ${scheduleFiles.length} files, ${sqlStatements.length} rows\n${sqlStatements.join("\n")}\n`;
writeFileSync(outPath, sql, "utf-8");
console.log(`Wrote ${sqlStatements.length} statements to ${outPath}`);
