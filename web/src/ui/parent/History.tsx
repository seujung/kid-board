import type { Clock } from "../../clock";
import { dayDateOf, sameDay } from "../../core/dayDate";
import { isStar, summaryOn } from "../../core/scheduleEngine";
import type { BoardStore } from "../../store/boardStore";
import { themeNamed } from "../board/theme";
import { historyCell, historyDateLabel, historyDays } from "./format";

/** 완료 기록입니다. 오늘까지 최근 28일을 최신 날짜부터 자녀별로 보여 줍니다. */
export function History({ store, clock }: { store: BoardStore; clock: Clock }) {
  const data = store.snapshot();
  const today = dayDateOf(clock.now());
  return (
    <div class="p-section">
      <table class="history">
        <thead>
          <tr>
            <th class="history-date">날짜</th>
            {data.children.map((c) => (
              <th key={c.id}>
                {c.avatar} {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {historyDays(today).map((day) => (
            <tr key={`${day.year}-${day.month}-${day.day}`} class={sameDay(day, today) ? "today" : undefined}>
              <td class="history-date">{historyDateLabel(day)}</td>
              {data.children.map((c) => {
                const summary = summaryOn(c.id, day, data);
                const star = isStar(summary);
                return (
                  <td
                    key={c.id}
                    class={star ? "star" : undefined}
                    style={star ? { color: themeNamed(c.themeColor).accent } : undefined}
                  >
                    {historyCell(summary)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div class="p-footnote">완료한 할 일 수 / 그날 할 일 수. 모두 끝낸 날은 ★로 표시해요.</div>
    </div>
  );
}
