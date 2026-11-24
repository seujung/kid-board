import { useEffect, useRef, useState } from "preact/hooks";
import type { Clock } from "../../clock";
import { boardState, canToggle } from "../../core/boardState";
import type { ChildBoardState } from "../../core/boardState";
import { sameDay } from "../../core/dayDate";
import type { DayDate } from "../../core/dayDate";
import type { BoardData } from "../../core/domain";
import { timesOn } from "../../core/scheduleEngine";
import type { ScheduledTask } from "../../core/scheduleEngine";
import type { BoardStore } from "../../store/boardStore";
import { completesPhase, soundFor } from "../sound/policy";
import { playSound } from "../sound/sounds";
import { CountdownCard } from "./CountdownCard";
import { OtherDayList, TodayList, UndoDialog } from "./DayList";
import { Celebration, CELEBRATION_MS } from "./Stamp";
import { themeNamed, themeStyle } from "./theme";
import { TodayCalendar } from "./TodayCalendar";
import { WeekStrip } from "./WeekStrip";

export const READ_ONLY_TIMEOUT_MS = 30_000;

export interface ChildPanelProps {
  store: BoardStore;
  clock: Clock;
  state: ChildBoardState;
  data: BoardData;
  /** 저장이 실패했을 때 부릅니다. 보드가 짧은 안내를 띄웁니다. */
  onSaveError(): void;
}

function slotTitle(state: ChildBoardState, data: BoardData): string {
  switch (state.phase.kind) {
    case "morning":
      return "아침 할 일";
    case "evening":
      return "저녁 할 일";
    case "allDay":
      return "오늘 할 일";
    case "finished":
      return timesOn(state.child.id, state.day, data).schoolTime === null ? "오늘 할 일" : "저녁 할 일";
  }
}

/** 자녀 한 명의 패널입니다. 카운트다운, 이번 주, 할 일 카드를 표시합니다. */
export function ChildPanel({ store, clock, state, data, onSaveError }: ChildPanelProps) {
  const child = state.child;
  const [selectedDay, setSelectedDay] = useState<DayDate | null>(null);
  const [interactions, setInteractions] = useState(0);
  const [stampedID, setStampedID] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<ScheduledTask | null>(null);
  const [shakes, setShakes] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [celebrating, setCelebrating] = useState(false);
  const busyRef = useRef(new Set<string>());
  const celebrationTimer = useRef(0);

  // 날짜가 바뀌어 고른 날이 오늘이 되면 오늘 목록을 봅니다.
  const viewing = selectedDay && !sameDay(selectedDay, state.day) ? selectedDay : null;

  useEffect(() => {
    if (!viewing) return;
    const timer = window.setTimeout(() => setSelectedDay(null), READ_ONLY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [viewing, interactions]);

  useEffect(() => () => window.clearTimeout(celebrationTimer.current), []);

  const shake = (id: string) => setShakes((s) => ({ ...s, [id]: (s[id] ?? 0) + 1 }));

  const setBusyFor = (id: string, on: boolean) => {
    if (on) busyRef.current.add(id);
    else busyRef.current.delete(id);
    setBusy(new Set(busyRef.current));
  };

  const celebrate = () => {
    window.clearTimeout(celebrationTimer.current);
    setCelebrating(true);
    celebrationTimer.current = window.setTimeout(() => setCelebrating(false), CELEBRATION_MS);
  };

  const toggle = (id: string, completing: boolean) => {
    setBusyFor(id, true);
    if (completing) setStampedID(id);
    let pending: Promise<boolean>;
    try {
      pending = store.toggleCompletion(child.id, id);
    } catch (e) {
      pending = Promise.reject(e);
    }
    // 메모리 변경은 바로 반영되므로 저장을 기다리지 않고 축하 여부와 소리를 정합니다.
    // 저장이 실패해 되돌아가도 이미 낸 "띵"은 그대로 둡니다.
    const now = clock.now();
    const after = boardState(child, now, store.snapshot());
    const nextDone = after.doneTaskIDs.has(id);
    const settings = store.settings();
    playSound(
      soundFor({
        prevDone: !completing,
        nextDone,
        remaining: after.remaining,
        phaseTotal: after.visibleTasks.length,
        // 검은 막이 덮여 있으면 카드를 누를 수 없습니다. 화면 끄기 시간에 깨운 30초 동안은 소리를 냅니다.
        dimmed: false,
        enabled: settings.sound.enabled,
      }),
      settings.sound.volume,
    );
    if (completing && completesPhase(nextDone, after.remaining, after.visibleTasks.length)) celebrate();
    pending
      .then((ok) => {
        if (!ok) {
          setStampedID(null);
          shake(id);
        }
      })
      .catch(() => onSaveError())
      .then(() => setBusyFor(id, false));
  };

  const tap = (s: ScheduledTask) => {
    const id = s.task.id;
    if (busyRef.current.has(id)) return;
    const current = store.snapshot();
    const now = clock.now();
    if (!canToggle(id, child.id, now, current)) {
      shake(id);
      return;
    }
    const done = boardState(child, now, current).doneTaskIDs.has(id);
    if (done) setPendingUndo(s);
    else toggle(id, true);
  };

  const selectDay = (day: DayDate) => setSelectedDay(sameDay(day, state.day) ? null : day);
  const hasCalendars = child.calendars.length > 0;
  const taskList = viewing ? (
    <OtherDayList childID={child.id} day={viewing} data={data} onBack={() => setSelectedDay(null)} />
  ) : (
    <TodayList
      title={slotTitle(state, data)}
      tasks={state.visibleTasks}
      doneIDs={state.doneTaskIDs}
      nowTaskID={state.nowTaskID}
      stampedID={stampedID}
      shakes={shakes}
      busy={busy}
      onTap={tap}
    />
  );

  return (
    <section
      class={hasCalendars ? "panel has-calendar" : "panel"}
      style={themeStyle(themeNamed(child.themeColor))}
      onPointerDown={() => {
        if (viewing) setInteractions((n) => n + 1);
      }}
    >
      <div class="panel-top">
        <div class="name-tag">
          <div class="avatar">{child.avatar}</div>
          <div class="child-name">{child.name}</div>
        </div>
        <CountdownCard clock={clock} phase={state.phase} remaining={state.remaining} progress={state.progress} />
      </div>
      <WeekStrip childID={child.id} today={state.day} selected={viewing} data={data} onSelect={selectDay} />
      {hasCalendars ? (
        <div class="panel-content">
          {taskList}
          <TodayCalendar childName={child.name} calendars={child.calendars} day={state.day} />
        </div>
      ) : (
        taskList
      )}
      {celebrating && <Celebration />}
      {pendingUndo && (
        <UndoDialog
          task={pendingUndo}
          onCancel={() => setPendingUndo(null)}
          onConfirm={() => {
            const id = pendingUndo.task.id;
            setPendingUndo(null);
            if (!busyRef.current.has(id)) toggle(id, false);
          }}
        />
      )}
    </section>
  );
}
