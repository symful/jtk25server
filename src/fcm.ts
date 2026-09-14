/**
 * FCM push via HTTP v1 API — raw fetch + Web Crypto JWT signing.
 * Requires FIREBASE_SERVICE_ACCOUNT Worker secret (full service account JSON).
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

interface FCMMessage {
  message: {
    topic: string;
    notification: { title: string; body: string };
    data: Record<string, string>;
  };
}

function base64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);
  return der;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const der = pemToDer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function createSignedJwt(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signingInput),
  );

  return `${signingInput}.${base64url(signature)}`;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const jwt = await createSignedJwt(sa);
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`FCM token exchange failed (${resp.status}): ${text}`);
  }

  const data: { access_token: string } = await resp.json();
  return data.access_token;
}

/**
 * Send FCM push to a topic. Fire-and-forget: errors are logged, never thrown.
 */
export async function sendToTopic(
  env: Env,
  topic: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  try {
    const sa: ServiceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

    const message: FCMMessage = {
      message: { topic, notification: { title, body }, data },
    };

    const accessToken = await getAccessToken(sa);

    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      },
    );

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`FCM send failed (${resp.status}) for topic ${topic}: ${text}`);
    } else {
      console.log(`FCM sent to topic ${topic}`);
    }
  } catch (err) {
    console.error("FCM push error:", err);
  }
}

/** Send to `jtk25_{className}` (underscores → hyphens). */
function classTopic(className: string): string {
  return `jtk25_${className.replace(/_/g, "-")}`;
}

export async function sendScheduleUpdateNotification(env: Env, className: string): Promise<void> {
  await sendToTopic(env, classTopic(className), "Jadwal Diperbarui", `Jadwal kelas ${className} telah diperbarui.`, { type: "schedule_update", className });
}

export async function sendPenggantiUpdateNotification(env: Env, className: string): Promise<void> {
  await sendToTopic(env, classTopic(className), "Pengganti Diperbarui", `Data pengganti kelas ${className} telah diperbarui.`, { type: "pengganti_update", className });
}

export async function sendCalendarUpdateNotification(env: Env, className: string): Promise<void> {
  await sendToTopic(env, classTopic(className), "Kalender Diperbarui", `Kalender kelas ${className} telah diperbarui.`, { type: "calendar_update", className });
}


