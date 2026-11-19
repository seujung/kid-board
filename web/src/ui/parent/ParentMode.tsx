import { useRef, useState } from "preact/hooks";
import type { Clock } from "../../clock";
import { IDLE_TIMEOUT_MS } from "../../core/parentLock";
import type { BoardStore } from "../../store/boardStore";
import { BackupPanel } from "./BackupPanel";
import { ChildrenEditor } from "./ChildrenEditor";
import { TopBar, useNotice } from "./common";
import { backupOverdueDays } from "./format";
import { History } from "./History";
import { LocationPicker } from "./LocationPicker";
import { ParentGate } from "./ParentGate";
import { ParentHome, screenTitle } from "./ParentHome";
import type { ParentScreen, UpdateInfo } from "./ParentHome";
import { PinSetup } from "./PinSetup";
import { RecoveryCodeShow } from "./RecoveryCodeShow";
import { RecoveryEntry } from "./RecoveryEntry";
import { RecoveryRegenerate } from "./RecoveryRegenerate";
import { TasksEditor } from "./TasksEditor";
import { TimesEditor } from "./TimesEditor";
import { useIdle } from "./useIdle";

type Stage =
  | { kind: "gate" }
  | { kind: "recovery" }
  /** 처음 PIN을 정하면 복구 코드를 만들고, 복구 코드로 들어오면 PIN만 바꿉니다. */
  | { kind: "setup"; first: boolean }
  | { kind: "code"; code: string }
  | { kind: "home" };

export interface ParentModeProps {
  store: BoardStore;
  clock: Clock;
  /** 보드의 `useWeather`가 날씨를 바로 다시 가져오게 합니다. */
  refreshWeather: () => void;
  version: string;
  update?: UpdateInfo;
  onClose: () => void;
}

/**
 * 보드 위에 전체 화면으로 띄우는 부모 모드입니다(기존 설계 7.5, 웹 설계 6.5, 6.10).
 * PIN 확인(또는 첫 PIN 설정, 복구 코드로 PIN 다시 정하기)을 거친 뒤 메뉴를 엽니다.
 * 어느 화면에서든 2분 동안 입력이 없으면 `onClose`를 부릅니다. 저장하지 않은 입력은 버립니다.
 */
export function ParentMode(props: ParentModeProps) {
  const { store, clock, onClose } = props;
  const root = useRef<HTMLDivElement>(null);
  const newCode = useRef("");
  const [stage, setStage] = useState<Stage>(() => (store.hasPin ? { kind: "gate" } : { kind: "setup", first: true }));
  const [screen, setScreen] = useState<ParentScreen | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [notice, showNotice] = useNotice();
  useIdle(root, IDLE_TIMEOUT_MS, onClose);

  const open = (next: ParentScreen | null) => {
    setPinVerified(false);
    setScreen(next);
  };

  let content;
  if (stage.kind === "gate") {
    content = (
      <ParentGate
        store={store}
        clock={clock}
        onSuccess={() => setStage({ kind: "home" })}
        onForgot={() => setStage({ kind: "recovery" })}
        onCancel={onClose}
      />
    );
  } else if (stage.kind === "recovery") {
    content = (
      <RecoveryEntry
        store={store}
        clock={clock}
        onSuccess={() => setStage({ kind: "setup", first: false })}
        onCancel={() => setStage({ kind: "gate" })}
      />
    );
  } else if (stage.kind === "setup") {
    content = stage.first ? (
      <PinSetup
        save={async (pin) => {
          newCode.current = await store.setPin(pin);
        }}
        onDone={() => setStage({ kind: "code", code: newCode.current })}
        onCancel={onClose}
      />
    ) : (
      <PinSetup
        save={(pin) => store.changePin(pin)}
        onDone={() => {
          setStage({ kind: "home" });
          showNotice("새 PIN을 저장했어요");
        }}
        onCancel={onClose}
      />
    );
  } else if (stage.kind === "code") {
    content = <RecoveryCodeShow code={stage.code} onDone={() => setStage({ kind: "home" })} />;
  } else if (screen === null) {
    content = (
      <>
        <TopBar title="부모 모드" onClose={onClose} />
        <div class="p-body">
          <ParentHome
            version={props.version}
            update={props.update}
            backupOverdueDays={backupOverdueDays(store.settings().lastBackupAt, clock.now().getTime())}
            notice={notice}
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
      case "weather":
        body = <LocationPicker store={store} refreshWeather={props.refreshWeather} />;
        break;
      case "history":
        body = <History store={store} clock={clock} />;
        break;
      case "backup":
        body = <BackupPanel store={store} clock={clock} />;
        break;
      case "changePin":
        body = pinVerified ? (
          <PinSetup
            save={(pin) => store.changePin(pin)}
            onDone={() => {
              back();
              showNotice("PIN을 바꿨어요");
            }}
          />
        ) : (
          <ParentGate
            store={store}
            clock={clock}
            title="지금 쓰는 PIN을 입력해 주세요"
            onSuccess={() => setPinVerified(true)}
          />
        );
        break;
      case "recoveryCode":
        body = <RecoveryRegenerate store={store} onDone={back} />;
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
