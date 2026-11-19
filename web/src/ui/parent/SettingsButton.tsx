import { useEffect, useRef, useState } from "preact/hooks";
import { LONG_PRESS_MS } from "../../core/parentLock";

/**
 * 보드 오른쪽 위의 설정 아이콘입니다. 18px 회색 아이콘, 누름 영역 44px입니다.
 * `LONG_PRESS_MS`(3초) 동안 계속 누르고 있어야 `onLongPress`를 부릅니다.
 * 손을 떼거나, 취소되거나, 버튼 밖으로 나가면 처음부터 다시 셉니다.
 * 포인터 이벤트를 쓰고, 없으면 터치·마우스 이벤트를 씁니다.
 */
export function SettingsButton({ onLongPress }: { onLongPress: () => void }) {
  const timer = useRef(0);
  const callback = useRef(onLongPress);
  callback.current = onLongPress;
  const [pressed, setPressed] = useState(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
    setPressed(false);
  };
  const start = () => {
    window.clearTimeout(timer.current);
    setPressed(true);
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      setPressed(false);
      callback.current();
    }, LONG_PRESS_MS);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pointer = typeof window !== "undefined" && "PointerEvent" in window;
  const handlers = pointer
    ? {
        onPointerDown: (e: PointerEvent) => {
          if (e.button > 0) return;
          start();
        },
        onPointerUp: cancel,
        onPointerCancel: cancel,
        onPointerLeave: cancel,
      }
    : {
        onTouchStart: start,
        onTouchEnd: cancel,
        onTouchCancel: cancel,
        onMouseDown: start,
        onMouseUp: cancel,
        onMouseLeave: cancel,
      };

  return (
    <button
      type="button"
      class={pressed ? "settings-button pressed" : "settings-button"}
      aria-label="설정 (3초 동안 누르기)"
      onContextMenu={(e) => e.preventDefault()}
      {...handlers}
    >
      <svg class="settings-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19.14 12.94a7.07 7.07 0 0 0 .06-.94 7.07 7.07 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7.03 7.03 0 0 0-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.67 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0-.06.94c0 .32.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54a7.03 7.03 0 0 0 1.62-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"
        />
      </svg>
    </button>
  );
}
