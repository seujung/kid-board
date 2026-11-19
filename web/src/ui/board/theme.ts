import type { DayDate } from "../../core/dayDate";
import { weekdayOf } from "../../core/dayDate";
import { WEEKDAY_KO } from "../../core/domain";

export interface ChildTheme {
  accent: string;
  soft: string;
  panel: string;
}

/** 테마 색 이름은 이곳에서만 해석합니다. 알 수 없는 이름은 `sunny`입니다. */
export function themeNamed(name: string): ChildTheme {
  switch (name) {
    case "coral":
      return { accent: "#E85A4F", soft: "#FFE3DC", panel: "#FFEFEA" };
    case "sky":
      return { accent: "#3B82C4", soft: "#DBEAF8", panel: "#EBF4FC" };
    case "mint":
      return { accent: "#2E9E7A", soft: "#D6F2E7", panel: "#EAF8F2" };
    case "lavender":
      return { accent: "#8A6BD1", soft: "#E9E2F8", panel: "#F4F0FC" };
    default:
      return { accent: "#E0A21B", soft: "#FCEFC9", panel: "#FFF8E4" };
  }
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** 패널에 붙이는 CSS 변수입니다. 자식 요소는 `var(--accent)` 등으로 씁니다. */
export function themeStyle(theme: ChildTheme): Record<string, string> {
  return {
    "--accent": theme.accent,
    "--accent-line": rgba(theme.accent, 0.35),
    "--accent-faint": rgba(theme.accent, 0.18),
    "--soft": theme.soft,
    "--panel": theme.panel,
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatClock(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function formatLongDate(d: DayDate): string {
  return `${d.month}월 ${d.day}일 ${WEEKDAY_KO[weekdayOf(d)]}요일`;
}

export function formatFetchedAt(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function degrees(value: number): string {
  return `${Math.round(value)}°`;
}

/** Open-Meteo WMO 날씨 코드를 이모지로 바꿉니다. */
export function weatherIcon(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code === 1 || code === 2) return isDay ? "🌤️" : "☁️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95 && code <= 99) return "⛈️";
  return "🌡️";
}
