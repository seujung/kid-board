export interface Clock {
  now(): Date;
}

const realClock: Clock = { now: () => new Date() };

/**
 * 보드가 쓰는 현재 시각입니다.
 * 개발 빌드에서 `?fixedNow=ISO8601`이 있으면 그 시각에 실행 후 지난 시간을 더합니다.
 * 그 밖에는 항상 `new Date()`입니다.
 */
export function makeClock(search: string, isDev: boolean): Clock {
  if (!isDev) return realClock;
  const raw = new URLSearchParams(search).get("fixedNow");
  if (!raw) return realClock;
  // 인코딩하지 않은 "+09:00"은 URLSearchParams가 공백으로 바꿉니다.
  const fixed = Date.parse(raw.replace(/ /g, "+"));
  if (!Number.isFinite(fixed)) return realClock;
  const offset = fixed - Date.now();
  return { now: () => new Date(Date.now() + offset) };
}
