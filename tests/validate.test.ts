import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import { readdirSync } from "node:fs";
import { validateDir, type ValidationResult } from "../tools/validate.js";

const ROOT = resolve(import.meta.dirname, "..");
const DATA_DIR = join(ROOT, "data");
const BAD_DIR = join(ROOT, "tests", "fixtures", "bad");

const dataFiles = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

function validateBad(file: string, schemaName: string): ValidationResult {
  const [result] = validateDir(BAD_DIR, [file], {
    dosenDir: DATA_DIR,
    schemaOverrides: { [file]: schemaName },
  });
  return result;
}

describe("good data passes", () => {
  it("all data/*.json validates successfully", () => {
    const results = validateDir(DATA_DIR, dataFiles);
    const failures = results.filter((r) => r.errors.length > 0);
    expect(failures).toEqual([]);
  });
});

describe("bad fixtures are rejected", () => {
  it("colon-time format rejected (07:00 instead of 07.00)", () => {
    const r = validateBad("schedules_bad-colon-time.json", "schedule-class.json");
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some((e) => e.includes("time") && e.includes("pattern"))).toBe(true);
  });

  it("unknown lecturer_code rejected", () => {
    const r = validateBad("schedules_bad-unknown-lecturer.json", "schedule-class.json");
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some((e) => e.includes('lecturer_code "ZZ"'))).toBe(true);
  });

  it("invalid pengganti date rejected (2026-02-30)", () => {
    const r = validateBad("pengganti.json", "pengganti.json");
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some((e) => e.includes("date") || e.includes("format"))).toBe(true);
  });

  it("duplicate id rejected", () => {
    const r = validateBad("announcements.json", "announcements.json");
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some((e) => e.includes("ann-001"))).toBe(true);
  });

  it("invalid type letter rejected (XX instead of TE/PR)", () => {
    const r = validateBad("schedules_D3-S3_type-letter.json", "schedule-class.json");
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some((e) => e.includes("type") || e.includes("allowedValues"))).toBe(true);
  });
});
