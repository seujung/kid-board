import type { Clock } from "../../clock";
import type { BoardStore } from "../../store/boardStore";
import { SecretGate } from "./ParentGate";

/** "PIN을 잊었어요" 다음 화면입니다. 복구 코드 8자리가 맞으면 새 PIN을 정하러 갑니다. */
export function RecoveryEntry(props: { store: BoardStore; clock: Clock; onSuccess: () => void; onCancel: () => void }) {
  return (
    <SecretGate
      clock={props.clock}
      title="복구 코드를 입력해 주세요"
      subtitle="PIN을 처음 정할 때 적어 둔 8자리 숫자예요"
      length={8}
      lockout={() => props.store.settings().recoveryLockout}
      verify={(code) => props.store.verifyRecoveryCode(code)}
      wrongText="복구 코드가 맞지 않아요"
      onSuccess={props.onSuccess}
      onCancel={props.onCancel}
      cancelLabel="PIN 입력으로 돌아가기"
    />
  );
}
