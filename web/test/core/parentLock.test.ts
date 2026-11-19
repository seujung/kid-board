import { afterEach, expect, test, vi } from "vitest";
import {
  EMPTY_LOCKOUT,
  IDLE_TIMEOUT_MS,
  SECURE_CONTEXT_MESSAGE,
  SecureContextError,
  hashSecret,
  isLocked,
  isValidPin,
  isValidRecoveryCode,
  makeRecoveryCode,
  makeSalt,
  recordFailure,
  recordSuccess,
  type Lockout,
} from "../../src/core/parentLock";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("pinFormat", () => {
  expect(isValidPin("1234")).toBe(true);
  expect(isValidPin("123")).toBe(false);
  expect(isValidPin("12a4")).toBe(false);
  expect(isValidPin("12345")).toBe(false);
  expect(isValidPin("１２３４")).toBe(false);
  expect(isValidPin("١٢٣٤")).toBe(false);
  expect(isValidPin("")).toBe(false);
  expect(isValidPin("1234\n")).toBe(false);
});

test("hashIsDeterministicPerSalt", async () => {
  const s1 = "010203";
  const s2 = "040506";
  const h = await hashSecret("1234", s1);
  expect(h).toBe(await hashSecret("1234", s1));
  expect(h).not.toBe(await hashSecret("1234", s2));
  expect(h).not.toBe(await hashSecret("1235", s1));
  expect(h).toHaveLength(64);
  expect(h).toBe(h.toLowerCase());
  expect(await hashSecret("", "")).toBe(
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

test("hashKnownVector", async () => {
  expect(await hashSecret("abc", "")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("hashWithoutSubtleThrowsSecureContextError", async () => {
  vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
  await expect(hashSecret("1234", "00")).rejects.toBeInstanceOf(SecureContextError);
  await expect(hashSecret("1234", "00")).rejects.toThrow(SECURE_CONTEXT_MESSAGE);
  vi.unstubAllGlobals();
  expect(await hashSecret("abc", "")).toHaveLength(64);
});

test("makeSaltIs16RandomBytes", () => {
  const a = makeSalt();
  expect(a).toMatch(/^[0-9a-f]{32}$/);
  expect(a).not.toBe(makeSalt());
});

test("recoveryCodeFormat", () => {
  for (let i = 0; i < 200; i++) expect(isValidRecoveryCode(makeRecoveryCode())).toBe(true);
  expect(isValidRecoveryCode("1234567")).toBe(false);
  expect(isValidRecoveryCode("1234567a")).toBe(false);
  expect(isValidRecoveryCode("123456789")).toBe(false);
  expect(isValidRecoveryCode("１２３４５６７８")).toBe(false);
});

test("recoveryCodeKeepsLeadingZerosAndRejectsBiasedSamples", () => {
  const samples = [0xffffffff, 4294967295, 5, 12345678];
  let i = 0;
  vi.stubGlobal("crypto", {
    getRandomValues: (arr: Uint32Array) => {
      arr[0] = samples[i++] ?? 0;
      return arr;
    },
  });
  // first two samples are >= 4294967295 limit region (rejected); 5 -> "00000005"
  expect(makeRecoveryCode()).toBe("00000005");
});

test("locksOnFifthFailure", () => {
  const now = 1_000_000;
  let l: Lockout = EMPTY_LOCKOUT;
  for (let i = 0; i < 4; i++) l = recordFailure(l, now);
  expect(isLocked(l, now)).toBe(false);
  l = recordFailure(l, now);
  expect(isLocked(l, now)).toBe(true);
  expect(l.failures).toBe(0);
  expect(l.lockedUntil).toBe(now + 60_000);
  expect(isLocked(l, now + 59_000)).toBe(true);
  expect(isLocked(l, now + 60_000)).toBe(false);
});

test("successResetsFailures", () => {
  const now = 1_000_000;
  let l: Lockout = EMPTY_LOCKOUT;
  for (let i = 0; i < 4; i++) l = recordFailure(l, now);
  l = recordSuccess();
  l = recordFailure(l, now);
  expect(isLocked(l, now)).toBe(false);
  expect(l.failures).toBe(1);
});

test("successClearsLock", () => {
  const now = 1_000_000;
  let l: Lockout = EMPTY_LOCKOUT;
  for (let i = 0; i < 5; i++) l = recordFailure(l, now);
  l = recordSuccess();
  expect(l.lockedUntil).toBeNull();
  expect(isLocked(l, now)).toBe(false);
});

test("failureWhileLockedDoesNotExtendLock", () => {
  const now = 1_000_000;
  let l: Lockout = EMPTY_LOCKOUT;
  for (let i = 0; i < 5; i++) l = recordFailure(l, now);
  const until = l.lockedUntil;
  for (let i = 0; i < 5; i++) l = recordFailure(l, now + 30_000);
  expect(l.lockedUntil).toBe(until);
  expect(l.failures).toBe(0);
});

test("lockoutIsPure", () => {
  const l: Lockout = { failures: 2, lockedUntil: null };
  const next = recordFailure(l, 0);
  expect(l.failures).toBe(2);
  expect(next.failures).toBe(3);
});

test("parentGateConstants", () => {
  expect(IDLE_TIMEOUT_MS).toBe(120000);
});
