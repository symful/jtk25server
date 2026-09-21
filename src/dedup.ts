import type { Env } from "../worker-configuration";

/**
 * Check whether a notification with the given dedup key has already been sent.
 *
 * Key format is caller's choice — common pattern:
 * `{type}:{classCode}:{dateISO}:{slotStart}`
 * e.g. `jam-9:D3-2A:2026-09-22:08:50`
 */
export async function wasSent(env: Env, key: string): Promise<boolean> {
  const row = await env.jtk25_schedules
    .prepare("SELECT key FROM notification_sent_log WHERE key = ?")
    .bind(key)
    .first();
  return row !== null;
}

/**
 * Record a notification as sent and opportunistically prune rows older than 24h.
 * Idempotent: calling twice with the same key is safe (INSERT OR IGNORE).
 */
export async function markSent(env: Env, key: string): Promise<void> {
  const nowMs = Date.now();
  const threshold = nowMs - 86_400_000;

  await env.jtk25_schedules
    .prepare(
      "INSERT OR IGNORE INTO notification_sent_log (key, sent_at) VALUES (?, ?)",
    )
    .bind(key, nowMs)
    .run();

  await env.jtk25_schedules
    .prepare("DELETE FROM notification_sent_log WHERE sent_at < ?")
    .bind(threshold)
    .run();
}
