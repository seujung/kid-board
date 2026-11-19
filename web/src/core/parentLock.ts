export const IDLE_TIMEOUT_MS = 120000;
export const SECURE_CONTEXT_MESSAGE = "보안 연결(HTTPS)에서만 PIN을 정할 수 있어요";

const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 60000;

export class SecureContextError extends Error {
  constructor(message: string = SECURE_CONTEXT_MESSAGE) {
    super(message);
    this.name = "SecureContextError";
  }
}

/** Exactly four ASCII digits. */
export function isValidPin(pin: string): boolean {
  return /^[0-9]{4}$/.test(pin);
}

/** Exactly eight ASCII digits. */
export function isValidRecoveryCode(code: string): boolean {
  return /^[0-9]{8}$/.test(code);
}

function toHex(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => {
    s += (b < 16 ? "0" : "") + b.toString(16);
  });
  return s;
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** 16 random bytes as 32 lowercase hex chars. */
export function makeSalt(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** Lowercase hex of SHA-256(salt bytes + secret UTF-8 bytes). */
export async function hashSecret(secret: string, saltHex: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new SecureContextError();
  const salt = fromHex(saltHex);
  const body = new TextEncoder().encode(secret);
  const input = new Uint8Array(salt.length + body.length);
  input.set(salt, 0);
  input.set(body, salt.length);
  const digest = await subtle.digest("SHA-256", input);
  return toHex(new Uint8Array(digest));
}

/** Uniform 8-digit code (leading zeros allowed) via rejection sampling. */
export function makeRecoveryCode(): string {
  const range = 100000000;
  const limit = Math.floor(4294967296 / range) * range;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    const v = buf[0] ?? limit;
    if (v < limit) return String(v % range).padStart(8, "0");
  }
}

export interface Lockout {
  failures: number;
  lockedUntil: number | null;
}

export const EMPTY_LOCKOUT: Lockout = { failures: 0, lockedUntil: null };

export function isLocked(l: Lockout, now: number): boolean {
  return l.lockedUntil !== null && now < l.lockedUntil;
}

export function recordFailure(l: Lockout, now: number): Lockout {
  const failures = l.failures + 1;
  if (failures >= MAX_FAILURES) {
    // While already locked, keep the existing lock instead of extending it.
    const lockedUntil = isLocked(l, now) ? l.lockedUntil : now + LOCK_DURATION_MS;
    return { failures: 0, lockedUntil };
  }
  return { failures, lockedUntil: l.lockedUntil };
}

export function recordSuccess(): Lockout {
  return { failures: 0, lockedUntil: null };
}
