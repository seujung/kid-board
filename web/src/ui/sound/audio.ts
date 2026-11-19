/**
 * 앱 전체가 함께 쓰는 AudioContext입니다. 처음 쓸 때 만듭니다.
 * iPadOS Safari는 사용자 터치 안에서 만들거나 `resume()`해야 소리를 냅니다.
 */

type AudioCtor = new () => AudioContext;

let shared: AudioContext | null = null;
let unlocked = false;
let installed = false;

function audioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext || w.webkitAudioContext || null;
}

/** 공유 AudioContext입니다. Web Audio가 없거나 만들 수 없으면 null입니다. */
export function audioContext(): AudioContext | null {
  if (shared) return shared;
  const Ctor = audioCtor();
  if (!Ctor) return null;
  try {
    // Safari 15에는 없는 생성자 옵션을 쓰지 않습니다.
    shared = new Ctor();
  } catch {
    return null;
  }
  return shared;
}

/** 멈춘(suspended, interrupted) 상태이면 다시 켭니다. */
export function ensureRunning(ctx: AudioContext): void {
  if (ctx.state === "running") return;
  try {
    const p = ctx.resume() as Promise<void> | undefined;
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  } catch {
    // 이번 터치에서는 켜지 못했습니다. 다음 터치에서 다시 합니다.
  }
}

/** 터치 안에서 부릅니다. 처음 한 번은 1샘플짜리 무음 버퍼를 재생해 iOS의 소리 잠금을 풉니다. */
function unlock(): void {
  const ctx = audioContext();
  if (!ctx) return;
  ensureRunning(ctx);
  if (unlocked) return;
  unlocked = true;
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // 무음 버퍼를 재생하지 못해도 resume()으로 풀릴 수 있습니다.
  }
}

/**
 * 문서의 터치(`pointerdown`, `touchend`)마다 AudioContext를 깨웁니다.
 * iPad가 잠기거나 다른 앱이 소리를 가져가면 멈출 수 있으므로 첫 터치 뒤에도 계속 듣습니다.
 */
export function installAudioUnlock(doc: Document = document): void {
  if (installed) return;
  installed = true;
  for (const type of ["pointerdown", "touchend"]) doc.addEventListener(type, unlock, { capture: true, passive: true });
}
