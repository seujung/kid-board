import { useState } from "preact/hooks";
import type { Clock } from "../../clock";
import { exportBackup, parseBackup } from "../../store/backup";
import type { AppDoc } from "../../store/schema";
import type { BoardStore } from "../../store/boardStore";
import { Confirm, ErrorLine, errorText } from "./common";
import { shareBackup } from "./shareBackup";

export const SHARE_GUIDE = "공유 화면에서 '파일에 저장' > iCloud Drive를 고르세요.";
export const GUIDED_ACCESS_GUIDE = "백업·복원 전에 홈 버튼을 세 번 눌러 사용법 유도 접근을 잠시 끄십시오.";
export const RESTORE_CONFIRM = "지금 데이터를 백업 내용으로 바꿀까요?";

function lastBackupText(ms: number | null): string {
  if (ms === null) return "아직 백업하지 않았어요";
  const d = new Date(ms);
  return `마지막 백업: ${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 텍스트 파일을 읽습니다. iPadOS 15 Safari에서도 되는 FileReader를 씁니다. */
function readText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** 백업 파일 저장과 백업에서 복원입니다(웹 설계 6.5). */
export function BackupPanel({ store, clock }: { store: BoardStore; clock: Clock }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AppDoc | null>(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    setMessage(null);
    setError(null);
    // 공유 시트는 누른 순간에 열어야 하므로 먼저 기다리지 않습니다.
    const file = exportBackup(store.doc(), clock.now());
    shareBackup(file, navigator, document)
      .then(async (result) => {
        if (result === "cancelled") return;
        await store.markBackedUp();
        setMessage(result === "shared" ? "백업 파일을 보냈어요" : "백업 파일을 내려받았어요");
      })
      .catch((err: unknown) => setError(errorText(err)));
  };

  const pick = (e: Event) => {
    const el = e.currentTarget as HTMLInputElement;
    const file = el.files?.[0];
    el.value = "";
    if (!file) return;
    setMessage(null);
    setError(null);
    readText(file).then(
      (text) => {
        const parsed = parseBackup(text);
        if (parsed.ok) setPending(parsed.doc);
        else setError(parsed.message);
      },
      () => setError("백업 파일을 읽을 수 없어요"),
    );
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
        {/* iOS Safari에서 가장 확실하게 파일 선택을 여는 방법은 입력 칸을 감싼 label입니다. */}
        <label class={busy ? "p-button big backup-restore disabled" : "p-button big backup-restore"}>
          백업에서 복원
          <input
            class="p-file"
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={pick}
          />
        </label>
      </div>
      <div class="p-footnote">PIN과 복구 코드는 백업에 넣지 않아요. 복원해도 지금 PIN을 그대로 써요.</div>
      {pending && (
        <Confirm title={RESTORE_CONFIRM} confirmLabel="바꾸기" danger onCancel={() => setPending(null)} onConfirm={restore} />
      )}
    </div>
  );
}
