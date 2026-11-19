import { formatRecoveryCode } from "./format";

export const RECOVERY_CODE_NOTE = "이 복구 코드를 따로 적어 두세요. 다시 보여 드리지 않아요.";

/** 새 복구 코드를 한 번만 보여 줍니다. "적어 두었어요"를 눌러야 넘어갑니다. */
export function RecoveryCodeShow({ code, onDone }: { code: string; onDone: () => void }) {
  return (
    <div class="p-center">
      <div class="pin-title">복구 코드</div>
      <div class="recovery-code">{formatRecoveryCode(code)}</div>
      <div class="recovery-note">{RECOVERY_CODE_NOTE}</div>
      <button type="button" class="p-button primary big" onClick={onDone}>
        적어 두었어요
      </button>
    </div>
  );
}
