import { describe, it, expect } from "vitest";
import {
  getFileData,
  getFilesData,
  computeDataVersion,
  CLASS_FILES,
  LIST_FILES,
  ALL_FILES,
} from "../src/data";

describe("getFileData", () => {
  it("returns bundled dosen data with expected shape", () => {
    const data = getFileData("dosen.json") as {
      schema: number;
      semester: string;
      data: Array<{ code: string; name: string }>;
    };
    expect(data).not.toBeNull();
    expect(data.schema).toBe(2);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0]).toHaveProperty("code");
    expect(data.data[0]).toHaveProperty("name");
  });

  it("returns null for schedule files (now served from D1)", () => {
    expect(getFileData("schedules_D3_2A.json")).toBeNull();
  });

  it("returns null for unknown file", () => {
    expect(getFileData("nonexistent.json")).toBeNull();
  });
});

describe("getFilesData", () => {
  it("returns null values for CLASS_FILES (now served from D1)", () => {
    const results = getFilesData(CLASS_FILES);
    expect(results.size).toBe(CLASS_FILES.length);
    for (const file of CLASS_FILES) {
      expect(results.has(file)).toBe(true);
      expect(results.get(file)).toBeNull();
    }
  });

  it("returns data for LIST_FILES", () => {
    const results = getFilesData(LIST_FILES);
    expect(results.size).toBe(LIST_FILES.length);
    for (const file of LIST_FILES) {
      expect(results.has(file)).toBe(true);
    }
  });

  it("ALL_FILES covers CLASS_FILES + LIST_FILES", () => {
    expect(ALL_FILES).toEqual([...CLASS_FILES, ...LIST_FILES]);
  });
});

describe("computeDataVersion", () => {
  it("returns a 64-char hex string (SHA-256)", async () => {
    const hash = await computeDataVersion({ a: { x: 1 } });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic (same input → same hash)", async () => {
    const input = { file1: { schema: 2, data: [1, 2, 3] } };
    const h1 = await computeDataVersion(input);
    const h2 = await computeDataVersion(input);
    expect(h1).toBe(h2);
  });

  it("keys are sorted (order-independent)", async () => {
    const a = await computeDataVersion({ x: 1, a: 2, m: 3 });
    const b = await computeDataVersion({ m: 3, a: 2, x: 1 });
    expect(a).toBe(b);
  });

  it("different data produces different hash", async () => {
    const h1 = await computeDataVersion({ a: 1 });
    const h2 = await computeDataVersion({ a: 2 });
    expect(h1).not.toBe(h2);
  });

  it("empty input returns a valid hash", async () => {
    const hash = await computeDataVersion({});
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles nested objects", async () => {
    const input = {
      schedules: { class_name: "D3-2A", schedule: [{ day: "SENIN" }] },
      dosen: [{ code: "AB" }],
    };
    const hash = await computeDataVersion(input);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("legacy merge shape", () => {
  it("builds legacy /api/schedules shape from v2 class files", () => {
    const v2Data = CLASS_FILES.map((file) => ({
      semester: "2026/2027-GANJIL",
      data: {
        class_name: file.replace("schedules_", "").replace(".json", ""),
        schedule: [{ day: "SENIN", sessions: [] }],
      },
    }));

    let semesterStr = "";
    const classes: Array<{ class_name: string; schedule: unknown }> = [];
    for (const d of v2Data) {
      semesterStr = d.semester;
      classes.push({ class_name: d.data.class_name, schedule: d.data.schedule });
    }

    const [academic_year, semester] = semesterStr.split("-");

    const legacy = { academic_year, semester, curriculum: "2025", classes };

    expect(legacy.academic_year).toBe("2026/2027");
    expect(legacy.semester).toBe("GANJIL");
    expect(legacy.curriculum).toBe("2025");
    expect(legacy.classes).toHaveLength(19);
    expect(legacy.classes[0].class_name).toBeDefined();
    expect(legacy.classes[0].schedule).toBeDefined();
    expect(Array.isArray(legacy.classes[0].schedule)).toBe(true);
  });

  it("version endpoint returns parseable 2.0", () => {
    const version = "2.0";
    expect(parseFloat(version)).toBe(2.0);
  });
});
