import { useEffect, useState } from "preact/hooks";
import type { BoardStore } from "../../store/boardStore";
import { ErrorLine, errorText } from "./common";
import { RecoveryCodeShow } from "./RecoveryCodeShow";
import type { IdleHold } from "./useIdle";

/** 복구 코드 새로 만들기입니다. 새 코드를 한 번 보여 주고, 이전 코드는 쓸 수 없게 됩니다. */
export function RecoveryRegenerate(props: { store: BoardStore; onDone: () => void; onHold?: IdleHold }) {
  const { store, onDone, onHold } = props;
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 새 코드를 보여 주는 동안("적어 두었어요"를 누를 때까지) 부모 모드 타이머를 멈춥니다.
  useEffect(() => {
    if (!code || !onHold) return;
    onHold("code", true);
    return () => onHold("code", false);
  }, [code]);
  if (code) return <RecoveryCodeShow code={code} onDone={onDone} />;
  const make = () => {
    setBusy(true);
    setError(null);
    store.regenerateRecoveryCode().then(
      (c) => {
        setBusy(false);
        setCode(c);
      },
      (err: unknown) => {
        setBusy(false);
        setError(errorText(err));
      },
    );
  };
  return (
    <div class="p-center">
      <div class="pin-title">새 복구 코드를 만들까요?</div>
      <div class="recovery-note">지금 쓰는 복구 코드는 더 이상 쓸 수 없게 돼요.</div>
      <ErrorLine text={error} />
      <button type="button" class="p-button primary big" disabled={busy} onClick={make}>
        새로 만들기
      </button>
    </div>
  );
}
