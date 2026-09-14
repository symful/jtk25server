import { Hono } from "hono";
import {
  getEventsFromD1,
  getEventById,
  insertEvent,
  updateEvent,
  deleteEvent,
  getAnnouncementsFromD1,
  getAnnouncementById,
  insertAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getPenggantiFromD1,
  getPenggantiById,
  insertPengganti,
  updatePengganti,
  deletePengganti,
  getRoomsFromD1,
  getRoomById,
  insertRoom,
  updateRoom,
  deleteRoom,
} from "./data";
import {
  sendCalendarUpdateNotification,
  sendPenggantiUpdateNotification,
} from "./fcm";

type AppEnv = { Bindings: Env };

const adminContent = new Hono<AppEnv>();

const CLASS_LIST = [
  "D3_1A", "D3_1B", "D3_2A", "D3_2B", "D3_3A", "D3_3B", "D3_3C",
  "D4_1A", "D4_1B", "D4_1C", "D4_1D", "D4_2A", "D4_2B", "D4_2C", "D4_2D",
  "D4_3A", "D4_3B", "D4_4A", "D4_4B",
] as const;

function getClassPass(env: Env, className: string): string | undefined {
  const key = `ADMIN_PASS_${className}` as keyof Env;
  return env[key] as string | undefined;
}

interface AuthResult {
  authenticated: boolean;
  scope: "global" | `class:${string}`;
}

async function authenticate(c: { req: { header(name: string): string | undefined }; env: Env }): Promise<AuthResult> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { authenticated: false, scope: "global" };
  }
  const token = authHeader.slice(7);
  if (!token) return { authenticated: false, scope: "global" };

  if (token === c.env.ADMIN_PASS_GLOBAL) {
    return { authenticated: true, scope: "global" };
  }

  for (const cls of CLASS_LIST) {
    const pass = getClassPass(c.env, cls);
    if (pass && token === pass) {
      return { authenticated: true, scope: `class:${cls.replace("_", "-")}` };
    }
  }

  return { authenticated: false, scope: "global" };
}

function jsonError(c: any, status: number, message: string) {
  return c.json({ error: message }, status);
}

// ─── Events ──────────────────────────────────────────────────────────────────

adminContent.get("/events", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const className = auth.scope === "global"
    ? undefined
    : auth.scope.replace("class:", "");
  const rows = await getEventsFromD1(c.env.jtk25_schedules, className);
  return c.json(rows);
});

adminContent.get("/events/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid event ID");

  const row = await getEventById(c.env.jtk25_schedules, id);
  if (!row) return jsonError(c, 404, "Event not found");

  if (auth.scope !== "global" && row.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (row.class_name !== allowed) return jsonError(c, 403, "Access denied");
  }

  return c.json(row);
});

adminContent.post("/events", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const body = await c.req.json<{
    ext_id?: string; title: string; description?: string;
    date: string; end_date: string; location?: string;
    category?: string; class_name?: string;
  }>();

  if (!body.title || !body.date || !body.end_date) {
    return jsonError(c, 400, "Missing required fields: title, date, end_date");
  }

  if (auth.scope !== "global" && body.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (body.class_name !== allowed) return jsonError(c, 403, "Access denied to this class");
  }

  const extId = body.ext_id ?? `evt-${Date.now()}`;
  const newId = await insertEvent(c.env.jtk25_schedules, {
    ext_id: extId,
    title: body.title,
    description: body.description ?? null,
    date: body.date,
    end_date: body.end_date,
    location: body.location ?? null,
    category: body.category ?? null,
    class_name: body.class_name ?? null,
  });

  if (body.class_name) {
    sendCalendarUpdateNotification(c.env, body.class_name);
  }

  return c.json({ ok: true, id: newId }, 201);
});

adminContent.put("/events/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid event ID");

  const existing = await getEventById(c.env.jtk25_schedules, id);
  if (!existing) return jsonError(c, 404, "Event not found");

  if (auth.scope !== "global" && existing.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (existing.class_name !== allowed) return jsonError(c, 403, "Access denied");
  }

  const body = await c.req.json<{
    ext_id?: string; title?: string; description?: string;
    date?: string; end_date?: string; location?: string;
    category?: string; class_name?: string;
  }>();

  if (auth.scope !== "global" && body.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (body.class_name !== allowed) return jsonError(c, 403, "Cannot change to a different class");
  }

  const success = await updateEvent(c.env.jtk25_schedules, id, {
    ext_id: body.ext_id,
    title: body.title,
    description: body.description,
    date: body.date,
    end_date: body.end_date,
    location: body.location,
    category: body.category,
    class_name: body.class_name,
  });

  if (!success) return jsonError(c, 500, "Failed to update event");

  if (body.class_name || existing.class_name) {
    sendCalendarUpdateNotification(c.env, body.class_name ?? existing.class_name!);
  }

  return c.json({ ok: true });
});

adminContent.delete("/events/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid event ID");

  const existing = await getEventById(c.env.jtk25_schedules, id);
  if (!existing) return jsonError(c, 404, "Event not found");

  if (auth.scope !== "global" && existing.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (existing.class_name !== allowed) return jsonError(c, 403, "Access denied");
  }

  const success = await deleteEvent(c.env.jtk25_schedules, id);
  if (!success) return jsonError(c, 500, "Failed to delete event");

  if (existing.class_name) {
    sendCalendarUpdateNotification(c.env, existing.class_name);
  }

  return c.json({ ok: true });
});

// ─── Announcements ───────────────────────────────────────────────────────────

adminContent.get("/announcements", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const className = auth.scope === "global"
    ? undefined
    : auth.scope.replace("class:", "");
  const rows = await getAnnouncementsFromD1(c.env.jtk25_schedules, className);
  return c.json(rows);
});

adminContent.get("/announcements/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid announcement ID");

  const row = await getAnnouncementById(c.env.jtk25_schedules, id);
  if (!row) return jsonError(c, 404, "Announcement not found");

  if (auth.scope !== "global" && row.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (row.class_name !== allowed) return jsonError(c, 403, "Access denied");
  }

  return c.json(row);
});

adminContent.post("/announcements", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const body = await c.req.json<{
    ext_id?: string; title: string; body: string;
    pinned?: number; class_name?: string; expires_at?: string;
  }>();

  if (!body.title || !body.body) {
    return jsonError(c, 400, "Missing required fields: title, body");
  }

  if (auth.scope !== "global" && body.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (body.class_name !== allowed) return jsonError(c, 403, "Access denied to this class");
  }

  const extId = body.ext_id ?? `ann-${Date.now()}`;
  const newId = await insertAnnouncement(c.env.jtk25_schedules, {
    ext_id: extId,
    title: body.title,
    body: body.body,
    pinned: body.pinned ?? 0,
    class_name: auth.scope === "global" ? (body.class_name ?? null) : auth.scope.replace("class:", ""),
    expires_at: body.expires_at ?? null,
  });

  return c.json({ ok: true, id: newId }, 201);
});

adminContent.put("/announcements/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid announcement ID");

  const existing = await getAnnouncementById(c.env.jtk25_schedules, id);
  if (!existing) return jsonError(c, 404, "Announcement not found");

  if (auth.scope !== "global" && existing.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (existing.class_name !== allowed) return jsonError(c, 403, "Access denied");
  }

  const body = await c.req.json<{
    ext_id?: string; title?: string; body?: string;
    pinned?: number; class_name?: string; expires_at?: string;
  }>();

  if (auth.scope !== "global" && body.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (body.class_name !== allowed) return jsonError(c, 403, "Cannot change to a different class");
  }

  const success = await updateAnnouncement(c.env.jtk25_schedules, id, {
    ext_id: body.ext_id,
    title: body.title,
    body: body.body,
    pinned: body.pinned,
    class_name: body.class_name,
    expires_at: body.expires_at,
  });

  if (!success) return jsonError(c, 500, "Failed to update announcement");

  return c.json({ ok: true });
});

adminContent.delete("/announcements/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid announcement ID");

  const existing = await getAnnouncementById(c.env.jtk25_schedules, id);
  if (!existing) return jsonError(c, 404, "Announcement not found");

  if (auth.scope !== "global" && existing.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (existing.class_name !== allowed) return jsonError(c, 403, "Access denied");
  }

  const success = await deleteAnnouncement(c.env.jtk25_schedules, id);
  if (!success) return jsonError(c, 500, "Failed to delete announcement");

  return c.json({ ok: true });
});

// ─── Pengganti ───────────────────────────────────────────────────────────────

adminContent.get("/pengganti", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const classCode = auth.scope === "global"
    ? undefined
    : auth.scope.replace("class:", "");
  const rows = await getPenggantiFromD1(c.env.jtk25_schedules, classCode);
  const parsed = rows.map((r) => ({
    ...r,
    sessions: r.sessions ? JSON.parse(r.sessions) : [],
  }));
  return c.json(parsed);
});

adminContent.get("/pengganti/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid pengganti ID");

  const row = await getPenggantiById(c.env.jtk25_schedules, id);
  if (!row) return jsonError(c, 404, "Pengganti not found");

  if (auth.scope !== "global") {
    const allowed = auth.scope.replace("class:", "");
    if (row.class_code !== allowed) return jsonError(c, 403, "Access denied");
  }

  return c.json({
    ...row,
    sessions: row.sessions ? JSON.parse(row.sessions) : [],
  });
});

adminContent.post("/pengganti", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const body = await c.req.json<{
    ext_id?: string; class_code: string; date: string;
    kind: "replace" | "add" | "info"; note?: string;
    sessions?: Array<Record<string, unknown>>;
  }>();

  if (!body.class_code || !body.date || !body.kind) {
    return jsonError(c, 400, "Missing required fields: class_code, date, kind");
  }

  if (auth.scope !== "global") {
    const allowed = auth.scope.replace("class:", "");
    if (body.class_code !== allowed) return jsonError(c, 403, "Access denied to this class");
  }

  const extId = body.ext_id ?? `pg-${Date.now()}`;
  const sessionsJson = body.sessions ? JSON.stringify(body.sessions) : null;
  const newId = await insertPengganti(c.env.jtk25_schedules, {
    ext_id: extId,
    class_code: body.class_code,
    date: body.date,
    kind: body.kind,
    note: body.note ?? null,
    sessions: sessionsJson,
  });

  sendPenggantiUpdateNotification(c.env, body.class_code);

  return c.json({ ok: true, id: newId }, 201);
});

adminContent.put("/pengganti/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid pengganti ID");

  const existing = await getPenggantiById(c.env.jtk25_schedules, id);
  if (!existing) return jsonError(c, 404, "Pengganti not found");

  if (auth.scope !== "global") {
    const allowed = auth.scope.replace("class:", "");
    if (existing.class_code !== allowed) return jsonError(c, 403, "Access denied");
  }

  const body = await c.req.json<{
    ext_id?: string; class_code?: string; date?: string;
    kind?: "replace" | "add" | "info"; note?: string;
    sessions?: Array<Record<string, unknown>>;
  }>();

  if (auth.scope !== "global" && body.class_code) {
    const allowed = auth.scope.replace("class:", "");
    if (body.class_code !== allowed) return jsonError(c, 403, "Cannot change to a different class");
  }

  const sessionsJson = body.sessions !== undefined
    ? JSON.stringify(body.sessions)
    : undefined;

  const success = await updatePengganti(c.env.jtk25_schedules, id, {
    ext_id: body.ext_id,
    class_code: body.class_code,
    date: body.date,
    kind: body.kind,
    note: body.note,
    sessions: sessionsJson,
  });

  if (!success) return jsonError(c, 500, "Failed to update pengganti");

  sendPenggantiUpdateNotification(c.env, body.class_code ?? existing.class_code);

  return c.json({ ok: true });
});

adminContent.delete("/pengganti/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid pengganti ID");

  const existing = await getPenggantiById(c.env.jtk25_schedules, id);
  if (!existing) return jsonError(c, 404, "Pengganti not found");

  if (auth.scope !== "global") {
    const allowed = auth.scope.replace("class:", "");
    if (existing.class_code !== allowed) return jsonError(c, 403, "Access denied");
  }

  const success = await deletePengganti(c.env.jtk25_schedules, id);
  if (!success) return jsonError(c, 500, "Failed to delete pengganti");

  sendScheduleUpdateNotification(c.env, existing.class_code);

  return c.json({ ok: true });
});

// ─── Rooms ───────────────────────────────────────────────────────────────────

adminContent.get("/rooms", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");
  if (auth.scope !== "global") return jsonError(c, 403, "Global access required");

  const rows = await getRoomsFromD1(c.env.jtk25_schedules);
  return c.json(rows);
});

adminContent.get("/rooms/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");
  if (auth.scope !== "global") return jsonError(c, 403, "Global access required");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid room ID");

  const row = await getRoomById(c.env.jtk25_schedules, id);
  if (!row) return jsonError(c, 404, "Room not found");

  return c.json(row);
});

adminContent.post("/rooms", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");
  if (auth.scope !== "global") return jsonError(c, 403, "Global access required");

  const body = await c.req.json<{
    ext_id?: string; name: string; type: "kelas" | "lab";
  }>();

  if (!body.name || !body.type) {
    return jsonError(c, 400, "Missing required fields: name, type");
  }

  const extId = body.ext_id ?? `room-${Date.now()}`;
  const newId = await insertRoom(c.env.jtk25_schedules, {
    ext_id: extId,
    name: body.name,
    type: body.type,
  });

  return c.json({ ok: true, id: newId }, 201);
});

adminContent.put("/rooms/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");
  if (auth.scope !== "global") return jsonError(c, 403, "Global access required");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid room ID");

  const existing = await getRoomById(c.env.jtk25_schedules, id);
  if (!existing) return jsonError(c, 404, "Room not found");

  const body = await c.req.json<{
    ext_id?: string; name?: string; type?: "kelas" | "lab";
  }>();

  const success = await updateRoom(c.env.jtk25_schedules, id, {
    ext_id: body.ext_id,
    name: body.name,
    type: body.type,
  });

  if (!success) return jsonError(c, 500, "Failed to update room");

  return c.json({ ok: true });
});

adminContent.delete("/rooms/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");
  if (auth.scope !== "global") return jsonError(c, 403, "Global access required");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid room ID");

  const existing = await getRoomById(c.env.jtk25_schedules, id);
  if (!existing) return jsonError(c, 404, "Room not found");

  const success = await deleteRoom(c.env.jtk25_schedules, id);
  if (!success) return jsonError(c, 500, "Failed to delete room");

  return c.json({ ok: true });
});

export default adminContent;
