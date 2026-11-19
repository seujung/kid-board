const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export interface PinPadProps {
  /** 4(PIN) 또는 8(복구 코드)입니다. */
  length: number;
  entry: string;
  disabled?: boolean;
  /** 숫자를 누르거나 지울 때마다 새 입력을 받습니다. 자리가 다 차면 `onComplete`도 부릅니다. */
  onChange: (entry: string) => void;
  onComplete: (entry: string) => void;
}

/** 입력한 자리를 동그라미로 보여 줍니다. 8자리는 4개씩 띄웁니다. */
export function PinDots({ length, count }: { length: number; count: number }) {
  const groups: number[][] = [];
  for (let i = 0; i < length; i += 4) {
    const group: number[] = [];
    for (let j = i; j < Math.min(i + 4, length); j++) group.push(j);
    groups.push(group);
  }
  return (
    <div class="pin-dots" aria-label={`${count}자리 입력함`}>
      {groups.map((group, gi) => (
        <span class="pin-dot-group" key={gi}>
          {group.map((i) => (
            <span key={i} class={i < count ? "pin-dot filled" : "pin-dot"} />
          ))}
        </span>
      ))}
    </div>
  );
}

/** 손가락으로 누르기 좋은 큰 숫자 키패드입니다. */
export function PinPad({ length, entry, disabled = false, onChange, onComplete }: PinPadProps) {
  const press = (key: string) => {
    if (disabled) return;
    if (key === "⌫") {
      if (entry.length > 0) onChange(entry.slice(0, -1));
      return;
    }
    if (entry.length >= length) return;
    const next = entry + key;
    onChange(next);
    if (next.length === length) onComplete(next);
  };
  return (
    <div class={disabled ? "pin-pad disabled" : "pin-pad"}>
      {KEYS.map((key, i) =>
        key === "" ? (
          <span key={i} class="pin-key-blank" />
        ) : (
          <button
            type="button"
            key={i}
            class={key === "⌫" ? "pin-key erase" : "pin-key"}
            aria-label={key === "⌫" ? "지우기" : key}
            disabled={disabled}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ),
      )}
    </div>
  );
}
