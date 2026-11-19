import { useState } from "preact/hooks";
import type { DimPeriod } from "../../core/displayPolicy";
import { WEEKDAY_KO } from "../../core/domain";
import type { Weekday } from "../../core/domain";
import { defaultNewID } from "../../store/boardStore";
import type { BoardStore } from "../../store/boardStore";
import { ErrorLine, Notice, errorText, useNotice } from "./common";
import { ALL_WEEKDAYS, sortWeekdays } from "./format";
import { TimeSelect } from "./TimeSelect";

export const DIM_WEEKDAY_ERROR = "요일을 하나 이상 고르세요";
export const DIM_EMPTY_TEXT = "화면 끄기 시간이 없어요. 화면이 항상 켜져 있어요.";
export const DIM_FOOTNOTE = "이 시간에는 화면을 어둡게 하고 시계만 보여 줘요. 화면을 누르면 30초 동안 보드를 보여 줘요.";

/** "구간 추가"로 만드는 새 구간입니다. 월~금 09:00~14:00입니다. */
function newPeriod(id: string): DimPeriod {
  return { id, start: { hour: 9, minute: 0 }, end: { hour: 14, minute: 0 }, weekdays: [1, 2, 3, 4, 5] };
}

function key(periods: DimPeriod[]): string {
  return JSON.stringify(
    periods.map((p) => [p.id, p.start.hour, p.start.minute, p.end.hour, p.end.minute, sortWeekdays(p.weekdays)]),
  );
}

/**
 * 화면 끄기 시간입니다. 구간마다 시작·끝 시각과 요일을 정하고 "저장"으로 한꺼번에 저장합니다.
 * 끝이 시작보다 이르거나 같으면 다음 날 끝 시각까지입니다.
 */
export function DimPeriodsEditor({ store, newID = defaultNewID }: { store: BoardStore; newID?: () => string }) {
  const [saved, setSaved] = useState<DimPeriod[]>(() => store.settings().dimPeriods);
  const [drafts, setDrafts] = useState<DimPeriod[]>(saved);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, showNotice] = useNotice();

  const allValid = drafts.every((p) => p.weekdays.length > 0);
  const changed = key(drafts) !== key(saved);

  const update = (index: number, next: DimPeriod) => setDrafts(drafts.map((p, i) => (i === index ? next : p)));
  const toggleDay = (index: number, p: DimPeriod, d: Weekday) =>
    update(index, {
      ...p,
      weekdays: p.weekdays.indexOf(d) >= 0 ? p.weekdays.filter((x) => x !== d) : sortWeekdays(p.weekdays.concat([d])),
    });

  const save = async () => {
    if (!allValid || !changed || busy) return;
    setBusy(true);
    setError(null);
    const next = drafts.map((p) => ({ ...p, weekdays: sortWeekdays(p.weekdays) }));
    try {
      await store.setDimPeriods(next);
      setSaved(next);
      setDrafts(next);
      showNotice("저장했어요");
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  };

  return (
    <div class="p-section">
      <div class="p-form-head">
        <span class="p-spacer" />
        <button type="button" class="p-button primary" disabled={!allValid || !changed || busy} onClick={save}>
          저장
        </button>
      </div>
      <ErrorLine text={error} />
      {drafts.length === 0 ? (
        <div class="p-empty dim-empty">{DIM_EMPTY_TEXT}</div>
      ) : (
        <div class="p-list">
          {drafts.map((p, i) => {
            const name = `구간 ${i + 1}`;
            return (
              <div class="p-row dim-row" key={p.id}>
                <TimeSelect label={`${name} 시작`} value={p.start} onChange={(t) => update(i, { ...p, start: t })} />
                <span class="dim-tilde">~</span>
                <TimeSelect label={`${name} 끝`} value={p.end} onChange={(t) => update(i, { ...p, end: t })} />
                <span class="weekday-toggles small">
                  {ALL_WEEKDAYS.map((d) => (
                    <button
                      type="button"
                      key={d}
                      class={p.weekdays.indexOf(d) >= 0 ? "weekday-toggle on" : "weekday-toggle"}
                      aria-pressed={p.weekdays.indexOf(d) >= 0}
                      aria-label={`${name} ${WEEKDAY_KO[d]}요일`}
                      onClick={() => toggleDay(i, p, d)}
                    >
                      {WEEKDAY_KO[d]}
                    </button>
                  ))}
                </span>
                <button
                  type="button"
                  class="p-small-button danger dim-delete"
                  aria-label={`${name} 지우기`}
                  onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
                >
                  지우기
                </button>
                {p.weekdays.length === 0 && <span class="p-error small dim-error">{DIM_WEEKDAY_ERROR}</span>}
              </div>
            );
          })}
        </div>
      )}
      <button type="button" class="p-add" onClick={() => setDrafts(drafts.concat([newPeriod(newID())]))}>
        ＋ 구간 추가
      </button>
      <div class="p-footnote">{DIM_FOOTNOTE}</div>
      <Notice text={notice} />
    </div>
  );
}
