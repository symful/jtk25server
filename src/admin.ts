import { Hono } from "hono";
import {
  getSchedulesFromD1,
  getScheduleFromClass,
  getScheduleRowById,
  insertScheduleRow,
  updateScheduleRow,
  deleteScheduleRow,
} from "./data";
import { sendScheduleUpdateNotification } from "./fcm";

type AppEnv = { Bindings: Env };

const admin = new Hono<AppEnv>();

const CLASS_LIST = [
  "D3_1A", "D3_1B", "D3_2A", "D3_2B", "D3_3A", "D3_3B", "D3_3C",
  "D4_1A", "D4_1B", "D4_1C", "D4_1D", "D4_2A", "D4_2B", "D4_2C", "D4_2D",
  "D4_3A", "D4_3B", "D4_4A", "D4_4B",
] as const;

function getClassPass(env: Env, className: string): string | undefined {
  const key = `ADMIN_PASS_${className}` as keyof Env;
  return env[key] as string | undefined;
}

function classCodeToEnvKey(code: string): string {
  return code.replace("-", "_");
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

admin.post("/auth", async (c) => {
  const body = await c.req.json<{ password: string }>();
  const { password } = body;
  if (!password) return jsonError(c, 400, "Password is required");

  if (password === c.env.ADMIN_PASS_GLOBAL) {
    return c.json({ ok: true, scope: "global" });
  }

  for (const cls of CLASS_LIST) {
    const pass = getClassPass(c.env, cls);
    if (pass && password === pass) {
      return c.json({ ok: true, scope: `class:${cls.replace("_", "-")}` });
    }
  }

  return jsonError(c, 401, "Invalid password");
});

admin.get("/schedules", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const { semester, classes } = await getSchedulesFromD1(c.env.jtk25_schedules);

  if (auth.scope === "global") return c.json({ semester, classes });

  const className = auth.scope.replace("class:", "");
  const filtered = classes.filter((cls) => cls.class_name === className);
  return c.json({ semester, classes: filtered, scope: auth.scope });
});

admin.get("/schedules/:className", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const className = c.req.param("className");
  if (auth.scope !== "global") {
    const allowed = auth.scope.replace("class:", "");
    if (className !== allowed) return jsonError(c, 403, "Access denied to this class schedule");
  }

  const result = await getScheduleFromClass(c.env.jtk25_schedules, className);
  if (!result) return jsonError(c, 404, `Schedule for class ${className} not found`);
  return c.json(result);
});

admin.post("/schedules", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const body = await c.req.json<{
    class_name: string; semester: string; day: string; time: string;
    course_code: string; course_name: string; type: string;
    lecturer_code: string; lecturer: string; room: string; slot_order?: number;
    mode?: string;
  }>();

  if (auth.scope !== "global") {
    const allowed = auth.scope.replace("class:", "");
    if (body.class_name !== allowed) return jsonError(c, 403, "Access denied to this class schedule");
  }

  const required = ["class_name", "semester", "day", "time", "course_code", "course_name", "type", "lecturer_code", "room"] as const;
  for (const field of required) {
    if (!body[field]) return jsonError(c, 400, `Missing required field: ${field}`);
  }

  const newId = await insertScheduleRow(c.env.jtk25_schedules, {
    class_name: body.class_name, semester: body.semester, day: body.day,
    time: body.time, course_code: body.course_code, course_name: body.course_name,
    type: body.type, lecturer_code: body.lecturer_code, lecturer: body.lecturer ?? "",
    room: body.room, slot_order: body.slot_order ?? 0,
    mode: body.mode ?? 'offline',
  });

  return c.json({ ok: true, id: newId }, 201);
});

admin.put("/schedules/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid schedule ID");

  const existing = await getScheduleRowById(c.env.jtk25_schedules, id);
  if (!existing) return jsonError(c, 404, "Schedule not found");

  if (auth.scope !== "global") {
    const allowed = auth.scope.replace("class:", "");
    if (existing.class_name !== allowed) return jsonError(c, 403, "Access denied to this class schedule");
  }

  const body = await c.req.json<{
    class_name?: string; semester?: string; day?: string; time?: string;
    course_code?: string; course_name?: string; type?: string;
    lecturer_code?: string; lecturer?: string; room?: string; slot_order?: number;
    mode?: string;
  }>();

  if (auth.scope !== "global" && body.class_name) {
    const allowed = auth.scope.replace("class:", "");
    if (body.class_name !== allowed) return jsonError(c, 403, "Cannot change class_name to a different class");
  }

  const updated = {
    class_name: body.class_name ?? existing.class_name,
    semester: body.semester ?? existing.semester,
    day: body.day ?? existing.day, time: body.time ?? existing.time,
    course_code: body.course_code ?? existing.course_code,
    course_name: body.course_name ?? existing.course_name,
    type: body.type ?? existing.type,
    lecturer_code: body.lecturer_code ?? existing.lecturer_code,
    lecturer: body.lecturer ?? existing.lecturer,
    room: body.room ?? existing.room,
    slot_order: body.slot_order ?? existing.slot_order,
    mode: body.mode ?? existing.mode ?? 'offline',
  };

  const success = await updateScheduleRow(c.env.jtk25_schedules, id, updated);
  if (!success) return jsonError(c, 500, "Failed to update schedule");

  return c.json({ ok: true });
});

admin.delete("/schedules/:id", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return jsonError(c, 400, "Invalid schedule ID");

  const existing = await getScheduleRowById(c.env.jtk25_schedules, id);
  if (!existing) return jsonError(c, 404, "Schedule not found");

  if (auth.scope !== "global") {
    const allowed = auth.scope.replace("class:", "");
    if (existing.class_name !== allowed) return jsonError(c, 403, "Access denied to this class schedule");
  }

  const success = await deleteScheduleRow(c.env.jtk25_schedules, id);
  if (!success) return jsonError(c, 500, "Failed to delete schedule");

  return c.json({ ok: true });
});

admin.post("/notify", async (c) => {
  const auth = await authenticate(c);
  if (!auth.authenticated) return jsonError(c, 401, "Unauthorized");

  const body = await c.req.json<{ classes?: string[] }>();
  const classes = body.classes ?? [];

  if (classes.length === 0) return jsonError(c, 400, "No classes provided");

  await Promise.all(
    classes.map((cls) => sendScheduleUpdateNotification(c.env, cls)),
  );

  return c.json({ ok: true, notified: classes.length });
});

export default admin;
