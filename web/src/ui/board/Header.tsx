import type { ComponentChildren } from "preact";
import type { Clock } from "../../clock";
import { dayDateOf } from "../../core/dayDate";
import type { BoardScene } from "../../core/displayPolicy";
import type { WeatherDisplay, WeatherSnapshot } from "../../core/weather";
import { SceneBackground } from "./SceneBackground";
import { degrees, formatClock, formatFetchedAt, formatLongDate, weatherIcon } from "./theme";
import { SECOND_MS, useBoundaryTick } from "./ticks";

/** 매초 다시 그리는 부분은 이 시계 글자뿐입니다. */
function ClockText({ clock }: { clock: Clock }) {
  const tick = useBoundaryTick(clock, SECOND_MS);
  return <div class="clock-time">{formatClock(new Date(tick))}</div>;
}

export interface HeaderProps {
  clock: Clock;
  /** 분 단위로 정한 현재 시각입니다. 날짜, 풍경, 우산 안내에 씁니다. */
  now: Date;
  scene: BoardScene;
  weather: WeatherDisplay | "noLocation";
  locationName: string | null;
  showsUmbrella: boolean;
  /** 오른쪽 위 빈자리입니다. Task 9가 설정 아이콘을, Task 10이 야간 막 관련 요소를 붙입니다. */
  trailing?: ComponentChildren;
}

function WeatherDetails(props: {
  snap: WeatherSnapshot;
  stale: boolean;
  isDay: boolean;
  locationName: string | null;
  showsUmbrella: boolean;
}) {
  const { snap, stale } = props;
  return (
    <div class="weather-details">
      <div class={stale ? "weather-main stale" : "weather-main"}>
        <span class="weather-icon">{weatherIcon(snap.weatherCode, props.isDay)}</span>
        <span class="weather-temp">{degrees(snap.temperature)}</span>
        <span class="weather-range">
          <span>
            최고 {degrees(snap.high)}&nbsp;&nbsp;최저 {degrees(snap.low)}
          </span>
          <span>비 올 확률 {snap.precipitationProbability}%</span>
        </span>
      </div>
      {stale ? (
        <div class="weather-sub">{formatFetchedAt(snap.fetchedAt)}에 받은 날씨</div>
      ) : props.locationName ? (
        <div class="weather-sub">{props.locationName}</div>
      ) : null}
      {props.showsUmbrella && <div class="umbrella">☂️ 우산 챙기기!</div>}
    </div>
  );
}

function WeatherCard(props: Omit<HeaderProps, "clock" | "now" | "trailing">) {
  const isDay = props.scene === "day";
  const w = props.weather;
  let body;
  if (w === "noLocation") {
    body = (
      <div class="weather-message">
        <span class="weather-message-icon">📍</span>지역을 설정해 주세요
      </div>
    );
  } else if (w.kind === "unavailable") {
    body = (
      <div class="weather-message">
        <span class="weather-message-icon">🌈</span>날씨 정보 없음
      </div>
    );
  } else {
    body = (
      <WeatherDetails
        snap={w.snap}
        stale={w.kind === "stale"}
        isDay={isDay}
        locationName={props.locationName}
        showsUmbrella={props.showsUmbrella}
      />
    );
  }
  return <div class="header-card weather-card">{body}</div>;
}

/** 위쪽 공통 영역입니다. 날짜, 큰 시계, 날씨를 풍경 위에 표시합니다. */
export function Header(props: HeaderProps) {
  const { clock, now, scene, trailing } = props;
  return (
    <header class={`header ${scene}`}>
      <SceneBackground scene={scene} />
      <div class="header-content">
        <div class="header-card clock-card">
          <div class="clock-date">{formatLongDate(dayDateOf(now))}</div>
          <ClockText clock={clock} />
        </div>
        <WeatherCard
          scene={scene}
          weather={props.weather}
          locationName={props.locationName}
          showsUmbrella={props.showsUmbrella}
        />
      </div>
      <div class="header-trailing">{trailing}</div>
    </header>
  );
}
