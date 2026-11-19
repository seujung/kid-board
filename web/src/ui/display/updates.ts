import { DEFAULT_DIM_PERIODS, isDimmed } from "../../core/displayPolicy";
import type { DimPeriod } from "../../core/displayPolicy";
import type { Clock } from "../../clock";
import type { UpdateInfo } from "../parent/ParentHome";

/** 화면 끄기 시간에 이만큼 입력이 없으면 새 버전을 적용합니다(웹 설계 6.7). */
export const QUIET_MS = 300_000;
/** 새 버전 적용 조건을 확인하는 간격입니다. */
export const CHECK_MS = 60_000;
/** 새 배포를 찾는 간격입니다. 벽에 붙은 iPad는 앱을 다시 열지 않으므로 직접 확인합니다. */
export const UPDATE_POLL_MS = 3_600_000;
/** 새 워커의 활성화가 끝나지 않아도 이만큼 지나면 다시 엽니다. */
const RELOAD_FALLBACK_MS = 10_000;

/** 앱 → 서비스 워커 메시지입니다. 대기 중인 워커가 이 메시지를 받으면 활성화합니다. */
export const SKIP_WAITING = { type: "SKIP_WAITING" } as const;

/**
 * 대기 중인 새 버전을 지금 적용할지입니다.
 * 부모가 요청했거나, 부모가 정한 화면 끄기 시간 안에서 입력이 5분 이상 없으면 적용합니다.
 * 화면 끄기 시간이 하나도 없으면 부모가 요청하거나 앱을 다시 열 때만 적용합니다.
 */
export function shouldApplyUpdate(input: {
  waiting: boolean;
  now: Date;
  lastInputAt: number;
  parentRequested: boolean;
  dimPeriods: readonly DimPeriod[];
}): boolean {
  if (!input.waiting) return false;
  if (input.parentRequested) return true;
  return isDimmed(input.now, input.dimPeriods) && input.now.getTime() - input.lastInputAt >= QUIET_MS;
}

/** 서비스 워커의 새 버전 상태를 앱에 알립니다. */
export interface UpdateSource {
  current(): UpdateInfo;
  subscribe(listener: () => void): () => void;
}

/**
 * 서비스 워커를 등록하고 새 버전 적용을 관리합니다. 운영 빌드에서만 부릅니다.
 * - 새 워커가 `waiting`이면 "새 버전 있음"을 알립니다. 등록할 때 이미 설치 중인 워커도 지켜봅니다.
 * - 1분마다 `shouldApplyUpdate`를 확인하고, 참이면 워커에 `SKIP_WAITING`을 보냅니다.
 * - 워커가 바뀌면(`controllerchange`) 한 번만 다시 엽니다.
 * `dimPeriods`는 지금 저장된 화면 끄기 시간을 돌려줍니다. 저장소를 열기 전에는 기본값을 씁니다.
 */
export function startServiceWorker(
  clock: Clock,
  scriptUrl: string,
  scope: string,
  dimPeriods: () => readonly DimPeriod[] = () => DEFAULT_DIM_PERIODS,
): UpdateSource {
  const sw = navigator.serviceWorker;
  const listeners = new Set<() => void>();
  let waiting: ServiceWorker | null = null;
  let applyRequested = false;
  let reloading = false;
  let lastInputAt = clock.now().getTime();

  const tryApply = (parentRequested: boolean) => {
    if (!waiting) return;
    if (!shouldApplyUpdate({ waiting: true, now: clock.now(), lastInputAt, parentRequested, dimPeriods: dimPeriods() })) return;
    applyRequested = true;
    waiting.postMessage(SKIP_WAITING);
  };

  let info: UpdateInfo = { available: false, apply: () => tryApply(true) };
  const setWaiting = (worker: ServiceWorker) => {
    waiting = worker;
    info = { available: true, apply: info.apply };
    listeners.forEach((l) => l());
  };

  const onInput = () => {
    lastInputAt = clock.now().getTime();
  };
  for (const type of ["pointerdown", "touchstart", "keydown"]) {
    window.addEventListener(type, onInput, { capture: true, passive: true });
  }

  const reload = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };
  sw.addEventListener("controllerchange", () => {
    // 처음 설치한 워커가 페이지를 맡을 때는 다시 열지 않습니다.
    if (!applyRequested || reloading) return;
    // 워커가 활성화를 마친 뒤에 다시 엽니다. 활성화 중(clients.claim)에 다시 열면
    // WebKit에서 워커가 "activating"에 멈출 수 있습니다. 끝나지 않아도 10초 뒤에는 다시 엽니다.
    const controller = sw.controller;
    if (!controller || controller.state === "activated") return reload();
    controller.addEventListener("statechange", () => {
      if (controller.state === "activated") reload();
    });
    window.setTimeout(reload, RELOAD_FALLBACK_MS);
  });

  sw.register(scriptUrl, { scope }).then(
    (reg) => {
      // 이미 활성 워커가 있을 때 설치를 마친 워커만 새 버전입니다.
      const track = (worker: ServiceWorker) => {
        const check = () => {
          if (worker.state === "installed" && reg.active && waiting !== worker) setWaiting(worker);
        };
        worker.addEventListener("statechange", check);
        check();
      };
      if (reg.waiting && reg.active) setWaiting(reg.waiting);
      // 페이지를 열 때 브라우저가 새 sw.js를 찾으면 등록이 끝나기 전에 설치가 시작됩니다.
      // 그때의 updatefound는 이미 지나갔으므로 설치 중인 워커를 직접 지켜봅니다.
      if (reg.installing) track(reg.installing);
      reg.addEventListener("updatefound", () => {
        if (reg.installing) track(reg.installing);
      });
      window.setInterval(() => {
        reg.update().catch(() => undefined);
      }, UPDATE_POLL_MS);
    },
    () => undefined,
  );

  window.setInterval(() => tryApply(false), CHECK_MS);

  return {
    current: () => info,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
