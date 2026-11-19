import { useEffect, useRef, useState } from "preact/hooks";
import type { Clock } from "../../clock";
import { exportBackup } from "../../store/backup";
import type { AppDoc } from "../../store/schema";
import type { BoardStore } from "../../store/boardStore";
import { Confirm, ErrorLine, errorText } from "./common";
import { RESTORE_INPUT_ID } from "./restorePick";
import type { RestorePick } from "./restorePick";
import { shareBackup } from "./shareBackup";
import { SYSTEM_SHEET_HOLD_CAP_MS } from "./useIdle";
import type { IdleHold } from "./useIdle";

export const SHARE_GUIDE = "공유 화면에서 '파일에 저장' > iCloud Drive를 고르세요.";
export const GUIDED_ACCESS_GUIDE = "백업·복원 전에 홈 버튼을 세 번 눌러 사용법 유도 접근을 잠시 끄십시오.";
export const RESTORE_CONFIRM = "지금 데이터를 백업 내용으로 바꿀까요?";

function lastBackupText(ms: number | null): string {
  if (ms === null) return "아직 백업하지 않았어요";
  const d = new Date(ms);
  return `마지막 백업: ${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 시스템 화면이 열린 동안 부모 모드 타이머를 멈춥니다. `stop`을 부르거나 상한 시간이 지나거나 화면이 사라지면 풉니다.
 * `start`는 풀 때 정리할 함수를 받을 수 있습니다.
 */
function useSheetHold(onHold: IdleHold | undefined, key: string) {
  const cleanup = useRef<(() => void) | null>(null);
  const stop = () => {
    const fn = cleanup.current;
    cleanup.current = null;
    if (fn) fn();
  };
  const start = (extra?: () => void) => {
    stop();
    if (!onHold) return;
    onHold(key, true);
    const cap = window.setTimeout(stop, SYSTEM_SHEET_HOLD_CAP_MS);
    cleanup.current = () => {
      window.clearTimeout(cap);
      if (extra) extra();
      onHold(key, false);
    };
  };
  useEffect(() => stop, []);
  return { start, stop };
}

/** 백업 파일 저장과 백업에서 복원입니다(웹 설계 6.5). */
export interface BackupPanelProps {
  store: BoardStore;
  clock: Clock;
  /** 공유 시트와 파일 선택이 열린 동안 부모 모드 타이머를 멈춥니다. */
  onHold?: IdleHold;
  /** 앱 최상위의 복원 입력 칸에서 고른 파일입니다. 받으면 확인 창이나 오류를 보이고 `onPickHandled`를 부릅니다. */
  restorePick?: RestorePick | null;
  onPickHandled?: () => void;
}

export function BackupPanel({ store, clock, onHold, restorePick, onPickHandled }: BackupPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AppDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const shareHold = useSheetHold(onHold, "share");
  const pickerHold = useSheetHold(onHold, "picker");

  useEffect(() => {
    if (!restorePick) return;
    pickerHold.stop();
    setMessage(null);
    if (restorePick.kind === "doc") {
      setError(null);
      setPending(restorePick.doc);
    } else {
      setError(restorePick.message);
    }
    onPickHandled?.();
  }, [restorePick]);

  const save = () => {
    setMessage(null);
    setError(null);
    // 공유 시트는 누른 순간에 열어야 하므로 먼저 기다리지 않습니다.
    const file = exportBackup(store.doc(), clock.now());
    shareHold.start();
    shareBackup(file, navigator, document)
      .then(async (result) => {
        shareHold.stop();
        if (result === "cancelled") return;
        await store.markBackedUp();
        setMessage(result === "shared" ? "백업 파일을 보냈어요" : "백업 파일을 내려받았어요");
      })
      .catch((err: unknown) => {
        shareHold.stop();
        setError(errorText(err));
      });
  };

  /** 파일 선택이 열리는 탭입니다. 파일을 고르거나, 앱으로 돌아오거나(focus, visibilitychange), 10분이 지나면 타이머를 다시 셉니다. */
  const openPicker = (e: Event) => {
    if (busy) {
      e.preventDefault();
      return;
    }
    const resume = () => pickerHold.stop();
    const onVisible = () => {
      if (document.visibilityState === "visible") resume();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", onVisible);
    pickerHold.start(() => {
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", onVisible);
    });
  };

  const restore = () => {
    const doc = pending;
    setPending(null);
    if (!doc) return;
    setBusy(true);
    store.restore(doc).then(
      () => {
        setBusy(false);
        setMessage("백업 내용으로 바꿨어요");
      },
      (err: unknown) => {
        setBusy(false);
        setError(errorText(err));
      },
    );
  };

  return (
    <div class="p-section">
      <div class="p-guide">
        <div>{SHARE_GUIDE}</div>
        <div>{GUIDED_ACCESS_GUIDE}</div>
      </div>
      <div class="p-current">{lastBackupText(store.settings().lastBackupAt)}</div>
      <ErrorLine text={error} />
      {message && (
        <div class="p-ok" role="status">
          {message}
        </div>
      )}
      <div class="p-button-row">
        <button type="button" class="p-button primary big backup-save" disabled={busy} onClick={save}>
          백업 파일 저장
        </button>
        {/* iOS Safari에서 파일 선택을 여는 방법은 입력 칸을 가리키는 label입니다. 입력 칸은 앱 최상위(RestoreInput)에 있습니다. */}
        <label
          for={RESTORE_INPUT_ID}
          class={busy ? "p-button big backup-restore disabled" : "p-button big backup-restore"}
          onClick={openPicker}
        >
          백업에서 복원
        </label>
      </div>
      <div class="p-footnote">PIN과 복구 코드는 백업에 넣지 않아요. 복원해도 지금 PIN을 그대로 써요.</div>
      {pending && (
        <Confirm title={RESTORE_CONFIRM} confirmLabel="바꾸기" danger onCancel={() => setPending(null)} onConfirm={restore} />
      )}
    </div>
  );
}
