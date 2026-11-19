import type { TimeOfDay } from "../../core/dayDate";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_STEP = 5;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 5분 단위 분 목록입니다. 저장된 값이 5분 단위가 아니면 그 값도 넣습니다. */
function minutesFor(current: number): number[] {
  const list: number[] = [];
  for (let m = 0; m < 60; m += MINUTE_STEP) list.push(m);
  if (list.indexOf(current) < 0) {
    list.push(current);
    list.sort((a, b) => a - b);
  }
  return list;
}

/**
 * 시와 분을 목록에서 고르는 시각 입력입니다.
 * iPadOS 15의 `<input type="time">`은 이 앱에서 눌러도 열리지 않아 `<select>` 두 개로 대신합니다.
 * 접근성 이름은 `${label} 시`, `${label} 분`입니다.
 */
export function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TimeOfDay;
  onChange: (next: TimeOfDay) => void;
}) {
  const read = (e: Event) => Number((e.currentTarget as HTMLSelectElement).value);
  return (
    <span class="time-select">
      <select
        class="p-select"
        aria-label={`${label} 시`}
        value={String(value.hour)}
        onChange={(e) => onChange({ hour: read(e), minute: value.minute })}
      >
        {HOURS.map((h) => (
          <option key={h} value={String(h)}>
            {pad2(h)}시
          </option>
        ))}
      </select>
      <select
        class="p-select"
        aria-label={`${label} 분`}
        value={String(value.minute)}
        onChange={(e) => onChange({ hour: value.hour, minute: read(e) })}
      >
        {minutesFor(value.minute).map((m) => (
          <option key={m} value={String(m)}>
            {pad2(m)}분
          </option>
        ))}
      </select>
    </span>
  );
}
