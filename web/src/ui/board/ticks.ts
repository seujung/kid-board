import { useEffect, useState } from "preact/hooks";
import type { Clock } from "../../clock";

/**
 * 시계가 `unitMs`(1초 또는 1분) 경계를 지날 때마다 다시 그리게 합니다.
 * 타이머는 항상 하나이고, 매번 다음 경계에 맞춰 다시 겁니다.
 * 돌려주는 값은 마지막 경계 시각(epoch ms)입니다.
 */
export function useBoundaryTick(clock: Clock, unitMs: number): number {
  const floor = () => Math.floor(clock.now().getTime() / unitMs) * unitMs;
  const [tick, setTick] = useState(floor);
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const now = clock.now().getTime();
      const wait = unitMs - (now % unitMs) + 5;
      timer = window.setTimeout(() => {
        setTick(floor());
        schedule();
      }, wait);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [clock, unitMs]);
  return tick;
}

export const SECOND_MS = 1000;
export const MINUTE_MS = 60_000;
