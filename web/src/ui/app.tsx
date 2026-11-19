import { useEffect, useState } from "preact/hooks";
import type { Clock } from "../clock";
import { BoardStore } from "../store/boardStore";
import type { DocStorage } from "../store/idb";
import { BoardView } from "./board/BoardView";

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

export function App({ storage, clock }: { storage: DocStorage; clock: Clock }) {
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
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
  return <BoardView store={boot.store} clock={clock} />;
}
