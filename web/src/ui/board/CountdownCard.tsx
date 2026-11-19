import type { Clock } from "../../clock";
import type { BoardPhase } from "../../core/boardState";
import { countdownLabel, finishedText, formatCountdown, remainingText } from "../../core/copy";
import { SECOND_MS, useBoundaryTick } from "./ticks";

/** 매초 다시 그리는 남은 시간 글자입니다. */
function CountdownText({ clock, deadline }: { clock: Clock; deadline: Date }) {
  useBoundaryTick(clock, SECOND_MS);
  return <span class="countdown-time">{formatCountdown(deadline.getTime() - clock.now().getTime())}</span>;
}

export interface CountdownCardProps {
  clock: Clock;
  phase: BoardPhase;
  remaining: number;
  progress: number;
}

/** "등교까지 37분 55초" 카운트다운, 진행 막대, 남은 할 일 문구입니다. */
export function CountdownCard({ clock, phase, remaining, progress }: CountdownCardProps) {
  if (phase.kind === "finished") {
    return (
      <div class="countdown-card finished">
        <span class="finished-icon">{phase.allDone ? "🌟" : "🌙"}</span>
        <span class="finished-text">{finishedText(phase.allDone)}</span>
      </div>
    );
  }
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div class="countdown-card">
      <div class="countdown-row">
        <span class="countdown-label">{countdownLabel(phase)}</span>
        <CountdownText clock={clock} deadline={phase.deadline} />
      </div>
      <div class="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div class="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div class="countdown-remaining">{remainingText(remaining)}</div>
    </div>
  );
}
