import { useEffect, useRef, useState } from "preact/hooks";
import type { Clock } from "../clock";
import { BoardStore } from "../store/boardStore";
import type { DocStorage } from "../store/idb";
import { APP_VERSION } from "../version";
import { BoardView } from "./board/BoardView";
import { NightOverlay } from "./display/NightOverlay";
import type { WeatherState } from "./board/useWeather";
import { ParentMode } from "./parent/ParentMode";
import type { UpdateInfo } from "./parent/ParentHome";
import { SettingsButton } from "./parent/SettingsButton";

export const READ_ONLY_TITLE = "데이터를 열 수 없어요";
export const READ_ONLY_BODY =
  "저장된 데이터가 손상되었거나 더 새로운 버전에서 만들어졌어요. 부모님이 설치 안내의 '데이터 복구' 절차를 따라 주세요.";

type Boot = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; store: BoardStore };

/** 저장소를 열고 예시 데이터를 넣은 뒤 보드를 그립니다. */
async function openStore(storage: DocStorage, clock: Clock): Promise<BoardStore> {
  const store = await BoardStore.open(storage, () => clock.now());
  // 예시 데이터 저장이 실패해도 메모리에는 들어 있으므로 보드를 그립니다.
  if (store.status === "ok") await store.seedIfNeeded().catch(() => undefined);
  return store;
}

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <div class="full-message">
      <div class="full-message-title">{title}</div>
      {body && <div class="full-message-body">{body}</div>}
    </div>
  );
}

export interface AppProps {
  storage: DocStorage;
  clock: Clock;
  /** 새 버전 정보입니다. 운영 빌드에서 main.tsx가 서비스 워커와 연결합니다. 없으면 "새 버전 있음"을 표시하지 않습니다. */
  update?: UpdateInfo;
}

export function App({ storage, clock, update }: AppProps) {
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  /** 부모 모드가 열려 있는지입니다. 야간 막은 이 값이 참이면 어둡게 하지 않습니다. */
  const [parentOpen, setParentOpen] = useState(false);
  /** 보드가 쓰는 날씨 상태입니다. 부모 모드에서 지역을 바꾸면 이 상태의 `refreshNow`를 부릅니다. */
  const weather = useRef<WeatherState | null>(null);
  useEffect(() => {
    openStore(storage, clock).then(
      (store) => setBoot({ kind: "ready", store }),
      () => setBoot({ kind: "failed" }),
    );
  }, [storage, clock]);

  if (boot.kind === "loading") return <Message title="불러오는 중…" />;
  if (boot.kind === "failed" || boot.store.status === "readOnlyError") {
    return <Message title={READ_ONLY_TITLE} body={READ_ONLY_BODY} />;
  }
  const store = boot.store;
  return (
    <>
      <BoardView
        store={store}
        clock={clock}
        trailing={(ctx) => {
          weather.current = ctx.weather;
          return <SettingsButton onLongPress={() => setParentOpen(true)} />;
        }}
      />
      <NightOverlay clock={clock} parentOpen={parentOpen} />
      {parentOpen && (
        <ParentMode
          store={store}
          clock={clock}
          refreshWeather={() => weather.current?.refreshNow()}
          version={APP_VERSION}
          update={update}
          onClose={() => setParentOpen(false)}
        />
      )}
    </>
  );
}
