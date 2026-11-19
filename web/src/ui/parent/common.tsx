import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { ChildInfo } from "../../core/domain";
import { SECURE_CONTEXT_MESSAGE, SecureContextError } from "../../core/parentLock";
import { SAVE_ERROR_TEXT } from "../board/BoardView";

export const DICTATION_HINT = "키보드의 🎤 버튼을 누르면 말로 입력할 수 있어요.";
const NOTICE_MS = 3000;

/** 저장 실패를 화면 문구로 바꿉니다. 보안 연결이 아니면 그 안내를 씁니다. */
export function errorText(err: unknown): string {
  if (err instanceof SecureContextError || (err as { name?: unknown } | null)?.name === "SecureContextError") {
    return SECURE_CONTEXT_MESSAGE;
  }
  return SAVE_ERROR_TEXT;
}

export interface TopBarProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  onClose: () => void;
}

/** 부모 모드 화면 맨 위 막대입니다. 왼쪽은 뒤로, 오른쪽은 "보드로 돌아가기"입니다. */
export function TopBar({ title, onBack, backLabel = "부모 모드", onClose }: TopBarProps) {
  return (
    <div class="p-topbar">
      <div class="p-topbar-side">
        {onBack && (
          <button type="button" class="p-link p-back" onClick={onBack}>
            ‹ {backLabel}
          </button>
        )}
      </div>
      <div class="p-topbar-title">{title}</div>
      <div class="p-topbar-side right">
        <button type="button" class="p-link p-close" onClick={onClose}>
          보드로 돌아가기
        </button>
      </div>
    </div>
  );
}

/** 자녀가 2명 이상일 때 고르는 버튼 묶음입니다. */
export function ChildPicker(props: { kids: ChildInfo[]; selected: string; onSelect: (id: string) => void }) {
  if (props.kids.length < 2) return null;
  return (
    <div class="p-segment" role="tablist">
      {props.kids.map((c) => (
        <button
          type="button"
          key={c.id}
          role="tab"
          aria-selected={c.id === props.selected}
          class={c.id === props.selected ? "p-segment-item on" : "p-segment-item"}
          onClick={() => props.onSelect(c.id)}
        >
          {c.avatar} {c.name}
        </button>
      ))}
    </div>
  );
}

export interface ConfirmProps {
  title: string;
  body?: ComponentChildren;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 부모 모드의 확인 창입니다. */
export function Confirm(props: ConfirmProps) {
  return (
    <div class="p-scrim" onClick={props.onCancel}>
      <div class="p-dialog" role="alertdialog" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <div class="p-dialog-title">{props.title}</div>
        {props.body && <div class="p-dialog-body">{props.body}</div>}
        <div class="p-dialog-buttons">
          <button type="button" class="p-button" onClick={props.onCancel}>
            취소
          </button>
          <button
            type="button"
            class={props.danger ? "p-button danger" : "p-button primary"}
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 몇 초 동안 보였다 사라지는 알림 문구입니다. `text`가 바뀔 때마다 다시 셉니다. */
export function useNotice(): [string | null, (text: string) => void] {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = (text: string) => {
    window.clearTimeout(timer.current);
    setNotice(text);
    timer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  };
  return [notice, show];
}

export function Notice({ text }: { text: string | null }) {
  return text ? (
    <div class="p-notice" role="status">
      {text}
    </div>
  ) : null;
}

export function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <div class="p-error" role="alert">
      {text}
    </div>
  ) : null;
}
