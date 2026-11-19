import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Clock } from "../../clock";
import { boardState } from "../../core/boardState";
import { atTime, dayDateOf } from "../../core/dayDate";
import type { BoardData, ChildInfo } from "../../core/domain";
import { sceneOf, showsUmbrella } from "../../core/displayPolicy";
import { timesOn } from "../../core/scheduleEngine";
import type { BoardStore } from "../../store/boardStore";
import { ChildPanel } from "./ChildPanel";
import { Header } from "./Header";
import { MINUTE_MS, useBoundaryTick } from "./ticks";
import { useWeather } from "./useWeather";
import type { WeatherState } from "./useWeather";

/** 한 화면에 놓는 자녀 패널의 최대 수입니다. */
export const MAX_PANELS = 2;
export const SAVE_ERROR_TEXT = "저장하지 못했어요. 다시 눌러 주세요.";
const TOAST_MS = 3000;

/** 표시 중인 자녀들의 오늘 등교 시각 중 가장 늦은 값입니다. 모두 등교하지 않으면 null입니다. */
export function latestSchoolTime(children: ChildInfo[], now: Date, data: BoardData): Date | null {
  const today = dayDateOf(now);
  let latest: Date | null = null;
  for (const child of children) {
    const school = timesOn(child.id, today, data).schoolTime;
    if (!school) continue;
    const at = atTime(today, school);
    if (!latest || at.getTime() > latest.getTime()) latest = at;
  }
  return latest;
}

export interface BoardViewProps {
  store: BoardStore;
  clock: Clock;
  /** 헤더 오른쪽 위 자리입니다. 함수이면 보드의 날씨 상태(`refreshNow`)를 받습니다. */
  trailing?: ComponentChildren | ((ctx: { weather: WeatherState }) => ComponentChildren);
}

/**
 * 보드 화면입니다. 위쪽은 공통 헤더, 아래쪽은 자녀 패널을 좌우로 놓습니다.
 * 저장소가 바뀔 때와 분이 바뀔 때만 다시 그립니다. 매초 바뀌는 시계와 카운트다운은 각자 다시 그립니다.
 */
export function BoardView({ store, clock, trailing }: BoardViewProps) {
  const [, setVersion] = useState(0);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef(0);
  useBoundaryTick(clock, MINUTE_MS);
  useEffect(() => store.subscribe(() => setVersion((v) => v + 1)), [store]);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const weather = useWeather(store, clock);

  const now = clock.now();
  const data = store.snapshot();
  const children = data.children.slice(0, MAX_PANELS);
  const weatherSnap = typeof weather.display === "object" && "snap" in weather.display ? weather.display.snap : null;
  const umbrella =
    weatherSnap !== null &&
    showsUmbrella(weatherSnap.precipitationProbability, now, latestSchoolTime(children, now, data));

  const showToast = () => {
    window.clearTimeout(toastTimer.current);
    setToast(true);
    toastTimer.current = window.setTimeout(() => setToast(false), TOAST_MS);
  };

  return (
    <div class="board">
      <Header
        clock={clock}
        now={now}
        scene={sceneOf(now)}
        weather={weather.display}
        locationName={store.settings().location?.name ?? null}
        showsUmbrella={umbrella}
        trailing={typeof trailing === "function" ? trailing({ weather }) : trailing}
      />
      <main class={children.length === 1 ? "panels single" : "panels"}>
        {children.length === 0 ? (
          <div class="empty-board">부모 모드에서 자녀를 추가해 주세요</div>
        ) : (
          children.map((child) => (
            <ChildPanel
              key={child.id}
              store={store}
              clock={clock}
              state={boardState(child, now, data)}
              data={data}
              onSaveError={showToast}
            />
          ))
        )}
      </main>
      {toast && (
        <div class="toast" role="status">
          {SAVE_ERROR_TEXT}
        </div>
      )}
    </div>
  );
}
