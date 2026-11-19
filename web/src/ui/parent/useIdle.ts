import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";

/** 부모 모드 안의 입력으로 보는 이벤트입니다. 스크롤은 버블링되지 않으므로 캡처 단계에서 받습니다. */
const ACTIVITY_EVENTS = ["pointerdown", "touchstart", "keydown", "input", "change", "wheel", "scroll"];

/**
 * `root` 안에서 `ms` 동안 입력이 없으면 `onIdle`을 한 번 부릅니다. 입력이 있을 때마다 다시 셉니다.
 * touchstart를 듣고 있으므로 iOS Safari에서 `:active` 눌림 표시도 켜집니다.
 */
export function useIdle(root: RefObject<HTMLElement | null>, ms: number, onIdle: () => void): void {
  const callback = useRef(onIdle);
  callback.current = onIdle;
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let timer = 0;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback.current(), ms);
    };
    const options: AddEventListenerOptions = { capture: true, passive: true };
    ACTIVITY_EVENTS.forEach((name) => el.addEventListener(name, reset, options));
    reset();
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => el.removeEventListener(name, reset, options));
    };
  }, [root, ms]);
}
