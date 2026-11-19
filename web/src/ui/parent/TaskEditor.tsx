import { useState } from "preact/hooks";
import { WEEKDAY_KO } from "../../core/domain";
import type { TaskInfo, TaskScheduleInfo, TimeSlot, Weekday } from "../../core/domain";
import type { BoardStore } from "../../store/boardStore";
import { DICTATION_HINT, ErrorLine, errorText } from "./common";
import { ALL_WEEKDAYS, sameWeekdays, sortWeekdays } from "./format";

export const TASK_ICONS = [
  "🪥", "🧼", "🚿", "🛁", "💧", "👕", "👖", "🧦",
  "🎒", "🍚", "🥛", "🍎", "📚", "📖", "✏️", "📝",
  "🧸", "🧹", "🛏️", "🧺", "🍽️", "👟", "💊", "🎹",
];

export type TaskTarget =
  | { kind: "new"; childID: string; slot: TimeSlot }
  | { kind: "edit"; task: TaskInfo; schedule: TaskScheduleInfo };

/**
 * 할 일 하나의 제목, 아이콘, 시간대, 반복 요일을 고칩니다.
 * 제목과 아이콘은 지난 날짜까지, 시간대와 요일은 오늘부터 반영합니다(기존 설계 7.5).
 */
export function TaskEditor(props: { store: BoardStore; target: TaskTarget; onDone: () => void }) {
  const { store, target } = props;
  const original =
    target.kind === "edit"
      ? { title: target.task.title, icon: target.task.icon, slot: target.schedule.slot, weekdays: target.schedule.weekdays }
      : null;
  const [title, setTitle] = useState(original?.title ?? "");
  const [icon, setIcon] = useState(original?.icon ?? (TASK_ICONS[0] as string));
  const [slot, setSlot] = useState<TimeSlot>(target.kind === "edit" ? target.schedule.slot : target.slot);
  const [weekdays, setWeekdays] = useState<Weekday[]>(original ? sortWeekdays(original.weekdays) : [1, 2, 3, 4, 5]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && weekdays.length > 0 && !busy;

  const toggleDay = (d: Weekday) =>
    setWeekdays(weekdays.indexOf(d) >= 0 ? weekdays.filter((x) => x !== d) : sortWeekdays(weekdays.concat([d])));

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      if (target.kind === "new") {
        await store.addTask(target.childID, trimmed, icon, slot, weekdays);
      } else {
        const id = target.task.id;
        if (original && (original.title !== trimmed || original.icon !== icon)) {
          await store.updateTaskAppearance(id, trimmed, icon);
        }
        if (original && (original.slot !== slot || !sameWeekdays(original.weekdays, weekdays))) {
          await store.updateTaskSchedule(id, slot, weekdays);
        }
      }
      setBusy(false);
      props.onDone();
    } catch (err) {
      setBusy(false);
      setError(errorText(err));
    }
  };

  return (
    <div class="p-form">
      <div class="p-form-head">
        <button type="button" class="p-button" onClick={props.onDone}>
          취소
        </button>
        <div class="p-form-title">{target.kind === "new" ? "할 일 추가" : "할 일 수정"}</div>
        <button type="button" class="p-button primary" disabled={!canSave} onClick={save}>
          저장
        </button>
      </div>
      <ErrorLine text={error} />
      <label class="p-field">
        <span class="p-label">제목</span>
        <input
          class="p-input"
          type="text"
          value={title}
          placeholder="예: 이 닦기"
          maxLength={30}
          onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)}
        />
        <span class="p-hint">{DICTATION_HINT}</span>
      </label>
      <div class="p-field">
        <span class="p-label">아이콘</span>
        <div class="emoji-grid wide">
          {TASK_ICONS.map((a) => (
            <button
              type="button"
              key={a}
              class={a === icon ? "emoji-choice on" : "emoji-choice"}
              aria-pressed={a === icon}
              onClick={() => setIcon(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div class="p-field-row">
        <div class="p-field">
          <span class="p-label">시간대</span>
          <div class="p-segment">
            {(["morning", "evening"] as TimeSlot[]).map((s) => (
              <button
                type="button"
                key={s}
                class={s === slot ? "p-segment-item on" : "p-segment-item"}
                aria-pressed={s === slot}
                onClick={() => setSlot(s)}
              >
                {s === "morning" ? "아침" : "저녁"}
              </button>
            ))}
          </div>
        </div>
        <div class="p-field">
          <span class="p-label">반복 요일</span>
          <div class="weekday-toggles">
            {ALL_WEEKDAYS.map((d) => (
              <button
                type="button"
                key={d}
                class={weekdays.indexOf(d) >= 0 ? "weekday-toggle on" : "weekday-toggle"}
                aria-pressed={weekdays.indexOf(d) >= 0}
                onClick={() => toggleDay(d)}
              >
                {WEEKDAY_KO[d]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {weekdays.length === 0 && <div class="p-error">요일을 하나 이상 골라 주세요</div>}
      {target.kind === "edit" && <div class="p-footnote">시간대와 요일을 바꾸면 오늘부터 반영돼요.</div>}
    </div>
  );
}
