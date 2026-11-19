import type { SoundVolume } from "../../store/schema";

export type SoundKind = "none" | "chime" | "fanfare";

/** 볼륨 단계별 master 게인입니다. 음 세기의 합이 1보다 작도록 sounds.ts가 맞춥니다. */
export const VOLUME_GAIN: Record<SoundVolume, number> = { low: 0.25, medium: 0.5, high: 0.9 };

/** 이 완료로 이번 시간대의 보이는 할 일을 모두 끝냈는지입니다. 참이면 2초 축하를 시작합니다. */
export function completesPhase(nextDone: boolean, remaining: number, phaseTotal: number): boolean {
  return nextDone && remaining === 0 && phaseTotal > 0;
}

export interface SoundInput {
  /** 누르기 전에 끝낸 할 일이었는지입니다. */
  prevDone: boolean;
  /** 누른 뒤(메모리에 반영된 뒤) 끝낸 할 일인지입니다. */
  nextDone: boolean;
  /** 누른 뒤 이번 시간대에 남은 할 일 수입니다. */
  remaining: number;
  /** 이번 시간대에 보이는 할 일 수입니다. */
  phaseTotal: number;
  /** 화면 끄기 시간인지입니다. */
  dimmed: boolean;
  /** 부모 모드의 "소리 켜기"입니다. */
  enabled: boolean;
}

/**
 * 할 일 카드를 누른 결과로 낼 소리입니다.
 * 안 한 일을 끝내면 "띵", 그 완료로 시간대를 모두 끝내면 "띵" 대신 빵빠레입니다. 취소와 흔들림은 소리가 없습니다.
 */
export function soundFor(input: SoundInput): SoundKind {
  if (!input.enabled || input.dimmed) return "none";
  if (input.prevDone || !input.nextDone) return "none";
  return completesPhase(input.nextDone, input.remaining, input.phaseTotal) ? "fanfare" : "chime";
}
