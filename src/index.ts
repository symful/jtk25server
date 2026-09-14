import { Hono } from "hono";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import type { Context } from "hono";
import {
  LIST_FILES,
  computeDataVersion,
  getSchedulesFromD1,
  getEventsFromD1,
  getAnnouncementsFromD1,
  getPenggantiFromD1,
  getRoomsFromD1,
} from "./data";
import adminRoutes from "./admin";
import adminContentRoutes from "./admin_content";

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

app.use("*", cors());
app.use("*", etag());
app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "public, max-age=60");
});

app.route("/api/v1/admin", adminRoutes);
app.route("/api/v1/admin", adminContentRoutes);

app.get("/api/v1/meta", async (c) => {
  const db = c.env.jtk25_schedules;

  const { semester, classes } = await getSchedulesFromD1(db);

  const scheduleMap: Record<string, unknown> = {};
  for (const cls of classes) {
    scheduleMap[`schedules_${cls.class_name.replace("-", "_")}.json`] = {
      schema: 2,
      semester,
      data: cls,
    };
  }

  const [events, announcements, pengganti, rooms] = await Promise.all([
    getEventsFromD1(db),
    getAnnouncementsFromD1(db),
    getPenggantiFromD1(db),
    getRoomsFromD1(db),
  ]);

  const contentMap: Record<string, unknown> = {
    "announcements.json": { schema: 2, semester: semester || "2026/2027-GANJIL", updatedAt: "", data: announcements },
    "calendar.json": { schema: 2, semester: semester || "2026/2027-GANJIL", updatedAt: "", data: events },
    "pengganti.json": { schema: 2, semester: semester || "2026/2027-GANJIL", updatedAt: "", data: pengganti },
    "rooms.json": { schema: 2, semester: semester || "2026/2027-GANJIL", updatedAt: "", data: rooms },
  };

  const jsons: Record<string, unknown> = { ...scheduleMap, ...contentMap };

  const dataVersion = await computeDataVersion(jsons);
  const etagVal = `"${dataVersion}"`;

  const ifNoneMatch = c.req.header("If-None-Match");
  if (ifNoneMatch && ifNoneMatch === etagVal) {
    return new Response(null, { status: 304, headers: { ETag: etagVal } });
  }

  const headers: Record<string, string> = { ETag: etagVal };
  return c.json({ schema: 2, dataVersion }, 200, headers);
});

app.get("/api/v1/schedules", async (c) => {
  const { semester, classes } = await getSchedulesFromD1(c.env.jtk25_schedules);
  return c.json({ semester, classes });
});

app.get("/api/v1/pengganti", async (c) => {
  const rows = await getPenggantiFromD1(c.env.jtk25_schedules);
  const data = rows.map((r) => ({
    ...r,
    sessions: r.sessions ? JSON.parse(r.sessions) : [],
  }));
  return c.json(data);
});

app.get("/api/v1/announcements", async (c) => {
  const rows = await getAnnouncementsFromD1(c.env.jtk25_schedules);
  return c.json(rows);
});

app.get("/api/v1/calendar", async (c) => {
  const rows = await getEventsFromD1(c.env.jtk25_schedules);
  return c.json(rows);
});

app.get("/api/v1/rooms", async (c) => {
  const rows = await getRoomsFromD1(c.env.jtk25_schedules);
  return c.json(rows);
});

app.get("/api/version", (c) => c.text("2.0"));

app.get("/api/schedules", async (c) => {
  const { semester, classes } = await getSchedulesFromD1(c.env.jtk25_schedules);

  const [academic_year, semesterPart] = semester.split("-");

  return c.json({
    academic_year,
    semester: semesterPart,
    curriculum: "2025",
    classes,
  });
});

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default { fetch: app.fetch };
