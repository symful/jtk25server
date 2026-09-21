import { describe, it, expect } from "vitest";
import { wasSent, markSent } from "./dedup";
import type { Env } from "../worker-configuration";

// ─── In-memory D1 mock (Map-backed, no external deps) ──────────────────────

type Row = { key: string; sent_at: number };

function createMockEnv(): { env: Env; store: Map<string, Row> } {
  const store = new Map<string, Row>();

  function prepare(sql: string) {
    let boundParams: unknown[] = [];

    const bind = (...params: unknown[]) => {
      boundParams = params;
      return {
        run: async () => {
          if (sql.includes("INSERT OR IGNORE")) {
            const key = boundParams[0] as string;
            const sent_at = boundParams[1] as number;
            const existed = store.has(key);
            if (!existed) {
              store.set(key, { key, sent_at });
            }
            return {
              success: true,
              meta: { last_row_id: 0, changes: existed ? 0 : 1 },
            };
          }
          if (sql.includes("DELETE FROM notification_sent_log")) {
            const threshold = boundParams[0] as number;
            let changes = 0;
            for (const [k, v] of store) {
              if (v.sent_at < threshold) {
                store.delete(k);
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
        first: async <T = Row>(): Promise<T | null> => {
          if (sql.includes("SELECT") && sql.includes("WHERE key = ?")) {
            const key = boundParams[0] as string;
            const row = store.get(key);
            return (row ?? null) as T | null;
          }
          return null;
        },
        all: async <T = Row>() => ({
          results: Array.from(store.values()) as T[],
        }),
      };
    };

    return { bind };
  }

  const env = {
    jtk25_schedules: { prepare },
  } as unknown as Env;
  return { env, store };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("notification dedup", () => {
  it("wasSent returns false for unknown key", async () => {
    const { env } = createMockEnv();
    const result = await wasSent(env, "jam-9:D3-2A:2026-09-22:08:50");
    expect(result).toBe(false);
  });

  it("markSent + wasSent round-trip", async () => {
    const { env } = createMockEnv();
    const key = "jam-9:D3-2A:2026-09-22:08:50";
    expect(await wasSent(env, key)).toBe(false);
    await markSent(env, key);
    expect(await wasSent(env, key)).toBe(true);
  });

  it("different keys are independent", async () => {
    const { env } = createMockEnv();
    await markSent(env, "jam-9:D3-2A:2026-09-22:08:50");
    expect(await wasSent(env, "jam-9:D3-2A:2026-09-22:08:50")).toBe(true);
    expect(await wasSent(env, "pengganti:D3-3B:2026-09-23:10:00")).toBe(false);
  });

  it("markSent is idempotent (INSERT OR IGNORE)", async () => {
    const { env, store } = createMockEnv();
    const key = "jam-9:D3-2A:2026-09-22:08:50";
    await markSent(env, key);
    const firstSentAt = store.get(key)!.sent_at;
    await markSent(env, key);
    expect(store.size).toBe(1);
    // sent_at unchanged — INSERT OR IGNORE skipped second insert
    expect(store.get(key)!.sent_at).toBe(firstSentAt);
  });

  it("prune deletes rows older than 24h and keeps fresh ones", async () => {
    const { env, store } = createMockEnv();
    const now = Date.now();
    const dayMs = 86_400_000;

    store.set("old-key", { key: "old-key", sent_at: now - dayMs - 3_600_000 });
    store.set("fresh-key", { key: "fresh-key", sent_at: now - 3_600_000 });

    await markSent(env, "trigger-prune");

    expect(store.has("old-key")).toBe(false);
    expect(store.has("fresh-key")).toBe(true);
    expect(store.has("trigger-prune")).toBe(true);
  });
});
