import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";

/** 부모 모드 안의 입력으로 보는 이벤트입니다. 스크롤은 버블링되지 않으므로 캡처 단계에서 받습니다. */
const ACTIVITY_EVENTS = ["pointerdown", "touchstart", "keydown", "input", "change", "wheel", "scroll"];

/**
 * 시스템 화면(공유 시트, 파일 선택)이 열려 있는 동안 멈춘 타이머를 이 시간이 지나면 다시 셉니다.
 * iOS는 파일 선택을 취소해도 알려 주지 않으므로 상한을 둡니다.
 */
export const SYSTEM_SHEET_HOLD_CAP_MS = 600_000;

/** 부모 모드의 타이머를 잠시 멈춥니다. `key`마다 켜고 끕니다. */
export type IdleHold = (key: string, on: boolean) => void;

/**
 * `root` 안에서 `ms` 동안 입력이 없으면 `onIdle`을 한 번 부릅니다. 입력이 있을 때마다 다시 셉니다.
 * `paused`가 참인 동안에는 세지 않습니다. 다시 거짓이 되면 처음부터 셉니다.
 * touchstart를 듣고 있으므로 iOS Safari에서 `:active` 눌림 표시도 켜집니다.
 */
export function useIdle(root: RefObject<HTMLElement | null>, ms: number, onIdle: () => void, paused = false): void {
  const callback = useRef(onIdle);
  callback.current = onIdle;
  useEffect(() => {
    const el = root.current;
    if (!el || paused) return;
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
  }, [root, ms, paused]);
}
