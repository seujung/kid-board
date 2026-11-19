import { render } from "preact";
import { makeClock } from "./clock";
import { idbStorage } from "./store/idb";
import { App } from "./ui/app";
import "./styles.css";
import "./ui/board/board.css";
import "./ui/board/tasks.css";
import "./ui/parent/parent.css";

// 저장 공간을 지우지 않도록 요청합니다. 결과는 쓰지 않습니다(웹 설계 6.4.6).
try {
  void navigator.storage?.persist?.().catch(() => undefined);
} catch {
  // 지원하지 않는 브라우저입니다.
}

const clock = makeClock(window.location.search, import.meta.env.DEV);
render(<App storage={idbStorage()} clock={clock} />, document.getElementById("app")!);
