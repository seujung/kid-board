export type ParentScreen =
  | "children"
  | "tasks"
  | "times"
  | "dim"
  | "sound"
  | "weather"
  | "history"
  | "backup"
  | "changePin"
  | "recoveryCode";

/** 메뉴 순서는 브리프에 정한 순서입니다. */
export const PARENT_MENU: { screen: ParentScreen; title: string; icon: string }[] = [
  { screen: "children", title: "자녀 관리", icon: "👧" },
  { screen: "tasks", title: "할 일 관리", icon: "✅" },
  { screen: "times", title: "시각 설정", icon: "⏰" },
  { screen: "dim", title: "화면 끄기 시간", icon: "🌙" },
  { screen: "sound", title: "소리", icon: "🔔" },
  { screen: "weather", title: "날씨 지역", icon: "🌤️" },
  { screen: "history", title: "완료 기록", icon: "📅" },
  { screen: "backup", title: "백업", icon: "💾" },
  { screen: "changePin", title: "PIN 변경", icon: "🔒" },
  { screen: "recoveryCode", title: "복구 코드 새로 만들기", icon: "🔑" },
];

export function screenTitle(screen: ParentScreen): string {
  for (const item of PARENT_MENU) if (item.screen === screen) return item.title;
  return "";
}

/** Task 10이 연결하는 새 버전 정보입니다. */
export interface UpdateInfo {
  available: boolean;
  apply: () => void;
}

export interface ParentHomeProps {
  version: string;
  update?: UpdateInfo;
  /** 마지막 백업 후 7일 이상 지났으면 그 날 수입니다. */
  backupOverdueDays: number | null;
  notice: string | null;
  onOpen: (screen: ParentScreen) => void;
}

/** 부모 모드 첫 화면입니다. 위쪽에 버전과 안내, 아래쪽에 메뉴를 둡니다. */
export function ParentHome(props: ParentHomeProps) {
  return (
    <div class="p-home">
      <div class="p-home-status">
        <span class="p-version">현재 버전 {props.version}</span>
        {props.update?.available && (
          <span class="p-update">
            <span class="p-update-label">새 버전 있음</span>
            <button type="button" class="p-button primary" onClick={props.update.apply}>
              새 버전 적용
            </button>
          </span>
        )}
      </div>
      {props.backupOverdueDays !== null && (
        <div class="p-warning">백업한 지 {props.backupOverdueDays}일 지났어요</div>
      )}
      {props.notice && (
        <div class="p-notice inline" role="status">
          {props.notice}
        </div>
      )}
      <div class="p-menu">
        {PARENT_MENU.map((item) => (
          <button type="button" key={item.screen} class="p-menu-item" onClick={() => props.onOpen(item.screen)}>
            <span class="p-menu-icon">{item.icon}</span>
            <span class="p-menu-title">{item.title}</span>
            <span class="p-menu-chevron">›</span>
          </button>
        ))}
      </div>
      <div class="p-footnote">2분 동안 아무것도 누르지 않으면 보드로 돌아가요.</div>
    </div>
  );
}
