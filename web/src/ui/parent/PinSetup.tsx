import { useState } from "preact/hooks";
import { isValidPin } from "../../core/parentLock";
import { errorText } from "./common";
import { PinDots, PinPad } from "./PinPad";

export interface PinSetupProps {
  title?: string;
  /** 새 PIN을 저장합니다. 실패하면 이 화면에 남아 문구를 보여 줍니다. */
  save: (pin: string) => Promise<void>;
  onDone: () => void;
  onCancel?: () => void;
}

/** 새 PIN 4자리를 두 번 입력받아 저장합니다. */
export function PinSetup(props: PinSetupProps) {
  const [first, setFirst] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (pin: string) => {
    setEntry("");
    if (!isValidPin(pin)) return;
    if (first === null) {
      setFirst(pin);
      setMessage(null);
      return;
    }
    if (first !== pin) {
      setFirst(null);
      setMessage("두 PIN이 달라요. 처음부터 다시 입력해 주세요");
      return;
    }
    setBusy(true);
    props.save(pin).then(
      () => {
        setBusy(false);
        props.onDone();
      },
      (err: unknown) => {
        setBusy(false);
        setFirst(null);
        setMessage(errorText(err));
      },
    );
  };

  return (
    <div class="p-center">
      <div class="pin-title">{props.title ?? "새 PIN을 정해 주세요"}</div>
      <div class="pin-subtitle">{first === null ? "PIN 4자리를 입력해 주세요" : "한 번 더 입력해 주세요"}</div>
      <PinDots length={4} count={entry.length} />
      <div class="pin-message" role="status">
        {message ?? " "}
      </div>
      <PinPad length={4} entry={entry} disabled={busy} onChange={setEntry} onComplete={submit} />
      <div class="pin-actions">
        {props.onCancel && (
          <button type="button" class="p-link" onClick={props.onCancel}>
            닫기
          </button>
        )}
      </div>
    </div>
  );
}
