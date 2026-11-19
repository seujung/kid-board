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
import { RestoreInput } from "./parent/restorePick";
import type { RestorePick } from "./parent/restorePick";
import { SettingsButton } from "./parent/SettingsButton";

export const READ_ONLY_TITLE = "데이터를 열 수 없어요";
export const READ_ONLY_BODY =
  "저장된 데이터가 손상되었거나 더 새로운 버전에서 만들어졌어요. 부모님이 설치 안내의 '데이터 복구' 절차를 따라 주세요.";

/** 저장소를 열지 못했을 때(열기 오류, 시간 초과)입니다. 데이터가 손상되었다는 뜻이 아니므로 지우라고 하지 않습니다. */
export const LOAD_FAILED_TITLE = "데이터를 불러오지 못했어요";
export const LOAD_FAILED_BODY = "잠시 후 다시 해 주세요. 계속 안 되면 앱을 완전히 닫았다가 다시 여십시오.";
export const RETRY_LABEL = "다시 시도";

type Boot = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; store: BoardStore };

/** 저장소를 열고 예시 데이터를 넣은 뒤 보드를 그립니다. */
async function openStore(storage: DocStorage, clock: Clock): Promise<BoardStore> {
  const store = await BoardStore.open(storage, () => clock.now());
  // 예시 데이터 저장이 실패하면 메모리도 빈 문서로 돌아갑니다. 다음에 열 때 다시 넣습니다.
  if (store.status === "ok") await store.seedIfNeeded().catch(() => undefined);
  return store;
}

function Message({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  return (
    <div class="full-message">
      <div class="full-message-title">{title}</div>
      {body && <div class="full-message-body">{body}</div>}
      {onRetry && (
        <button type="button" class="full-message-button" onClick={onRetry}>
          {RETRY_LABEL}
        </button>
      )}
    </div>
  );
}

export interface AppProps {
  storage: DocStorage;
  clock: Clock;
  /** 새 버전 정보입니다. 운영 빌드에서 main.tsx가 서비스 워커와 연결합니다. 없으면 "새 버전 있음"을 표시하지 않습니다. */
  update?: UpdateInfo;
  /** 저장소를 연 뒤 한 번 부릅니다. main.tsx가 새 버전 적용 조건에 화면 끄기 시간을 쓰려고 받습니다. */
  onStore?: (store: BoardStore) => void;
}

export function App({ storage, clock, update, onStore }: AppProps) {
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  /** 부모 모드가 열려 있는지입니다. 야간 막은 이 값이 참이면 어둡게 하지 않습니다. */
  const [parentOpen, setParentOpen] = useState(false);
  /** 복원하려고 고른 백업 파일입니다. 부모 모드가 닫힌 뒤에 와도 버리지 않고 부모 모드를 다시 엽니다. */
  const [restorePick, setRestorePick] = useState<RestorePick | null>(null);
  /** 보드가 쓰는 날씨 상태입니다. 부모 모드에서 지역을 바꾸면 이 상태의 `refreshNow`를 부릅니다. */
  const weather = useRef<WeatherState | null>(null);
  /** "다시 시도"를 누를 때마다 올려 저장소를 다시 엽니다. */
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    openStore(storage, clock).then(
      (store) => {
        if (!live) return;
        onStore?.(store);
        // 열기 실패는 일시적인 문제이므로 손상 화면 대신 다시 시도 화면을 보여 줍니다.
        setBoot(store.errorReason === "loadFailed" ? { kind: "failed" } : { kind: "ready", store });
      },
      () => {
        if (live) setBoot({ kind: "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [storage, clock, attempt]);

  if (boot.kind === "loading") return <Message title="불러오는 중…" />;
  if (boot.kind === "failed") {
    const retry = () => {
      setBoot({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return <Message title={LOAD_FAILED_TITLE} body={LOAD_FAILED_BODY} onRetry={retry} />;
  }
  if (boot.store.status === "readOnlyError") {
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
          return <SettingsButton onOpen={() => setParentOpen(true)} />;
        }}
      />
      <NightOverlay clock={clock} parentOpen={parentOpen} store={store} />
      <RestoreInput
        onPick={(pick) => {
          setRestorePick(pick);
          setParentOpen(true);
        }}
      />
      {parentOpen && (
        <ParentMode
          store={store}
          clock={clock}
          refreshWeather={() => weather.current?.refreshNow()}
          version={APP_VERSION}
          update={update}
          restorePick={restorePick}
          onRestorePickHandled={() => setRestorePick(null)}
          onClose={() => {
            setParentOpen(false);
            setRestorePick(null);
          }}
        />
      )}
    </>
  );
}
