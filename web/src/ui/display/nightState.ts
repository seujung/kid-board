import { NIGHT_WAKE_MS, isNightMode } from "../../core/displayPolicy";

export interface NightState {
  /** 검은 막을 덮었는지입니다. */
  dimmed: boolean;
  /** 터치로 깨운 보드를 다시 어둡게 할 시각(epoch ms)입니다. 깨우지 않았으면 null입니다. */
  wakeUntil: number | null;
}

/**
 * 야간 막의 다음 상태입니다(웹 설계 6.6).
 * - 야간 모드 시간이 아니거나 부모 모드가 열려 있으면 어둡게 하지 않습니다.
 * - 야간에 터치하면 그 시각부터 30초 동안 보드를 표시합니다. 표시 중 터치는 30초를 다시 셉니다.
 */
export function nightState(prev: { wakeUntil: number | null }, now: Date, touched: boolean, parentOpen: boolean): NightState {
  if (parentOpen || !isNightMode(now)) return { dimmed: false, wakeUntil: null };
  const t = now.getTime();
  if (touched) return { dimmed: false, wakeUntil: t + NIGHT_WAKE_MS };
  if (prev.wakeUntil !== null && t < prev.wakeUntil) return { dimmed: false, wakeUntil: prev.wakeUntil };
  return { dimmed: true, wakeUntil: null };
}
