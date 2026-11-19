import { parseBackup } from "../../store/backup";
import type { AppDoc } from "../../store/schema";

/** 백업에서 복원할 파일을 고르는 입력 칸의 id입니다. 백업 화면의 "백업에서 복원" label이 이 칸을 가리킵니다. */
export const RESTORE_INPUT_ID = "restore-file";

/** 고른 백업 파일을 읽은 결과입니다. */
export type RestorePick = { kind: "doc"; doc: AppDoc } | { kind: "error"; message: string };

/** 텍스트 파일을 읽습니다. iPadOS 15 Safari에서도 되는 FileReader를 씁니다. */
function readText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export async function readRestoreFile(file: Blob): Promise<RestorePick> {
  let text: string;
  try {
    text = await readText(file);
  } catch {
    return { kind: "error", message: "백업 파일을 읽을 수 없어요" };
  }
  const parsed = parseBackup(text);
  return parsed.ok ? { kind: "doc", doc: parsed.doc } : { kind: "error", message: parsed.message };
}

/**
 * 복원할 파일을 고르는 입력 칸입니다. 부모 모드 밖(앱 최상위)에 둡니다.
 * 파일 선택 화면이 열린 동안 부모 모드가 닫혀도 고른 파일을 잃지 않고 `onPick`으로 넘깁니다.
 */
export function RestoreInput({ onPick }: { onPick: (pick: RestorePick) => void }) {
  return (
    <input
      id={RESTORE_INPUT_ID}
      class="p-file restore-input"
      type="file"
      accept="application/json,.json"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const el = e.currentTarget as HTMLInputElement;
        const file = el.files?.[0];
        el.value = "";
        if (file) void readRestoreFile(file).then(onPick);
      }}
    />
  );
}
