import { useEffect, useState } from "preact/hooks";
import {
  CALENDAR_COLOR_PRESETS,
  maskCalendarUrl,
  parseIcalUrlInput,
  parseProxyUrlInput,
} from "../../core/calendar";
import type { ChildCalendar, ChildInfo } from "../../core/domain";
import { defaultNewID } from "../../store/boardStore";
import type { BoardStore } from "../../store/boardStore";
import { MAX_PANELS } from "../board/BoardView";
import { themeNamed } from "../board/theme";
import { Confirm, DICTATION_HINT, ErrorLine, errorText } from "./common";

export const AVATARS = ["🐰", "🐻", "🐶", "🐱", "🐼", "🦊", "🐯", "🦁", "🐨", "🐸", "🐷", "🐵", "🐧", "🐥", "🦄", "🐳"];
export const THEME_CHOICES: { name: string; label: string }[] = [
  { name: "coral", label: "산호" },
  { name: "sky", label: "하늘" },
  { name: "mint", label: "민트" },
  { name: "lavender", label: "보라" },
  { name: "sunny", label: "해바라기" },
];

interface Draft {
  /** 새 자녀면 null입니다. */
  id: string | null;
  name: string;
  avatar: string;
  themeColor: string;
  order: number;
  calendars: ChildCalendar[];
}

function appendParsedCalendar(
  existing: ChildCalendar[],
  rawUrl: string,
  rawLabel: string,
  color: string,
): { ok: true; next: ChildCalendar[] } | { ok: false; message: string } {
  const parsed = parseIcalUrlInput(rawUrl);
  if (!parsed.ok) return parsed;
  if (existing.some((c) => c.url === parsed.url)) {
    return { ok: false, message: "이미 등록된 캘린더예요." };
  }
  const entry: ChildCalendar = {
    id: defaultNewID(),
    url: parsed.url,
    label: rawLabel.trim(),
    color,
  };
  return { ok: true, next: existing.concat([entry]) };
}

function ChildForm(props: { store: BoardStore; draft: Draft; onDone: () => void }) {
  const { store } = props;
  const [draft, setDraft] = useState(props.draft);
  const [calLabel, setCalLabel] = useState("");
  const [calInput, setCalInput] = useState("");
  const [calColor, setCalColor] = useState(
    CALENDAR_COLOR_PRESETS[props.draft.calendars.length % CALENDAR_COLOR_PRESETS.length]!,
  );
  const [calError, setCalError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const name = draft.name.trim();
  const canSave = name.length > 0 && !busy;
  const hasProxy = store.settings().calendarProxyUrl !== null;

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    work().then(
      () => {
        setBusy(false);
        props.onDone();
      },
      (err: unknown) => {
        setBusy(false);
        setError(errorText(err));
      },
    );
  };

  const addCalendar = () => {
    const res = appendParsedCalendar(draft.calendars, calInput, calLabel, calColor);
    if (!res.ok) {
      setCalError(res.message);
      return;
    }
    setCalError(null);
    setCalLabel("");
    setCalInput("");
    setCalColor(CALENDAR_COLOR_PRESETS[res.next.length % CALENDAR_COLOR_PRESETS.length]!);
    setDraft({ ...draft, calendars: res.next });
  };

  const removeCalendar = (calID: string) => {
    setCalError(null);
    setDraft({ ...draft, calendars: draft.calendars.filter((c) => c.id !== calID) });
  };

  const save = () => {
    if (!canSave) return;
    let calendars = draft.calendars;
    if (calInput.trim()) {
      const res = appendParsedCalendar(calendars, calInput, calLabel, calColor);
      if (!res.ok) {
        setCalError(res.message);
        return;
      }
      calendars = res.next;
    }
    run(() =>
      draft.id === null
        ? store.addChild(name, draft.avatar, draft.themeColor, calendars)
        : store.updateChild({
            id: draft.id,
            name,
            avatar: draft.avatar,
            themeColor: draft.themeColor,
            order: draft.order,
            calendars,
          }),
    );
  };

  return (
    <div class="p-form">
      <div class="p-form-head">
        <button type="button" class="p-button" onClick={props.onDone}>
          취소
        </button>
        <div class="p-form-title">{draft.id === null ? "자녀 추가" : "자녀 수정"}</div>
        <button type="button" class="p-button primary" disabled={!canSave} onClick={save}>
          저장
        </button>
      </div>
      <ErrorLine text={error} />
      <label class="p-field">
        <span class="p-label">이름</span>
        <input
          class="p-input"
          type="text"
          value={draft.name}
          placeholder="이름"
          maxLength={20}
          onInput={(e) => setDraft({ ...draft, name: (e.currentTarget as HTMLInputElement).value })}
        />
        <span class="p-hint">{DICTATION_HINT}</span>
      </label>
      <div class="p-field">
        <span class="p-label">아바타</span>
        <div class="emoji-grid">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              class={a === draft.avatar ? "emoji-choice on" : "emoji-choice"}
              aria-pressed={a === draft.avatar}
              onClick={() => setDraft({ ...draft, avatar: a })}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div class="p-field">
        <span class="p-label">테마 색</span>
        <div class="theme-choices">
          {THEME_CHOICES.map((t) => (
            <button
              type="button"
              key={t.name}
              class={t.name === draft.themeColor ? "theme-choice on" : "theme-choice"}
              aria-pressed={t.name === draft.themeColor}
              onClick={() => setDraft({ ...draft, themeColor: t.name })}
            >
              <span class="theme-swatch" style={{ background: themeNamed(t.name).accent }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div class="p-field">
        <span class="p-label">구글 캘린더 (iCal 비공개 주소)</span>
        {!hasProxy && (
          <div class="cal-warn">
            자녀 관리 화면 아래에서 ‘캘린더 프록시 주소’를 먼저 등록하면 보드에 오늘 일정이 보여요.
          </div>
        )}
        {draft.calendars.length === 0 ? (
          <div class="cal-empty">등록된 캘린더가 없어요.</div>
        ) : (
          <div class="cal-list">
            {draft.calendars.map((cal) => {
              const title = cal.label || maskCalendarUrl(cal.url);
              return (
                <div class="cal-row" key={cal.id}>
                  <span class="cal-dot" style={{ background: cal.color ?? "#3B82C4" }} />
                  <div class="cal-info">
                    <div class="cal-title">{title}</div>
                    {cal.label && <div class="cal-src">{maskCalendarUrl(cal.url)}</div>}
                  </div>
                  <button
                    type="button"
                    class="p-small-button danger"
                    aria-label={`${title} 캘린더 삭제`}
                    onClick={() => removeCalendar(cal.id)}
                  >
                    삭제
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div class="cal-add-box">
          <div class="cal-add-top">
            <input
              class="p-input cal-label-input"
              type="text"
              value={calLabel}
              placeholder="캘린더 이름 (예: 학교, 학원 — 비워도 돼요)"
              maxLength={20}
              aria-label="캘린더 이름"
              onInput={(e) => setCalLabel((e.currentTarget as HTMLInputElement).value)}
            />
            <div class="cal-color-choices">
              {CALENDAR_COLOR_PRESETS.map((c, idx) => (
                <button
                  type="button"
                  key={c}
                  class={calColor === c ? "cal-color-btn on" : "cal-color-btn"}
                  style={{ background: c }}
                  aria-label={`색 ${idx + 1}`}
                  aria-pressed={calColor === c}
                  onClick={() => setCalColor(c)}
                />
              ))}
            </div>
          </div>
          <input
            class="p-input cal-url-input"
            type="url"
            value={calInput}
            placeholder="https://calendar.google.com/calendar/ical/.../private-.../basic.ics"
            aria-label="구글 캘린더 iCal 주소"
            onInput={(e) => {
              setCalError(null);
              setCalInput((e.currentTarget as HTMLInputElement).value);
            }}
          />
          <div class="cal-add-actions">
            <button type="button" class="p-button" onClick={addCalendar}>
              ＋ 캘린더 추가
            </button>
          </div>
          <ErrorLine text={calError} />
          <div class="cal-guide">
            Google 캘린더 설정 &gt; 캘린더 통합에서 ‘iCal 형식의 비공개 주소’를 복사해 붙여 넣으세요. 여러 개를 등록할 수 있어요.
          </div>
        </div>
      </div>
      {draft.id !== null && (
        <button type="button" class="p-button danger" onClick={() => setConfirmDelete(true)}>
          이 자녀 삭제
        </button>
      )}
      {confirmDelete && draft.id !== null && (
        <Confirm
          title={`${props.draft.name}을(를) 삭제할까요?`}
          body="이 자녀의 할 일, 시각 설정, 완료 기록이 모두 지워져요."
          confirmLabel="삭제"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            const id = draft.id as string;
            run(() => store.deleteChild(id));
          }}
        />
      )}
    </div>
  );
}

/** 자녀 관리입니다. 추가, 수정, 삭제와 표시 순서 바꾸기를 합니다. */
export function ChildrenEditor({ store }: { store: BoardStore }) {
  const [, setVersion] = useState(0);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proxyInput, setProxyInput] = useState(() => store.settings().calendarProxyUrl ?? "");
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [proxyMessage, setProxyMessage] = useState<string | null>(null);
  const [proxyBusy, setProxyBusy] = useState(false);

  useEffect(() => store.subscribe(() => setVersion((v) => v + 1)), [store]);
  const children = store.snapshot().children;

  if (editing) return <ChildForm store={store} draft={editing} onDone={() => setEditing(null)} />;

  const move = (from: number, to: number) => {
    setError(null);
    store.moveChild(from, to).catch((err: unknown) => setError(errorText(err)));
  };
  const edit = (c: ChildInfo) => setEditing({ ...c, calendars: c.calendars.map((cal) => ({ ...cal })) });
  const add = () =>
    setEditing({
      id: null,
      name: "",
      avatar: AVATARS[0] as string,
      themeColor: (THEME_CHOICES[0] as { name: string }).name,
      order: children.length,
      calendars: [],
    });

  const saveProxy = () => {
    if (proxyBusy) return;
    const parsed = parseProxyUrlInput(proxyInput);
    if (!parsed.ok) {
      setProxyMessage(null);
      setProxyError(parsed.message);
      return;
    }
    setProxyError(null);
    setProxyMessage(null);
    setProxyBusy(true);
    store.setCalendarProxyUrl(parsed.url).then(
      () => {
        setProxyBusy(false);
        setProxyInput(parsed.url ?? "");
        setProxyMessage(parsed.url ? "프록시 주소를 저장했어요" : "프록시 주소를 지웠어요");
      },
      (err: unknown) => {
        setProxyBusy(false);
        setProxyError(errorText(err));
      },
    );
  };

  return (
    <div class="p-section">
      <ErrorLine text={error} />
      <div class="p-list">
        {children.map((c, i) => (
          <div class="p-row" key={c.id}>
            <button type="button" class="p-row-main" onClick={() => edit(c)}>
              <span class="p-row-icon">{c.avatar}</span>
              <span class="p-row-title">{c.name}</span>
              {c.calendars.length > 0 && <span class="p-row-sub">캘린더 {c.calendars.length}개</span>}
              <span class="theme-swatch small" style={{ background: themeNamed(c.themeColor).accent }} />
              {i >= MAX_PANELS && <span class="p-row-sub">보드에 안 보여요</span>}
            </button>
            <button
              type="button"
              class="p-icon-button"
              aria-label="위로"
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
            >
              ▲
            </button>
            <button
              type="button"
              class="p-icon-button"
              aria-label="아래로"
              disabled={i === children.length - 1}
              onClick={() => move(i, i + 1)}
            >
              ▼
            </button>
          </div>
        ))}
      </div>
      <button type="button" class="p-add" onClick={add}>
        ＋ 자녀 추가
      </button>
      <div class="p-footnote">보드에는 위에서부터 {MAX_PANELS}명만 보여요. ▲▼로 순서를 바꿀 수 있어요.</div>

      <div class="cal-proxy-section">
        <div class="cal-proxy-title">구글 캘린더 프록시 주소</div>
        <div class="cal-proxy-row">
          <input
            class="p-input cal-proxy-input"
            type="url"
            value={proxyInput}
            placeholder="https://script.google.com/macros/s/.../exec"
            aria-label="캘린더 프록시 주소"
            onInput={(e) => {
              setProxyError(null);
              setProxyMessage(null);
              setProxyInput((e.currentTarget as HTMLInputElement).value);
            }}
          />
          <button type="button" class="p-button primary" disabled={proxyBusy} onClick={saveProxy}>
            저장
          </button>
        </div>
        <ErrorLine text={proxyError} />
        {proxyMessage && (
          <div class="p-ok" role="status">
            {proxyMessage}
          </div>
        )}
        <div class="cal-guide">
          비공개 iCal 주소를 불러오려면 개인 프록시(Google Apps Script 또는 Cloudflare Worker) 주소가 필요해요. 자세한 방법은 설치 안내(INSTALL.md)를 참고하세요.
        </div>
      </div>
    </div>
  );
}
