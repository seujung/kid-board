import type { SoundVolume } from "../../store/schema";
import { audioContext, ensureRunning } from "./audio";
import { VOLUME_GAIN } from "./policy";
import type { SoundKind } from "./policy";

/** 음 하나입니다. 시각은 소리를 시작한 때부터 초 단위입니다. */
export interface Tone {
  frequency: number;
  start: number;
  duration: number;
  /** 최고 세기입니다. 겹치는 음의 합이 1보다 작아야 합니다(VOLUME_GAIN.high를 곱한 뒤에도). */
  peak: number;
  type: OscillatorType;
  /** 올라간 뒤 이 시간 동안 조금씩 줄다가 끝까지 사라집니다. 없으면 바로 사라지기 시작합니다. */
  hold?: number;
}

/** "띵": E6과 한 옥타브 위 배음을 짧게 울립니다. 약 0.3초입니다. */
export const CHIME_TONES: Tone[] = [
  { frequency: 1318.51, start: 0, duration: 0.3, peak: 0.55, type: "sine" },
  { frequency: 2637.02, start: 0, duration: 0.16, peak: 0.18, type: "sine" },
];

const ARP_STEP = 0.15;
const ARP_DURATION = 0.22;
const CHORD_AT = 0.72;
const CHORD_DURATION = 1.28;

/** 빵빠레: G4-C5-E5-G5로 올라간 뒤 C 장조 화음을 길게 울립니다. 약 2초입니다. */
export const FANFARE_TONES: Tone[] = [
  { frequency: 392, start: 0, duration: ARP_DURATION, peak: 0.32, type: "triangle" },
  { frequency: 523.25, start: ARP_STEP, duration: ARP_DURATION, peak: 0.32, type: "triangle" },
  { frequency: 659.25, start: ARP_STEP * 2, duration: ARP_DURATION, peak: 0.32, type: "triangle" },
  { frequency: 783.99, start: ARP_STEP * 3, duration: ARP_DURATION, peak: 0.34, type: "triangle" },
  { frequency: 523.25, start: CHORD_AT, duration: CHORD_DURATION, peak: 0.2, type: "triangle", hold: 0.7 },
  { frequency: 659.25, start: CHORD_AT, duration: CHORD_DURATION, peak: 0.18, type: "triangle", hold: 0.7 },
  { frequency: 783.99, start: CHORD_AT, duration: CHORD_DURATION, peak: 0.18, type: "triangle", hold: 0.7 },
  { frequency: 1046.5, start: CHORD_AT, duration: CHORD_DURATION, peak: 0.2, type: "triangle", hold: 0.7 },
];

const SILENT = 0.0001;
const ATTACK = 0.012;
/** 지금 바로가 아니라 조금 뒤에 시작해야 첫 음 앞부분이 잘리지 않습니다. */
const LEAD = 0.02;

/** 음 목록을 `gain` 세기로 예약합니다. 음마다 오실레이터와 envelope 게인을 하나씩 만듭니다. */
export function scheduleTones(ctx: AudioContext, tones: Tone[], gain: number): void {
  const t0 = ctx.currentTime + LEAD;
  const master = ctx.createGain();
  master.gain.value = gain;
  master.connect(ctx.destination);
  for (const tone of tones) {
    const at = t0 + tone.start;
    const end = at + tone.duration;
    const env = ctx.createGain();
    env.gain.setValueAtTime(SILENT, at);
    env.gain.linearRampToValueAtTime(tone.peak, at + ATTACK);
    if (tone.hold) env.gain.linearRampToValueAtTime(tone.peak * 0.75, at + tone.hold);
    env.gain.exponentialRampToValueAtTime(SILENT, end);
    env.connect(master);
    const osc = ctx.createOscillator();
    osc.type = tone.type;
    osc.frequency.value = tone.frequency;
    osc.connect(env);
    osc.start(at);
    osc.stop(end + 0.02);
  }
}

function play(tones: Tone[], volume: SoundVolume): void {
  const ctx = audioContext();
  if (!ctx) return;
  ensureRunning(ctx);
  try {
    scheduleTones(ctx, tones, VOLUME_GAIN[volume]);
  } catch (err) {
    console.warn("sound was not played", err);
  }
}

export function playChime(volume: SoundVolume): void {
  play(CHIME_TONES, volume);
}

export function playFanfare(volume: SoundVolume): void {
  play(FANFARE_TONES, volume);
}

export function playSound(kind: SoundKind, volume: SoundVolume): void {
  if (kind === "chime") playChime(volume);
  else if (kind === "fanfare") playFanfare(volume);
}
