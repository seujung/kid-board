import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { makeClock } from "./clock";
import { idbStorage } from "./store/idb";
import { App } from "./ui/app";
import { startServiceWorker } from "./ui/display/updates";
import type { UpdateSource } from "./ui/display/updates";
import "./styles.css";
import "./ui/board/board.css";
import "./ui/board/tasks.css";
import "./ui/display/night.css";
import "./ui/parent/parent.css";

// 저장 공간을 지우지 않도록 요청합니다. 결과는 쓰지 않습니다(웹 설계 6.4.6).
try {
  void navigator.storage?.persist?.().catch(() => undefined);
} catch {
  // 지원하지 않는 브라우저입니다.
}

const clock = makeClock(window.location.search, import.meta.env.DEV);
const storage = idbStorage();

// 서비스 워커는 운영 빌드에서만 등록합니다. 개발 서버(Playwright 화면 확인)에는 영향을 주지 않습니다.
const updates: UpdateSource | null =
  import.meta.env.PROD && "serviceWorker" in navigator
    ? startServiceWorker(clock, `${import.meta.env.BASE_URL}sw.js`, import.meta.env.BASE_URL)
    : null;

function Root() {
  const [update, setUpdate] = useState(() => updates?.current());
  useEffect(() => updates?.subscribe(() => setUpdate(updates.current())), []);
  return <App storage={storage} clock={clock} update={update} />;
}

render(<Root />, document.getElementById("app")!);
