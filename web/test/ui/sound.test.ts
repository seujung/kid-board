import { expect, test } from "vitest";
import { VOLUME_GAIN, completesPhase, soundFor } from "../../src/ui/sound/policy";
import { CHIME_TONES, FANFARE_TONES, scheduleTones } from "../../src/ui/sound/sounds";
import type { Tone } from "../../src/ui/sound/sounds";

const base = { prevDone: false, nextDone: true, remaining: 2, phaseTotal: 5, dimmed: false, enabled: true };

test("completingOneTaskChimes", () => {
  expect(soundFor(base)).toBe("chime");
});

test("completingTheLastTaskPlaysFanfareInsteadOfChime", () => {
  expect(soundFor({ ...base, remaining: 0 })).toBe("fanfare");
  expect(soundFor({ ...base, remaining: 0, phaseTotal: 1 })).toBe("fanfare");
});

test("undoIsSilent", () => {
  expect(soundFor({ ...base, prevDone: true, nextDone: false })).toBe("none");
  expect(soundFor({ ...base, prevDone: true, nextDone: false, remaining: 1 })).toBe("none");
});

test("tapThatChangesNothingIsSilent", () => {
  // 흔들리기만 하거나 저장소가 받아들이지 않은 누름입니다.
  expect(soundFor({ ...base, nextDone: false })).toBe("none");
  expect(soundFor({ ...base, prevDone: true, nextDone: true, remaining: 0 })).toBe("none");
});

test("dimmedOrDisabledIsSilent", () => {
  expect(soundFor({ ...base, dimmed: true })).toBe("none");
  expect(soundFor({ ...base, remaining: 0, dimmed: true })).toBe("none");
  expect(soundFor({ ...base, enabled: false })).toBe("none");
  expect(soundFor({ ...base, remaining: 0, enabled: false })).toBe("none");
});

test("completesPhaseMatchesCelebrationRule", () => {
  expect(completesPhase(true, 0, 3)).toBe(true);
  expect(completesPhase(true, 1, 3)).toBe(false);
  expect(completesPhase(false, 0, 3)).toBe(false);
  expect(completesPhase(true, 0, 0)).toBe(false);
});

test("volumeGainMapping", () => {
  expect(VOLUME_GAIN).toEqual({ low: 0.25, medium: 0.5, high: 0.9 });
});

/** 어느 순간이든 겹쳐 울리는 음의 최대 세기 합입니다(위쪽 어림값). */
function maxOverlap(tones: Tone[]): number {
  let max = 0;
  for (const t of tones) {
    let sum = 0;
    for (const u of tones) if (u.start <= t.start && t.start < u.start + u.duration) sum += u.peak;
    if (sum > max) max = sum;
  }
  return max;
}

function length(tones: Tone[]): number {
  let end = 0;
  for (const t of tones) end = Math.max(end, t.start + t.duration);
  return end;
}

test("chimeIsShortAndBelowClipping", () => {
  expect(length(CHIME_TONES)).toBeGreaterThanOrEqual(0.25);
  expect(length(CHIME_TONES)).toBeLessThanOrEqual(0.4);
  expect(maxOverlap(CHIME_TONES) * VOLUME_GAIN.high).toBeLessThan(1);
});

test("fanfareIsAboutTwoSecondsRisingThenChordBelowClipping", () => {
  expect(length(FANFARE_TONES)).toBeGreaterThanOrEqual(1.8);
  expect(length(FANFARE_TONES)).toBeLessThanOrEqual(2.2);
  expect(maxOverlap(FANFARE_TONES) * VOLUME_GAIN.high).toBeLessThan(1);
  const last = Math.max(...FANFARE_TONES.map((t) => t.start));
  const chord = FANFARE_TONES.filter((t) => t.start === last);
  expect(chord.length).toBeGreaterThanOrEqual(3);
  const arpeggio = FANFARE_TONES.filter((t) => t.start < last).sort((a, b) => a.start - b.start);
  expect(arpeggio.length).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < arpeggio.length; i++) expect(arpeggio[i]!.frequency).toBeGreaterThan(arpeggio[i - 1]!.frequency);
});

test("chimeAndFanfareUseDistinctMarkerNotes", () => {
  // Playwright가 이 두 음으로 어떤 소리를 요청했는지 셉니다.
  const chime = CHIME_TONES.map((t) => t.frequency);
  const fanfare = FANFARE_TONES.map((t) => t.frequency);
  expect(chime).toContain(1318.51);
  expect(fanfare).not.toContain(1318.51);
  expect(fanfare.filter((f) => f === 392)).toHaveLength(1);
  expect(chime).not.toContain(392);
});

class FakeParam {
  value = 0;
  events: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) {
    this.events.push(["set", v, t]);
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(["linear", v, t]);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    expect(v).toBeGreaterThan(0);
    this.events.push(["exp", v, t]);
  }
}

class FakeNode {
  connected: unknown[] = [];
  connect(n: unknown) {
    this.connected.push(n);
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeOsc extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  started: number | null = null;
  stopped: number | null = null;
  start(t: number) {
    this.started = t;
  }
  stop(t: number) {
    this.stopped = t;
  }
}

test("scheduleTonesBuildsOneOscillatorPerToneThroughAMasterGain", () => {
  const gains: FakeGain[] = [];
  const oscs: FakeOsc[] = [];
  const destination = {};
  const ctx = {
    currentTime: 10,
    destination,
    createGain: () => {
      const g = new FakeGain();
      gains.push(g);
      return g;
    },
    createOscillator: () => {
      const o = new FakeOsc();
      oscs.push(o);
      return o;
    },
  };
  scheduleTones(ctx as unknown as AudioContext, CHIME_TONES, 0.25);
  const master = gains[0]!;
  expect(master.gain.value).toBe(0.25);
  expect(master.connected).toEqual([destination]);
  expect(oscs.map((o) => o.frequency.value)).toEqual(CHIME_TONES.map((t) => t.frequency));
  for (const o of oscs) {
    expect(o.started).toBeGreaterThanOrEqual(10);
    expect(o.stopped).toBeGreaterThan(o.started as number);
  }
  // 음마다 envelope 게인을 거쳐 master로 갑니다.
  for (const g of gains.slice(1)) expect(g.connected).toEqual([master]);
});
