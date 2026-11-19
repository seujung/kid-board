import { useEffect, useState } from "preact/hooks";
import type { ChildInfo, TaskInfo, TimeSlot } from "../../core/domain";
import type { BoardStore } from "../../store/boardStore";
import { ChildPicker, Confirm, ErrorLine, Notice, errorText, useNotice } from "./common";
import { editableTasks, weekdaySummary } from "./format";
import { TaskEditor } from "./TaskEditor";
import type { TaskTarget } from "./TaskEditor";

function CopyDialog(props: { task: TaskInfo; targets: ChildInfo[]; onCancel: () => void; onPick: (c: ChildInfo) => void }) {
  return (
    <div class="p-scrim" onClick={props.onCancel}>
      <div class="p-dialog" role="dialog" aria-label="누구에게 복사할까요?" onClick={(e) => e.stopPropagation()}>
        <div class="p-dialog-title">누구에게 복사할까요?</div>
        <div class="p-dialog-body">
          {props.task.icon} {props.task.title}
        </div>
        <div class="p-dialog-buttons column">
          {props.targets.map((c) => (
            <button type="button" key={c.id} class="p-button primary" onClick={() => props.onPick(c)}>
              {c.avatar} {c.name}
            </button>
          ))}
          <button type="button" class="p-button" onClick={props.onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

/** 할 일 관리입니다. 자녀를 고르면 아침과 저녁 목록을 따로 보여 줍니다. */
export function TasksEditor({ store }: { store: BoardStore }) {
  const [, setVersion] = useState(0);
  const [childID, setChildID] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskTarget | null>(null);
  const [archiving, setArchiving] = useState<TaskInfo | null>(null);
  const [copying, setCopying] = useState<TaskInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice] = useNotice();
  useEffect(() => store.subscribe(() => setVersion((v) => v + 1)), [store]);

  const data = store.snapshot();
  const child = data.children.find((c) => c.id === childID) ?? data.children[0];

  if (editing) return <TaskEditor store={store} target={editing} onDone={() => setEditing(null)} />;
  if (!child) return <div class="p-empty">먼저 자녀 관리에서 자녀를 추가해 주세요.</div>;

  const attempt = (work: Promise<unknown>) => {
    setError(null);
    work.catch((err: unknown) => setError(errorText(err)));
  };
  const others = data.children.filter((c) => c.id !== child.id);

  const section = (slot: TimeSlot) => {
    const items = editableTasks(child.id, slot, data);
    return (
      <div class="p-group" key={slot}>
        <div class="p-group-title">{slot === "morning" ? "아침" : "저녁"}</div>
        <div class="p-list">
          {items.map(({ task, schedule }, i) => (
            <div class="p-row" key={task.id}>
              <button type="button" class="p-row-main" onClick={() => setEditing({ kind: "edit", task, schedule })}>
                <span class="p-row-icon">{task.icon}</span>
                <span class="p-row-title">{task.title}</span>
                <span class="p-row-sub">{weekdaySummary(schedule.weekdays)}</span>
              </button>
              <button
                type="button"
                class="p-icon-button"
                aria-label="위로"
                disabled={i === 0}
                onClick={() => attempt(store.moveTask(child.id, slot, i, i - 1))}
              >
                ▲
              </button>
              <button
                type="button"
                class="p-icon-button"
                aria-label="아래로"
                disabled={i === items.length - 1}
                onClick={() => attempt(store.moveTask(child.id, slot, i, i + 1))}
              >
                ▼
              </button>
              {others.length > 0 && (
                <button type="button" class="p-small-button" onClick={() => setCopying(task)}>
                  복사
                </button>
              )}
              <button type="button" class="p-small-button danger" onClick={() => setArchiving(task)}>
                지우기
              </button>
            </div>
          ))}
        </div>
        <button type="button" class="p-add" onClick={() => setEditing({ kind: "new", childID: child.id, slot })}>
          ＋ {slot === "morning" ? "아침 할 일 추가" : "저녁 할 일 추가"}
        </button>
      </div>
    );
  };

  return (
    <div class="p-section">
      <ChildPicker kids={data.children} selected={child.id} onSelect={setChildID} />
      <ErrorLine text={error} />
      {section("morning")}
      {section("evening")}
      <div class="p-footnote">할 일을 누르면 고칠 수 있어요. 지워도 지난 완료 기록은 남아요.</div>
      <Notice text={notice} />
      {archiving && (
        <Confirm
          title="이 할 일을 지울까요?"
          body={
            <>
              {archiving.icon} {archiving.title}
              <div class="p-dialog-sub">지난 완료 기록은 남아요.</div>
            </>
          }
          confirmLabel="지우기"
          danger
          onCancel={() => setArchiving(null)}
          onConfirm={() => {
            const id = archiving.id;
            setArchiving(null);
            attempt(store.archiveTask(id));
          }}
        />
      )}
      {copying && (
        <CopyDialog
          task={copying}
          targets={others}
          onCancel={() => setCopying(null)}
          onPick={(c) => {
            const task = copying;
            setCopying(null);
            setError(null);
            store.copyTask(task.id, c.id).then(
              () => showNotice(`${c.name}에게 "${task.title}"을(를) 복사했어요`),
              (err: unknown) => setError(errorText(err)),
            );
          }}
        />
      )}
    </div>
  );
}
