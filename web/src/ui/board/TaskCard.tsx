import type { TaskInfo } from "../../core/domain";
import { NowBadge, WellDoneStamp } from "./Stamp";

export interface TaskCardProps {
  number: number;
  task: TaskInfo;
  isDone: boolean;
  isNow: boolean;
  /** 방금 완료한 카드이면 도장이 찍히는 효과를 냅니다. */
  animateStamp?: boolean;
  /** 바꿀 수 없는 카드를 누른 횟수입니다. 값이 바뀔 때마다 한 번 흔듭니다. */
  shakes?: number;
  /** 저장 중이거나 읽기 전용이면 누를 수 없습니다. */
  disabled?: boolean;
  readOnly?: boolean;
  onTap?(): void;
}

/** 할 일 카드 하나입니다. 순서 번호, 이모지 아이콘, 제목을 표시합니다. */
export function TaskCard(props: TaskCardProps) {
  const { number, task, isDone, isNow, shakes = 0 } = props;
  let cls = "task-card";
  if (isDone) cls += " done";
  if (isNow) cls += " now";
  if (props.readOnly) cls += " read-only";
  if (shakes > 0) cls += shakes % 2 === 0 ? " shake-a" : " shake-b";
  return (
    <button
      type="button"
      class={cls}
      disabled={props.readOnly}
      aria-disabled={props.disabled ? "true" : undefined}
      aria-label={`${number}번 ${task.title}${isDone ? ", 완료" : ""}${isNow ? ", 지금 하자" : ""}`}
      onClick={() => {
        if (!props.disabled && !props.readOnly) props.onTap?.();
      }}
    >
      <span class="task-number">{number}</span>
      <span class="task-icon">{task.icon}</span>
      <span class="task-title">{task.title}</span>
      {isDone && <WellDoneStamp animateIn={props.animateStamp} />}
      {isNow && <NowBadge />}
    </button>
  );
}
