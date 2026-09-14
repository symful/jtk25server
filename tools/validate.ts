#!/usr/bin/env tsx
/**
 * CLI data validator — validates data/*.json against schemas/ with cross-file rules.
 * Usage:
 *   node tools/validate.ts                          # validate all data/*.json
 *   node tools/validate.ts FILE...                  # validate specific files (basenames)
 *   node tools/validate.ts --dir <path> FILE...     # validate files from custom dir
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ROOT = resolve(import.meta.dirname, "..");
const SCHEMA_DIR = join(ROOT, "schemas");

export const FILE_SCHEMA_MAP: Record<string, string> = {
  "pengganti.json": "pengganti.json",
  "announcements.json": "announcements.json",
  "calendar.json": "calendar.json",
  "dosen.json": "dosen.json",
  "rooms.json": "rooms.json",
};

export function schemaFor(filename: string): string | null {
  if (filename.startsWith("schedules_") && filename.endsWith(".json")) {
    return "schedule-class.json";
  }
  return FILE_SCHEMA_MAP[filename] ?? null;
}

export function splitCodes(raw: string): string[] {
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export interface ValidationResult {
  file: string;
  errors: string[];
}

export function validateDir(
  dataDir: string,
  files: string[],
  opts: { dosenDir?: string; schemaOverrides?: Record<string, string> } = {},
): ValidationResult[] {
  const dosenSource = opts.dosenDir ?? dataDir;
  const dosenData = JSON.parse(readFileSync(join(dosenSource, "dosen.json"), "utf-8"));
  const validDosenCodes: Set<string> = new Set(
    (dosenData.data as any[]).map((d: any) => d.code),
  );

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const validators = new Map<string, ReturnType<Ajv["compile"]>>();
  function getValidator(schemaName: string) {
    if (!validators.has(schemaName)) {
      const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, schemaName), "utf-8"));
      validators.set(schemaName, ajv.compile(schema));
    }
    return validators.get(schemaName)!;
  }

  function resolveSchema(file: string): string | null {
    if (opts.schemaOverrides?.[file]) return opts.schemaOverrides[file];
    return schemaFor(file);
  }

  const loaded = new Map<string, any>();
  for (const f of files) {
    try {
      loaded.set(f, JSON.parse(readFileSync(join(dataDir, f), "utf-8")));
    } catch {
      /* surfaces as error below */
    }
  }

  const results: ValidationResult[] = [];

  for (const file of files) {
    const errors: string[] = [];
    const schemaName = resolveSchema(file);

    if (!schemaName) {
      errors.push(`No schema mapping for "${file}"`);
    } else {
      const raw = loaded.get(file);
      if (!raw) {
        errors.push(`File not found or unreadable: ${file}`);
      } else {
        const validateFn = getValidator(schemaName);
        const ok = validateFn(raw);
        if (!ok) {
          for (const e of validateFn.errors ?? []) {
            const pointer = e.instancePath || "/";
            const extra = e.params ? ` (${JSON.stringify(e.params)})` : "";
            errors.push(`schema: ${pointer} ${e.message}${extra}`);
          }
        }

        if (schemaName === "schedule-class.json" && raw.data?.schedule) {
          for (const day of raw.data.schedule) {
            for (const sess of day.sessions ?? []) {
              for (const code of splitCodes(sess.lecturer_code)) {
                if (!validDosenCodes.has(code)) {
                  errors.push(
                    `cross-ref: lecturer_code "${code}" not found in dosen.json (session "${sess.course_code}" ${sess.time})`,
                  );
                }
              }
            }
          }
        }

        if (schemaName === "pengganti.json" && Array.isArray(raw.data)) {
          for (const entry of raw.data) {
            if (entry.date && !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
              errors.push(
                `cross-ref: pengganti date "${entry.date}" is not YYYY-MM-DD (id="${entry.id}")`,
              );
            }
            if (entry.sessions) {
              for (const sess of entry.sessions) {
                for (const code of splitCodes(sess.lecturer_code)) {
                  if (!validDosenCodes.has(code)) {
                    errors.push(
                      `cross-ref: lecturer_code "${code}" not found in dosen.json (pengganti id="${entry.id}")`,
                    );
                  }
                }
              }
            }
          }
        }

        if (schemaName !== "schedule-class.json" && Array.isArray(raw.data)) {
          const ids = raw.data
            .filter((item: any) => item && typeof item.id === "string")
            .map((item: any) => item.id);
          const seen = new Set<string>();
          for (const id of ids) {
            if (seen.has(id)) {
              errors.push(`duplicate: id "${id}" appears more than once`);
            }
            seen.add(id);
          }
        }
      }
    }

    results.push({ file, errors });
  }

  return results;
}

function main(): never {
  const args = process.argv.slice(2);

  let dataDir = join(ROOT, "data");
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && i + 1 < args.length) {
      dataDir = resolve(args[++i]);
    } else {
      positional.push(args[i]);
    }
  }

  const allFiles = readdirSync(dataDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const targetFiles =
    positional.length > 0
      ? positional.map((a) => basename(a)).filter((f) => allFiles.includes(f))
      : allFiles;

  const results = validateDir(dataDir, targetFiles, { dosenDir: join(ROOT, "data") });

  let exitCode = 0;
  for (const { file, errors } of results) {
    if (errors.length === 0) {
      console.log(`✅ PASS  ${file}`);
    } else {
      console.log(`❌ FAIL  ${file}`);
      for (const err of errors) {
        console.log(`         → ${err}`);
      }
      exitCode = 1;
    }
  }

  console.log("");
  if (exitCode === 0) {
    console.log(`All ${results.length} file(s) passed.`);
  } else {
    console.log("Validation failed.");
  }

  process.exit(exitCode);
}

const isMain =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`);
if (isMain) {
  main();
}
