import type { BoardPhase } from "./boardState";

export function countdownLabel(phase: BoardPhase): string | null {
  switch (phase.kind) {
    case "morning":
      return "등교까지";
    case "evening":
    case "allDay":
      return "잘 준비까지";
    case "finished":
      return null;
  }
}

export function remainingText(n: number): string {
  return n >= 1 ? `할 일 ${n}개 남았어!` : "다 했어! 최고야!";
}

export function finishedText(allDone: boolean): string {
  return allDone ? "오늘 수고했어!" : "내일 또 해 보자";
}

/** 남은 시간을 "37분 55초"처럼 씁니다. 1시간 이상이면 앞에 시간을 붙입니다. 음수는 0으로 봅니다. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const tail = `${minutes}분 ${String(seconds).padStart(2, "0")}초`;
  return hours > 0 ? `${hours}시간 ${tail}` : tail;
}
