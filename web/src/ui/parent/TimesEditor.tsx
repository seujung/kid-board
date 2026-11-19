import { useState } from "preact/hooks";
import { compareTime } from "../../core/dayDate";
import type { TimeOfDay } from "../../core/dayDate";
import { WEEKDAY_KO } from "../../core/domain";
import type { BoardData, Weekday } from "../../core/domain";
import type { BoardStore } from "../../store/boardStore";
import { ChildPicker, ErrorLine, Notice, errorText, useNotice } from "./common";
import { ALL_WEEKDAYS, timeValue } from "./format";
import { TimeSelect } from "./TimeSelect";

export const TIMES_ERROR_TEXT = "잘 준비 시각은 등교 시각보다 늦어야 해요";
const DEFAULT_SCHOOL: TimeOfDay = { hour: 8, minute: 30 };
const DEFAULT_BED: TimeOfDay = { hour: 21, minute: 30 };

interface DayDraft {
  school: TimeOfDay | null;
  bed: TimeOfDay;
}
type Drafts = Record<string, Record<number, DayDraft>>;

function isValid(d: DayDraft): boolean {
  return d.school === null || compareTime(d.bed, d.school) > 0;
}

function sameDraft(a: DayDraft | undefined, b: DayDraft | undefined): boolean {
  if (!a || !b) return a === b;
  const s = (t: TimeOfDay | null) => (t ? timeValue(t) : "-");
  return s(a.school) === s(b.school) && s(a.bed) === s(b.bed);
}

function load(data: BoardData): Drafts {
  const result: Drafts = {};
  for (const child of data.children) {
    const days: Record<number, DayDraft> = {};
    for (const day of ALL_WEEKDAYS) {
      const t = data.times.find((x) => x.childID === child.id && x.weekday === day);
      days[day] = { school: t?.schoolTime ?? null, bed: t?.bedTime ?? DEFAULT_BED };
    }
    result[child.id] = days;
  }
  return result;
}

/** 시각 설정입니다. 자녀와 요일마다 등교 시각(켜기/끄기)과 잘 준비 시각을 정하고 한꺼번에 저장합니다. */
export function TimesEditor({ store }: { store: BoardStore }) {
  const data = store.snapshot();
  const [childID, setChildID] = useState<string | null>(null);
  const [saved, setSaved] = useState<Drafts>(() => load(data));
  const [drafts, setDrafts] = useState<Drafts>(saved);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, showNotice] = useNotice();
  const child = data.children.find((c) => c.id === childID) ?? data.children[0];
  if (!child) return <div class="p-empty">먼저 자녀 관리에서 자녀를 추가해 주세요.</div>;

  const changes: { childID: string; day: Weekday; draft: DayDraft }[] = [];
  let allValid = true;
  /** 지금 보고 있지 않은 자녀에게 잘못된 시각이 있습니다. 보고 있는 자녀는 줄마다 문구를 보여 줍니다. */
  let otherInvalid = false;
  for (const id of Object.keys(drafts)) {
    for (const day of ALL_WEEKDAYS) {
      const d = drafts[id]?.[day];
      if (!d) continue;
      if (!isValid(d)) {
        allValid = false;
        if (id !== child.id) otherInvalid = true;
      }
      if (!sameDraft(d, saved[id]?.[day])) changes.push({ childID: id, day, draft: d });
    }
  }

  const update = (day: Weekday, next: DayDraft) =>
    setDrafts({ ...drafts, [child.id]: { ...drafts[child.id], [day]: next } });

  const save = async () => {
    if (!allValid || changes.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    let nextSaved = saved;
    try {
      for (const c of changes) {
        await store.setTimes(c.childID, c.day, c.draft.school, c.draft.bed);
        nextSaved = { ...nextSaved, [c.childID]: { ...nextSaved[c.childID], [c.day]: c.draft } };
      }
      showNotice("저장했어요");
    } catch (err) {
      setError(errorText(err));
    }
    setSaved(nextSaved);
    setBusy(false);
  };

  const days = drafts[child.id] ?? {};
  return (
    <div class="p-section">
      <div class="p-form-head">
        <ChildPicker kids={data.children} selected={child.id} onSelect={setChildID} />
        <span class="p-spacer" />
        <button
          type="button"
          class="p-button primary"
          disabled={!allValid || changes.length === 0 || busy}
          onClick={save}
        >
          저장
        </button>
      </div>
      <ErrorLine text={error} />
      {otherInvalid && <div class="p-error">{TIMES_ERROR_TEXT}</div>}
      <div class="p-list">
        {ALL_WEEKDAYS.map((day) => {
          const d = days[day] ?? { school: null, bed: DEFAULT_BED };
          return (
            <div class="p-row times-row" key={day}>
              <span class="times-day">{WEEKDAY_KO[day]}</span>
              <label class="p-check">
                <input
                  type="checkbox"
                  checked={d.school !== null}
                  onChange={(e) =>
                    update(day, { ...d, school: (e.currentTarget as HTMLInputElement).checked ? DEFAULT_SCHOOL : null })
                  }
                />
                등교
              </label>
              <span class="times-field">
                {d.school !== null ? (
                  <TimeSelect
                    label={`${WEEKDAY_KO[day]} 등교 시각`}
                    value={d.school}
                    onChange={(t) => update(day, { ...d, school: t })}
                  />
                ) : (
                  <span class="p-row-sub">등교 안 함</span>
                )}
              </span>
              <span class="times-label">잘 준비</span>
              <TimeSelect
                label={`${WEEKDAY_KO[day]} 잘 준비 시각`}
                value={d.bed}
                onChange={(t) => update(day, { ...d, bed: t })}
              />
              {!isValid(d) && <span class="p-error small">{TIMES_ERROR_TEXT}</span>}
            </div>
          );
        })}
      </div>
      <div class="p-footnote">등교를 끄면 그날은 하루 종일 할 일 목록을 보여 줘요.</div>
      <Notice text={notice} />
    </div>
  );
}
