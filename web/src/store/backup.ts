import { migrate } from "./schema";
import type { AppDoc } from "./schema";

export const BACKUP_ERROR_MESSAGE = "백업 파일을 읽을 수 없어요";

function pad2(n: number): string {
  return (n < 10 ? "0" : "") + String(n);
}

/** 백업 JSON을 만듭니다. PIN·복구 코드 해시와 잠금 상태는 넣지 않습니다. */
export function exportBackup(doc: AppDoc, now: Date): { fileName: string; json: string } {
  const s = doc.settings;
  const backup = {
    schemaVersion: doc.schemaVersion,
    data: doc.data,
    settings: { location: s.location, didSeed: s.didSeed, lastBackupAt: s.lastBackupAt, dimPeriods: s.dimPeriods, sound: s.sound },
    weather: doc.weather,
  };
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  return { fileName: `kid-board-backup-${stamp}.json`, json: JSON.stringify(backup, null, 2) };
}

/** 백업 파일 내용을 읽습니다. JSON이 아니거나 형식이 맞지 않거나 미래 버전이면 실패합니다. */
export function parseBackup(
  text: string,
): { ok: true; doc: AppDoc } | { ok: false; message: typeof BACKUP_ERROR_MESSAGE } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: BACKUP_ERROR_MESSAGE };
  }
  const result = migrate(raw);
  return result.ok ? { ok: true, doc: result.doc } : { ok: false, message: BACKUP_ERROR_MESSAGE };
}
