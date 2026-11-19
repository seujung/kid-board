import { sameDay } from "../../core/dayDate";
import type { DayDate } from "../../core/dayDate";
import type { BoardData } from "../../core/domain";
import { tasksOn } from "../../core/scheduleEngine";
import type { ScheduledTask } from "../../core/scheduleEngine";
import { formatLongDate } from "./theme";
import { TaskCard } from "./TaskCard";

export interface TodayListProps {
  title: string;
  tasks: ScheduledTask[];
  doneIDs: Set<string>;
  nowTaskID: string | null;
  stampedID: string | null;
  shakes: Record<string, number>;
  busy: Set<string>;
  onTap(task: ScheduledTask): void;
}

/** 오늘 현재 시간대의 할 일 카드 목록입니다. */
export function TodayList(props: TodayListProps) {
  return (
    <div class="day-list">
      <div class="section-row">
        <h2 class="section-title">
          {props.title} {props.doneIDs.size}/{props.tasks.length}
        </h2>
      </div>
      <div class="task-scroll">
        <div class="task-grid">
          {props.tasks.map((s, i) => (
            <TaskCard
              key={s.task.id}
              number={i + 1}
              task={s.task}
              isDone={props.doneIDs.has(s.task.id)}
              isNow={props.nowTaskID === s.task.id}
              animateStamp={props.stampedID === s.task.id}
              shakes={props.shakes[s.task.id] ?? 0}
              disabled={props.busy.has(s.task.id)}
              onTap={() => props.onTap(s)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export interface OtherDayListProps {
  childID: string;
  day: DayDate;
  data: BoardData;
  onBack(): void;
}

/** 다른 요일의 할 일 목록입니다. 보기만 하고 완료를 바꾸지 못합니다. */
export function OtherDayList({ childID, day, data, onBack }: OtherDayListProps) {
  const tasks = tasksOn(childID, day, data);
  const done = new Set(
    data.completions.filter((c) => c.childID === childID && sameDay(c.day, day)).map((c) => c.taskID),
  );
  const doneCount = tasks.filter((s) => done.has(s.task.id)).length;
  return (
    <div class="day-list">
      <div class="section-row">
        <h2 class="section-title">
          {formatLongDate(day)} 할 일 {doneCount}/{tasks.length}
        </h2>
        <button type="button" class="back-today" onClick={onBack}>
          ↩ 오늘로
        </button>
      </div>
      {tasks.length === 0 ? (
        <div class="no-tasks">이날은 할 일이 없어요</div>
      ) : (
        <div class="task-scroll">
          <div class="task-grid">
            {tasks.map((s, i) => (
              <TaskCard
                key={s.task.id}
                number={i + 1}
                task={s.task}
                isDone={done.has(s.task.id)}
                isNow={false}
                readOnly
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface UndoDialogProps {
  task: ScheduledTask;
  onCancel(): void;
  onConfirm(): void;
}

/** 완료 카드를 눌렀을 때 묻는 "취소할까요?" 확인 창입니다. 패널 위에 덮습니다. */
export function UndoDialog({ task, onCancel, onConfirm }: UndoDialogProps) {
  return (
    <div class="dialog-scrim" onClick={onCancel}>
      <div class="dialog" role="alertdialog" aria-label="취소할까요?" onClick={(e) => e.stopPropagation()}>
        <div class="dialog-title">취소할까요?</div>
        <div class="dialog-body">
          {task.task.icon} {task.task.title}
        </div>
        <div class="dialog-buttons">
          <button type="button" class="dialog-no" onClick={onCancel}>
            아니요
          </button>
          <button type="button" class="dialog-yes" onClick={onConfirm}>
            네, 취소할래요
          </button>
        </div>
      </div>
    </div>
  );
}
