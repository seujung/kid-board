export const NIGHT_WAKE_MS = 30_000;

export type BoardScene = "day" | "night";

/** 22:00 이상 또는 06:00 미만이면 야간 모드입니다. */
export function isNightMode(now: Date): boolean {
  const h = now.getHours();
  return h >= 22 || h < 6;
}

/** 06:00 이상 18:00 미만이면 "day"입니다. */
export function sceneOf(now: Date): BoardScene {
  const h = now.getHours();
  return h >= 6 && h < 18 ? "day" : "night";
}

export function showsUmbrella(precipitationProbability: number, now: Date, latestSchoolTime: Date | null): boolean {
  if (precipitationProbability < 50 || latestSchoolTime === null) return false;
  return now.getTime() < latestSchoolTime.getTime();
}
