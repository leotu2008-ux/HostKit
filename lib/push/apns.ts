import { connect } from "node:http2";
import { importPKCS8, SignJWT } from "jose";

/**
 * Apple Push Notification service, token-based (a .p8 key), over HTTP/2.
 * `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID` and
 * `APNS_ENV` (sandbox | production) turn it on; without them
 * `isPushConfigured()` is false and notifications stay in the Inbox and
 * email. One session per call — serverless can't keep one open.
 *
 * Can't be exercised end-to-end until a paid Apple developer team exists;
 * the JWT shape is unit-tested and the request follows Apple's spec.
 */

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.APNS_TEAM_ID &&
      process.env.APNS_KEY_ID &&
      process.env.APNS_PRIVATE_KEY &&
      process.env.APNS_BUNDLE_ID,
  );
}

export type PushMessage = {
  token: string;
  title: string;
  body: string;
  badge?: number;
  data?: Record<string, string | null>;
};

let cachedJwt: { value: string; issuedAt: number } | null = null;

/** Apple wants the provider token refreshed at least hourly, at most every 20 min. */
export async function providerJwt(now = Date.now()): Promise<string> {
  if (cachedJwt && now - cachedJwt.issuedAt < 40 * 60 * 1000) return cachedJwt.value;
  const pem = process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APNS_KEY_ID! })
    .setIssuer(process.env.APNS_TEAM_ID!)
    .setIssuedAt(Math.floor(now / 1000))
    .sign(key);
  cachedJwt = { value, issuedAt: now };
  return value;
}

/** The APNs payload for one message. */
export function payloadFor(message: PushMessage) {
  return {
    aps: {
      alert: { title: message.title, body: message.body },
      sound: "default",
      ...(message.badge !== undefined ? { badge: message.badge } : {}),
    },
    ...(message.data ?? {}),
  };
}

const HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};

/** Sends each message; returns the tokens Apple says are gone (410 / BadDeviceToken). */
export async function sendPush(messages: PushMessage[], timeoutMs = 8000): Promise<string[]> {
  if (messages.length === 0) return [];
  const host = HOSTS[process.env.APNS_ENV === "production" ? "production" : "sandbox"];
  const jwt = await providerJwt();
  const session = connect(host);
  const dead: string[] = [];
  const timer = setTimeout(() => session.close(), timeoutMs);
  try {
    await Promise.all(
      messages.map(
        (message) =>
          new Promise<void>((resolve) => {
            const body = JSON.stringify(payloadFor(message));
            const req = session.request({
              ":method": "POST",
              ":path": `/3/device/${message.token}`,
              authorization: `bearer ${jwt}`,
              "apns-topic": process.env.APNS_BUNDLE_ID!,
              "apns-push-type": "alert",
              "apns-priority": "10",
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            });
            let status = 0;
            let text = "";
            req.on("response", (headers) => {
              status = Number(headers[":status"] ?? 0);
            });
            req.on("data", (chunk) => {
              text += chunk;
            });
            req.on("end", () => {
              if (status === 410 || (status === 400 && text.includes("BadDeviceToken"))) dead.push(message.token);
              else if (status >= 300) console.error(`[apns] ${status} ${text.slice(0, 120)}`);
              resolve();
            });
            req.on("error", (error) => {
              console.error("[apns] request failed", error);
              resolve();
            });
            req.end(body);
          }),
      ),
    );
  } finally {
    clearTimeout(timer);
    session.close();
  }
  return dead;
}
