/**
 * 부모 모드에 표시하는 버전입니다. 예: "20261119-2055"
 * 빌드하는 기기의 시간대와 상관없이 서울 시각으로 정합니다. GitHub Actions 러너는 UTC입니다.
 */
export function appVersion(d: Date = new Date()): string {
  const parts: Record<string, string> = {};
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (const part of format.formatToParts(d)) parts[part.type] = part.value;
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}
