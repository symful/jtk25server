import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Env } from "../worker-configuration";

type SendCall = {
  topic: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

const sendCalls: SendCall[] = [];

vi.mock("./fcm", () => ({
  sendToTopic: vi.fn(
    async (
      _env: Env,
      topic: string,
      title: string,
      body: string,
      data: Record<string, string>,
    ) => {
      sendCalls.push({ topic, title, body, data });
    },
  ),
}));

import { runScheduledNotifications } from "./cron";



type D1Row = Record<string, unknown>;

function createMockEnv(scheduleRows: D1Row[], eventRows: D1Row[], penggantiRows: D1Row[]) {
  const sentLog = new Map<string, number>();

  function prepare(sql: string) {
    return {
      bind: (...params: unknown[]) => ({
        first: async <T = D1Row>(): Promise<T | null> => {
          if (
            sql.includes("SELECT") &&
            sql.includes("notification_sent_log") &&
            sql.includes("WHERE key")
          ) {
            const key = params[0] as string;
            return (sentLog.has(key) ? { key } : null) as T | null;
          }
          return null;
        },
        all: async <T = D1Row>(): Promise<{ results: T[] }> => {
          if (sql.includes("FROM schedules"))
            return { results: scheduleRows as T[] };
          if (sql.includes("FROM events"))
            return { results: eventRows as T[] };
          if (sql.includes("FROM pengganti"))
            return { results: penggantiRows as T[] };
          return { results: [] };
        },
        run: async () => {
          if (sql.includes("INSERT OR IGNORE")) {
            const key = params[0] as string;
            const sent_at = params[1] as number;
            if (!sentLog.has(key)) sentLog.set(key, sent_at);
            return {
              success: true,
              meta: { last_row_id: 0, changes: sentLog.has(key) ? 0 : 1 },
            };
          }
          if (sql.includes("DELETE FROM notification_sent_log")) {
            const threshold = params[0] as number;
            let changes = 0;
            for (const [k, v] of sentLog) {
              if (v < threshold) {
                sentLog.delete(k);
                changes++;
              }
            }
            return {
              success: true,
              meta: { last_row_id: 0, changes },
            };
          }
          return { success: true, meta: { last_row_id: 0, changes: 0 } };
        },
      }),
      all: async <T = D1Row>(): Promise<{ results: T[] }> => {
        if (sql.includes("FROM schedules"))
          return { results: scheduleRows as T[] };
        if (sql.includes("FROM events"))
          return { results: eventRows as T[] };
        if (sql.includes("FROM pengganti"))
          return { results: penggantiRows as T[] };
        return { results: [] };
      },
    };
  }

  const env = {
    jtk25_schedules: { prepare },
  } as unknown as Env;

  return { env, sentLog };
}



describe("cron dedup + copy", () => {
  beforeEach(() => {
    sendCalls.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Scenario A: upcoming class dedup — one send per two runs", async () => {
    vi.setSystemTime(new Date("2026-09-21T00:25:00Z")); // 07:25 WIB Monday

    const { env } = createMockEnv(
      [
        {
          id: 1, class_name: "D3-3A", semester: "2025/2026",
          day: "SENIN", time: "07.50",
          course_code: "TI-251", course_name: "Pemrograman Web",
          type: "TE", lecturer_code: "MK01", lecturer: "Budi",
          room: "D108", slot_order: 1, mode: "offline",
        },
      ],
      [],
      [],
    );

    await runScheduledNotifications(env);
    expect(sendCalls.length).toBe(1);

    await runScheduledNotifications(env);
    expect(sendCalls.length).toBe(1);
  });

  it("Scenario B: copy contains matkul + type + time + room", async () => {
    vi.setSystemTime(new Date("2026-09-21T00:25:00Z")); // 07:25 WIB Monday

    const { env } = createMockEnv(
      [
        {
          id: 1, class_name: "D3-3A", semester: "2025/2026",
          day: "SENIN", time: "07.50",
          course_code: "TI-251", course_name: "Pemrograman Web",
          type: "TE", lecturer_code: "MK01", lecturer: "Budi",
          room: "D108", slot_order: 1, mode: "offline",
        },
      ],
      [],
      [],
    );

    await runScheduledNotifications(env);
    expect(sendCalls.length).toBe(1);
    expect(sendCalls[0].title).toBe("Kelas Sebentar Lagi");
    expect(sendCalls[0].body).toBe("Pemrograman Web (TE) — 07.50 di D108");
    expect(sendCalls[0].topic).toBe("jtk25_D3-3A");
  });

  it("Scenario C: upcoming event dedup across two runs", async () => {
    vi.setSystemTime(new Date("2026-09-21T00:25:00Z")); // 07:25 WIB Monday

    const { env } = createMockEnv(
      [],
      [
        {
          id: 1, ext_id: "evt1", title: "Wisuda",
          description: null, date: "2026-09-21T07:50:00",
          end_date: "2026-09-21T10:00:00",
          location: "Auditorium", category: "Akademik",
          class_name: null, created_at: "", updated_at: "",
        },
      ],
      [],
    );

    await runScheduledNotifications(env);
    expect(sendCalls.length).toBe(1);
    expect(sendCalls[0].title).toBe("Acara Sebentar Lagi");
    expect(sendCalls[0].topic).toBe("jtk25_global");

    await runScheduledNotifications(env);
    expect(sendCalls.length).toBe(1);
  });

  it("Scenario D: morning digest dedup across two runs same day", async () => {
    vi.setSystemTime(new Date("2026-09-20T23:00:00Z")); // 06:00 WIB Monday

    const { env } = createMockEnv(
      [
        {
          id: 1, class_name: "D3-3A", semester: "2025/2026",
          day: "SENIN", time: "07.00",
          course_code: "TI-251", course_name: "Pemrograman Web",
          type: "TE", lecturer_code: "MK01", lecturer: "Budi",
          room: "D108", slot_order: 1, mode: "offline",
        },
      ],
      [],
      [],
    );

    await runScheduledNotifications(env);
    expect(sendCalls.length).toBe(1);
    expect(sendCalls[0].title).toBe("Jadwal Hari Ini");
    expect(sendCalls[0].body).toBe("Pemrograman Web — 07.00 di D108");

    await runScheduledNotifications(env);
    expect(sendCalls.length).toBe(1);
  });

  it("morning digest shows first 3 sessions + N lagi", async () => {
    vi.setSystemTime(new Date("2026-09-20T23:00:00Z")); // 06:00 WIB Monday

    const { env } = createMockEnv(
      [
        {
          id: 1, class_name: "D3-3A", semester: "2025/2026",
          day: "SENIN", time: "07.00",
          course_code: "TI-251", course_name: "Pemrograman Web",
          type: "TE", lecturer_code: "MK01", lecturer: "Budi",
          room: "D108", slot_order: 1, mode: "offline",
        },
        {
          id: 2, class_name: "D3-3A", semester: "2025/2026",
          day: "SENIN", time: "08.00",
          course_code: "TI-252", course_name: "Basis Data",
          type: "PR", lecturer_code: "MK02", lecturer: "Sari",
          room: "Lab3", slot_order: 2, mode: "offline",
        },
        {
          id: 3, class_name: "D3-3A", semester: "2025/2026",
          day: "SENIN", time: "09.00",
          course_code: "TI-253", course_name: "Jaringan Komputer",
          type: "TE", lecturer_code: "MK03", lecturer: "Andi",
          room: "D201", slot_order: 3, mode: "offline",
        },
        {
          id: 4, class_name: "D3-3A", semester: "2025/2026",
          day: "SENIN", time: "10.00",
          course_code: "TI-254", course_name: "Kecerdasan Buatan",
          type: "TE", lecturer_code: "MK04", lecturer: "Rina",
          room: "D301", slot_order: 4, mode: "offline",
        },
      ],
      [],
      [],
    );

    await runScheduledNotifications(env);
    expect(sendCalls.length).toBe(1);
    expect(sendCalls[0].body).toBe(
      "Pemrograman Web — 07.00 di D108\n" +
      "Basis Data — 08.00 di Lab3\n" +
      "Jaringan Komputer — 09.00 di D201\n" +
      "+1 lagi",
    );
  });

  it("upcoming pengganti uses note in body", async () => {
    vi.setSystemTime(new Date("2026-09-21T00:25:00Z")); // 07:25 WIB Monday

    const penggantiSessions = JSON.stringify([
      { course_name: "Pemrograman Web", time: "07.50", room: "D108", type: "TE" },
    ]);

    const { env } = createMockEnv(
      [],
      [],
      [
        {
          id: 1, ext_id: "pg1", class_code: "D3-3A",
          date: "2026-09-21", kind: "replace",
          note: "Ruangan pindah ke D201", sessions: penggantiSessions,
          created_at: "", updated_at: "",
        },
      ],
    );

    await runScheduledNotifications(env);
    const penggantiCall = sendCalls.find((c) => c.data.type === "pengganti_incoming");
    expect(penggantiCall).toBeDefined();
    expect(penggantiCall!.title).toBe("Kelas Pengganti");
    expect(penggantiCall!.body).toBe(
      "Pemrograman Web — 07.50 di D108 (Ruangan pindah ke D201)",
    );
  });

  it("class-scoped event goes to class topic, global to jtk25_global", async () => {
    vi.setSystemTime(new Date("2026-09-21T00:25:00Z")); // 07:25 WIB Monday

    const { env } = createMockEnv(
      [],
      [
        {
          id: 1, ext_id: "evt1", title: "Kuliah Umum",
          description: null, date: "2026-09-21T07:50:00",
          end_date: "2026-09-21T10:00:00",
          location: "Aula", category: "Akademik",
          class_name: "D3-3A", created_at: "", updated_at: "",
        },
        {
          id: 2, ext_id: "evt2", title: "Dies Natalis",
          description: null, date: "2026-09-21T07:55:00",
          end_date: "2026-09-21T12:00:00",
          location: "GOR", category: "Umum",
          class_name: null, created_at: "", updated_at: "",
        },
      ],
      [],
    );

    await runScheduledNotifications(env);
    expect(sendCalls.length).toBe(2);
    const classEvent = sendCalls.find((c) => c.data.eventId === "1");
    const globalEvent = sendCalls.find((c) => c.data.eventId === "2");
    expect(classEvent!.topic).toBe("jtk25_D3-3A");
    expect(globalEvent!.topic).toBe("jtk25_global");
  });
});
