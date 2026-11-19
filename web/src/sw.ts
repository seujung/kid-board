/*
 * 할 일 보드 서비스 워커입니다(웹 설계 6.7).
 * vite.config.ts의 `serviceWorker` 플러그인이 이 파일을 dist/sw.js로 따로 빌드하고,
 * 아래 두 상수에 이번 빌드의 파일 목록과 캐시 이름을 넣습니다.
 *
 * - 설치: 빌드 결과 파일을 모두 미리 받아 캐시합니다. 설치를 마쳐도 `waiting`으로 기다립니다.
 * - 앱이 `{type: "SKIP_WAITING"}`을 보낼 때만 바로 활성화합니다.
 *   앱을 닫았다 다시 열면 브라우저 기본 동작대로 새 워커가 활성화됩니다.
 * - 활성화: 이전 빌드의 캐시를 지웁니다.
 * - 같은 출처 GET 요청: 캐시 우선, 없으면 네트워크. 오프라인 화면 이동은 캐시한 index.html을 줍니다.
 * - 다른 출처 요청(Open-Meteo 날씨, 지역 검색)은 가로채지 않습니다.
 *
 * Safari 15에서 동작해야 합니다. 모듈 워커가 아니므로 import/export를 쓰지 않습니다.
 */

declare const __PRECACHE__: string[];
declare const __CACHE_NAME__: string;

// 타입 검사는 DOM 라이브러리로 하므로 서비스 워커 전역에 필요한 부분만 적습니다.
interface SwExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface SwFetchEvent extends SwExtendableEvent {
  readonly request: Request;
  respondWith(response: Promise<Response> | Response): void;
}
interface SwMessageEvent extends SwExtendableEvent {
  readonly data: unknown;
}
interface SwGlobal {
  addEventListener(type: "install" | "activate", listener: (event: SwExtendableEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: SwFetchEvent) => void): void;
  addEventListener(type: "message", listener: (event: SwMessageEvent) => void): void;
  skipWaiting(): Promise<void>;
  readonly clients: { claim(): Promise<void> };
  readonly registration: { readonly scope: string };
  readonly location: Location;
}

const sw = self as unknown as SwGlobal;
const CACHE_PREFIX = "kid-board-";
const CACHE = __CACHE_NAME__;
/** 워커 범위 주소입니다. 예: https://example.github.io/kid-board/ */
const SCOPE = sw.registration.scope;
const INDEX = new URL("index.html", SCOPE).href;

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // HTTP 캐시에 남은 이전 파일을 받지 않도록 네트워크에서 다시 받습니다.
      cache.addAll(__PRECACHE__.map((url) => new Request(url, { cache: "reload" }))),
    ),
  );
});

sw.addEventListener("message", (event) => {
  const data = event.data as { type?: unknown } | null;
  if (data && data.type === "SKIP_WAITING") void sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => sw.clients.claim()),
  );
});

async function respond(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  const navigate = request.mode === "navigate";
  // `?fixedNow=`처럼 검색어가 붙은 화면 이동도 캐시한 페이지를 씁니다.
  const hit = await cache.match(request, { ignoreSearch: navigate });
  if (hit) return hit;
  try {
    return await fetch(request);
  } catch (error) {
    if (navigate) {
      const index = await cache.match(INDEX);
      if (index) return index;
    }
    throw error;
  }
}

sw.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== sw.location.origin) return;
  event.respondWith(respond(request));
});
