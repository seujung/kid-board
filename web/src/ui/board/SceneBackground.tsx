import type { BoardScene } from "../../core/displayPolicy";

const W = 1024;
const H = 190;

/** 0~1 높이 비율 목록으로 아래쪽이 닫힌 부드러운 언덕 경로를 만듭니다. */
function hillPath(crest: number[]): string {
  const pts = crest.map((c, i) => [(W * i) / (crest.length - 1), H - H * c] as const);
  const first = pts[0] as readonly [number, number];
  let d = `M0 ${H} L${first[0]} ${first[1]}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1] as readonly [number, number];
    const q = pts[i] as readonly [number, number];
    d += ` Q${p[0]} ${p[1]} ${(p[0] + q[0]) / 2} ${(p[1] + q[1]) / 2}`;
  }
  const last = pts[pts.length - 1] as readonly [number, number];
  return `${d} L${last[0]} ${last[1]} L${W} ${H} Z`;
}

const FAR_HILL = hillPath([0.42, 0.55, 0.4, 0.5, 0.6, 0.46, 0.52]);
const NEAR_HILL = hillPath([0.2, 0.28, 0.18, 0.24, 0.17, 0.27, 0.22]);

const TREES: Array<[number, number]> = [
  [0.04, 0.34], [0.09, 0.26], [0.27, 0.3], [0.31, 0.22], [0.62, 0.32], [0.665, 0.24],
  [0.83, 0.36], [0.88, 0.28], [0.95, 0.3],
];

const STARS: Array<[number, number, number]> = [
  [0.06, 0.12, 2.2], [0.14, 0.3, 1.6], [0.22, 0.08, 2], [0.3, 0.22, 1.4], [0.38, 0.1, 2.4],
  [0.45, 0.36, 1.4], [0.6, 0.12, 1.8], [0.66, 0.3, 1.4], [0.72, 0.06, 2.2], [0.8, 0.22, 1.6],
  [0.86, 0.1, 2], [0.93, 0.28, 1.4], [0.98, 0.14, 1.8], [0.27, 0.4, 1.2], [0.76, 0.4, 1.2],
];

function Tree({ x, h, leaf, trunk }: { x: number; h: number; leaf: string; trunk: string }) {
  const w = h * 0.62;
  const base = H * 0.76;
  const top = base - h;
  return (
    <g>
      <rect x={x - w * 0.08} y={top + h * 0.75} width={w * 0.16} height={h * 0.25} fill={trunk} />
      <path d={`M${x} ${top + h * 0.3} L${x + w / 2} ${top + h * 0.85} L${x - w / 2} ${top + h * 0.85} Z`} fill={leaf} />
      <path d={`M${x} ${top} L${x + w * 0.39} ${top + h * 0.5} L${x - w * 0.39} ${top + h * 0.5} Z`} fill={leaf} />
    </g>
  );
}

function Cloud({ x, y, w }: { x: number; y: number; w: number }) {
  const h = w * 0.35;
  return (
    <g fill="#fff" opacity="0.92">
      <rect x={x - w / 2} y={y} width={w} height={h * 0.6} rx={h * 0.3} />
      <circle cx={x - w * 0.15} cy={y + h * 0.05} r={h * 0.4} />
      <circle cx={x + w * 0.12} cy={y - h * 0.05} r={h * 0.5} />
    </g>
  );
}

/** 헤더 뒤의 낮·밤 풍경입니다. 도형만으로 그리고, 매초 다시 그리지 않습니다. */
export function SceneBackground({ scene }: { scene: BoardScene }) {
  const day = scene === "day";
  const leaf = day ? "#348C54" : "#143333";
  const trunk = day ? "#80553A" : "#332624";
  const cx = W * 0.52;
  const cy = H * 0.3;
  return (
    <svg class="scene" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${scene}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={day ? "#80C7FA" : "#121745"} />
          <stop offset="1" stop-color={day ? "#D6F0FF" : "#3D3373"} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#sky-${scene})`} />
      {day ? (
        <g>
          <circle cx={cx} cy={cy} r="62" fill="#FFE066" opacity="0.3" />
          <circle cx={cx} cy={cy} r="40" fill="#FFD640" />
          <Cloud x={W * 0.34} y={H * 0.16} w={140} />
          <Cloud x={W * 0.68} y={H * 0.1} w={104} />
        </g>
      ) : (
        <g>
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={W * x} cy={H * y} r={r} fill="#fff" opacity="0.9" />
          ))}
          <circle cx={cx} cy={cy} r="56" fill="#fff" opacity="0.12" />
          <mask id="moon-cut">
            <rect width={W} height={H} fill="#fff" />
            <circle cx={cx + 18} cy={cy - 10} r="30" fill="#000" />
          </mask>
          <circle cx={cx} cy={cy} r="34" fill="#FFF5C7" mask="url(#moon-cut)" />
        </g>
      )}
      <path d={FAR_HILL} fill={day ? "#8CC778" : "#243D4C"} />
      {TREES.map(([x, h], i) => (
        <Tree key={i} x={W * x} h={H * h} leaf={leaf} trunk={trunk} />
      ))}
      <path d={NEAR_HILL} fill={day ? "#6BB05C" : "#1A2E3B"} />
    </svg>
  );
}
