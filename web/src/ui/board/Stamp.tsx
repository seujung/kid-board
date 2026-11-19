import { remainingText } from "../../core/copy";

/** 완료 카드의 "참 잘했어요" 도장입니다. `animateIn`이면 위에서 꾹 찍히는 효과를 냅니다. */
export function WellDoneStamp({ animateIn = false }: { animateIn?: boolean }) {
  return (
    <div class={animateIn ? "stamp stamp-in" : "stamp"} aria-label="참 잘했어요">
      <div class="stamp-ring">
        <span>참</span>
        <span>잘했어요</span>
      </div>
    </div>
  );
}

const STAR_PATH =
  "M12 1.6l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.7l-6.4 3.5L7 14.1 1.7 9.1l7.2-.9z";

/** 요일 칸의 별 도장입니다. */
export function StarStamp() {
  return (
    <svg class="star-stamp" viewBox="0 0 24 24" aria-label="별 도장">
      <defs>
        <linearGradient id="star-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#FFDB4D" />
          <stop offset="1" stop-color="#F5A30D" />
        </linearGradient>
      </defs>
      <path d={STAR_PATH} fill="url(#star-fill)" stroke="#C78000" stroke-width="1.2" stroke-linejoin="round" />
    </svg>
  );
}

/** 지금 할 카드에 붙는 노란 알약 모양 표시입니다. */
export function NowBadge() {
  return <div class="now-badge">지금 하자!</div>;
}

export const CELEBRATION_MS = 2000;

const PIECES: Array<[string, number, number, number]> = [
  ["🎉", -34, -30, -40], ["⭐️", 32, -32, 50], ["🌟", -36, 18, 30],
  ["✨", 36, 20, -30], ["🎊", -8, -36, 20], ["💖", 12, 34, -20],
  ["⭐️", -24, 32, 60], ["🎉", 26, -12, -50], ["✨", -20, -14, 40],
];

/** 보이는 할 일을 모두 끝냈을 때 2초 동안 보여 주는 축하 효과입니다. transform과 opacity만 움직입니다. */
export function Celebration() {
  return (
    <div class="celebration" aria-hidden="true">
      {PIECES.map(([emoji, x, y, spin], i) => (
        <span
          key={i}
          class="confetti"
          style={`--tx:${x * 5}px;--ty:${y * 5}px;--spin:${spin}deg;animation-delay:${i * 30}ms`}
        >
          {emoji}
        </span>
      ))}
      <div class="celebration-text">{remainingText(0)}</div>
    </div>
  );
}
