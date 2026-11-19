import { useEffect, useState } from "preact/hooks";
import type { Clock } from "../../clock";
import type { Lockout } from "../../core/parentLock";
import type { BoardStore, VerifyResult } from "../../store/boardStore";
import { errorText } from "./common";
import { PinDots, PinPad } from "./PinPad";

/** 잠금이 풀릴 때까지 남은 초입니다. 잠겨 있지 않으면 null입니다. */
function remainingSeconds(lockedUntil: number | null, now: number): number | null {
  if (lockedUntil === null || now >= lockedUntil) return null;
  return Math.ceil((lockedUntil - now) / 1000);
}

export function lockoutText(seconds: number): string {
  return `잠시 후 다시 해 주세요 (${seconds}초)`;
}

export interface SecretGateProps {
  clock: Clock;
  title: string;
  subtitle?: string;
  length: number;
  /** 화면을 열 때 이미 잠겨 있는지 보려고 읽습니다. */
  lockout: () => Lockout;
  verify: (secret: string) => Promise<VerifyResult>;
  wrongText: string;
  onSuccess: () => void;
  /** 없으면 "PIN을 잊었어요"를 숨깁니다. */
  onForgot?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

/**
 * 비밀 숫자(PIN 또는 복구 코드)를 확인합니다. 5회 연속 틀리면 저장소가 1분 동안 잠그고,
 * 이 화면은 남은 초를 1초마다 다시 세며 키패드를 막습니다.
 */
export function SecretGate(props: SecretGateProps) {
  const { clock } = props;
  const [entry, setEntry] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => props.lockout().lockedUntil);
  const [, setTick] = useState(0);
  const remaining = remainingSeconds(lockedUntil, clock.now().getTime());

  useEffect(() => {
    if (remaining === null) return;
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [remaining === null]);

  const submit = (secret: string) => {
    setBusy(true);
    props.verify(secret).then(
      (result) => {
        setBusy(false);
        setEntry("");
        if (result === "ok") {
          setMessage(null);
          props.onSuccess();
        } else if (result === "wrong") {
          setMessage(props.wrongText);
        } else {
          setMessage(null);
          setLockedUntil(result.lockedUntil);
        }
      },
      (err: unknown) => {
        setBusy(false);
        setEntry("");
        setMessage(errorText(err));
      },
    );
  };

  return (
    <div class="p-center">
      <div class="pin-title">{props.title}</div>
      {props.subtitle && <div class="pin-subtitle">{props.subtitle}</div>}
      <PinDots length={props.length} count={entry.length} />
      <div class="pin-message" role="status">
        {remaining !== null ? lockoutText(remaining) : (message ?? " ")}
      </div>
      <PinPad
        length={props.length}
        entry={entry}
        disabled={busy || remaining !== null}
        onChange={setEntry}
        onComplete={submit}
      />
      <div class="pin-actions">
        {props.onCancel && (
          <button type="button" class="p-link" onClick={props.onCancel}>
            {props.cancelLabel ?? "닫기"}
          </button>
        )}
        {props.onForgot && (
          <button type="button" class="p-link" onClick={props.onForgot}>
            PIN을 잊었어요
          </button>
        )}
      </div>
    </div>
  );
}

export interface ParentGateProps {
  store: BoardStore;
  clock: Clock;
  title?: string;
  onSuccess: () => void;
  onForgot?: () => void;
  onCancel?: () => void;
}

/** PIN 확인 화면입니다. */
export function ParentGate(props: ParentGateProps) {
  return (
    <SecretGate
      clock={props.clock}
      title={props.title ?? "PIN을 입력해 주세요"}
      length={4}
      lockout={() => props.store.settings().lockout}
      verify={(pin) => props.store.verifyPin(pin)}
      wrongText="PIN이 맞지 않아요"
      onSuccess={props.onSuccess}
      onForgot={props.onForgot}
      onCancel={props.onCancel}
    />
  );
}
