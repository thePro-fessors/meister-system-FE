import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_KEYS = 2000;
const MAX_BODY_BYTES = 2048;
const attempts = new Map<string, { count: number; expires: number }>();

function reply(status: number, verified = false, retryAfter?: number) {
  return Response.json({ verified }, {
    status,
    headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return reply(403);

  const configured = process.env.TEACHER_SIGNUP_CODE;
  if (!configured?.trim() || configured.length > 256) return reply(503);

  // Demo-only, process-local limit. The deployment proxy must overwrite forwarded IPs;
  // untrusted headers can be spoofed, and replicas need a shared limiter in production.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim();
  const key = forwarded && forwarded.length <= 64 ? forwarded : "unknown";
  const now = Date.now();
  for (const [ip, entry] of attempts) if (entry.expires <= now) attempts.delete(ip);
  let entry = attempts.get(key);
  if (!entry) {
    if (attempts.size >= MAX_KEYS) return reply(429, false, Math.ceil(WINDOW_MS / 1000));
    entry = { count: 0, expires: now + WINDOW_MS };
    attempts.set(key, entry);
  }
  if (entry.count >= MAX_ATTEMPTS) return reply(429, false, Math.ceil((entry.expires - now) / 1000));
  entry.count += 1;

  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return reply(415);
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return reply(413);

  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  let input: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return reply(413);
      }
      chunks.push(value);
    }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply(400);
  } finally {
    reader.releaseLock();
  }
  if (!input || typeof input !== "object" || !("code" in input) || typeof input.code !== "string" || !input.code.trim() || input.code.length > 256) return reply(400);

  const suppliedHash = createHash("sha256").update(input.code).digest();
  const configuredHash = createHash("sha256").update(configured).digest();
  const verified = timingSafeEqual(suppliedHash, configuredHash);
  return reply(verified ? 200 : 403, verified);
}
