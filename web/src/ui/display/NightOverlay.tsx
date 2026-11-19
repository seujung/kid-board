import { useEffect, useState } from "preact/hooks";
import type { Clock } from "../../clock";
import { formatClock } from "../board/theme";
import { MINUTE_MS, useBoundaryTick } from "../board/ticks";
import { nightState } from "./nightState";

export { nightState } from "./nightState";

const WAKE_EVENTS = ["pointerdown", "touchstart"] as const;

/**
 * 22:00~06:00에 보드 위에 덮는 검은 막입니다(웹 설계 6.6).
 * 막을 누르면 보드를 30초 동안 표시합니다. 이 터치는 막만 받고 할 일 카드로 전달하지 않습니다.
 * 보드를 표시하는 동안 화면 어디든 누르면 30초를 다시 셉니다.
 */
export function NightOverlay({ clock, parentOpen }: { clock: Clock; parentOpen: boolean }) {
  // 1분 경계마다 시계와 야간 시간 여부를 다시 계산합니다.
  useBoundaryTick(clock, MINUTE_MS);
  const [wakeUntil, setWakeUntil] = useState<number | null>(null);
  const [, setExpired] = useState(0);
  const state = nightState({ wakeUntil }, clock.now(), false, parentOpen);

  // 깨운 시간이 끝나면 다시 그려서 막을 덮습니다.
  useEffect(() => {
    if (state.wakeUntil === null) return;
    const timer = window.setTimeout(() => setExpired((n) => n + 1), state.wakeUntil - clock.now().getTime() + 5);
    return () => window.clearTimeout(timer);
  }, [clock, state.wakeUntil]);

  // 보드를 표시하는 동안의 터치는 깨운 시간을 늘립니다. 보드는 평소처럼 쓸 수 있습니다.
  const woken = state.wakeUntil !== null;
  useEffect(() => {
    if (!woken) return;
    const extend = () => setWakeUntil((prev) => nightState({ wakeUntil: prev }, clock.now(), true, false).wakeUntil);
    for (const type of WAKE_EVENTS) window.addEventListener(type, extend, { capture: true, passive: true });
    return () => {
      for (const type of WAKE_EVENTS) window.removeEventListener(type, extend, { capture: true });
    };
  }, [clock, woken]);

  if (!state.dimmed) return null;
  return (
    <div
      class="night-overlay"
      // 누르기가 끝난 뒤(click)에 막을 걷습니다. 그래서 같은 터치가 아래 카드로 가지 않습니다.
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setWakeUntil(nightState({ wakeUntil: null }, clock.now(), true, parentOpen).wakeUntil);
      }}
    >
      <div class="night-clock">{formatClock(clock.now()).slice(0, 5)}</div>
    </div>
  );
}
