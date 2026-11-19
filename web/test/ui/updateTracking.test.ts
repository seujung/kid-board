import { afterEach, expect, test, vi } from "vitest";
import { startServiceWorker } from "../../src/ui/display/updates";

class FakeWorker extends EventTarget {
  constructor(public state: ServiceWorkerState) {
    super();
  }
  postMessage() {}
  become(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  active: FakeWorker | null = new FakeWorker("activated");
  update() {
    return Promise.resolve();
  }
}

function stubBrowser(reg: FakeRegistration) {
  const sw = Object.assign(new EventTarget(), {
    controller: reg.active,
    register: () => Promise.resolve(reg),
  });
  vi.stubGlobal("navigator", { serviceWorker: sw });
  vi.stubGlobal("window", {
    addEventListener() {},
    setInterval: () => 0,
    setTimeout: () => 0,
    location: { reload() {} },
  });
}

const clock = { now: () => new Date("2026-11-19T12:00:00+09:00") };

afterEach(() => {
  vi.unstubAllGlobals();
});

test("tracksWorkerAlreadyInstallingAtRegistration", async () => {
  const reg = new FakeRegistration();
  const worker = new FakeWorker("installing");
  // 페이지를 열 때 브라우저가 이미 새 sw.js를 찾아 설치를 시작했습니다(updatefound는 이미 지나갔습니다).
  reg.installing = worker;
  stubBrowser(reg);
  const updates = startServiceWorker(clock, "/kid-board/sw.js", "/kid-board/");
  await Promise.resolve();
  await Promise.resolve();
  expect(updates.current().available).toBe(false);
  reg.installing = null;
  reg.waiting = worker;
  worker.become("installed");
  expect(updates.current().available).toBe(true);
});

test("tracksWorkerFoundLater", async () => {
  const reg = new FakeRegistration();
  stubBrowser(reg);
  const updates = startServiceWorker(clock, "/kid-board/sw.js", "/kid-board/");
  await Promise.resolve();
  await Promise.resolve();
  const worker = new FakeWorker("installing");
  reg.installing = worker;
  reg.dispatchEvent(new Event("updatefound"));
  worker.become("installed");
  expect(updates.current().available).toBe(true);
});

test("firstInstallIsNotAnUpdate", async () => {
  const reg = new FakeRegistration();
  reg.active = null;
  const worker = new FakeWorker("installing");
  reg.installing = worker;
  stubBrowser(reg);
  const updates = startServiceWorker(clock, "/kid-board/sw.js", "/kid-board/");
  await Promise.resolve();
  await Promise.resolve();
  worker.become("installed");
  expect(updates.current().available).toBe(false);
});
