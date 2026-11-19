import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Clock } from "../../clock";
import { IDLE_TIMEOUT_MS } from "../../core/parentLock";
import type { BoardStore } from "../../store/boardStore";
import { BackupPanel } from "./BackupPanel";
import { ChildrenEditor } from "./ChildrenEditor";
import { DimPeriodsEditor } from "./DimPeriodsEditor";
import { TopBar } from "./common";
import { backupOverdueDays } from "./format";
import { History } from "./History";
import { LocationPicker } from "./LocationPicker";
import { ParentHome, screenTitle } from "./ParentHome";
import type { ParentScreen, UpdateInfo } from "./ParentHome";
import type { RestorePick } from "./restorePick";
import { SoundEditor } from "./SoundEditor";
import { TasksEditor } from "./TasksEditor";
import { TimesEditor } from "./TimesEditor";
import { useIdle } from "./useIdle";

export interface ParentModeProps {
  store: BoardStore;
  clock: Clock;
  /** 보드의 `useWeather`가 날씨를 바로 다시 가져오게 합니다. */
  refreshWeather: () => void;
  version: string;
  update?: UpdateInfo;
  onClose: () => void;
  /** 앱 최상위의 복원 입력 칸에서 고른 파일입니다. 백업 화면에서 확인 창을 보여 줍니다. */
  restorePick?: RestorePick | null;
  onRestorePickHandled?: () => void;
}

/**
 * 보드 위에 전체 화면으로 띄우는 부모 모드입니다(기존 설계 7.5, 웹 설계 6.5, 6.10).
 * 설정 아이콘을 누르면 바로 메뉴를 엽니다. PIN은 묻지 않습니다.
 * 어느 화면에서든 2분 동안 입력이 없으면 `onClose`를 부릅니다. 저장하지 않은 입력은 버립니다.
 * 공유 시트와 파일 선택이 열린 동안에는 이 시간을 세지 않습니다.
 */
export function ParentMode(props: ParentModeProps) {
  const { store, clock, onClose } = props;
  const root = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<ParentScreen | null>(null);
  const [holds, setHolds] = useState<string[]>([]);
  const hold = useCallback((key: string, on: boolean) => {
    setHolds((h) => (on ? (h.indexOf(key) >= 0 ? h : h.concat([key])) : h.filter((k) => k !== key)));
  }, []);
  useIdle(root, IDLE_TIMEOUT_MS, onClose, holds.length > 0);

  // 복원할 파일이 오면 백업 화면으로 갑니다.
  const restorePick = props.restorePick ?? null;
  useEffect(() => {
    if (restorePick && screen !== "backup") setScreen("backup");
  }, [restorePick, screen]);

  const open = (next: ParentScreen | null) => setScreen(next);

  let content;
  if (screen === null) {
    content = (
      <>
        <TopBar title="부모 모드" onClose={onClose} />
        <div class="p-body">
          <ParentHome
            version={props.version}
            update={props.update}
            backupOverdueDays={backupOverdueDays(store.settings().lastBackupAt, clock.now().getTime())}
            onOpen={open}
          />
        </div>
      </>
    );
  } else {
    const back = () => open(null);
    let body;
    switch (screen) {
      case "children":
        body = <ChildrenEditor store={store} />;
        break;
      case "tasks":
        body = <TasksEditor store={store} />;
        break;
      case "times":
        body = <TimesEditor store={store} />;
        break;
      case "dim":
        body = <DimPeriodsEditor store={store} />;
        break;
      case "sound":
        body = <SoundEditor store={store} />;
        break;
      case "weather":
        body = <LocationPicker store={store} refreshWeather={props.refreshWeather} />;
        break;
      case "history":
        body = <History store={store} clock={clock} />;
        break;
      case "backup":
        body = (
          <BackupPanel
            store={store}
            clock={clock}
            onHold={hold}
            restorePick={restorePick}
            onPickHandled={props.onRestorePickHandled}
          />
        );
        break;
    }
    content = (
      <>
        <TopBar title={screenTitle(screen)} onBack={back} onClose={onClose} />
        <div class="p-body" key={screen}>
          {body}
        </div>
      </>
    );
  }

  return (
    <div class="parent" ref={root} role="dialog" aria-label="부모 모드">
      {content}
    </div>
  );
}
