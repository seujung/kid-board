/** 현지 시각(테스트는 TZ=Asia/Seoul로 실행)으로 Date를 만듭니다. */
export function at(y: number, m: number, d: number, h = 0, min = 0, s = 0): Date {
  return new Date(y, m - 1, d, h, min, s);
}
