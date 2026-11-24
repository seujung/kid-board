import { useEffect, useState } from "preact/hooks";
import { parseCalendarInput, shortCalendarSrc } from "../../core/calendar";
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

function appendParsedCalendars(
  existing: ChildCalendar[],
  rawInput: string,
  rawLabel: string,
): { ok: true; next: ChildCalendar[] } | { ok: false; message: string } {
  const parsed = parseCalendarInput(rawInput);
  if (!parsed.ok) return parsed;
  const label = rawLabel.trim();
  const seen = new Set(existing.map((c) => c.src));
  const added: ChildCalendar[] = [];
  for (const entry of parsed.entries) {
    if (seen.has(entry.src)) continue;
    seen.add(entry.src);
    added.push({
      id: defaultNewID(),
      src: entry.src,
      ctz: entry.ctz,
      label,
      color: entry.color,
    });
  }
  if (added.length === 0) {
    return { ok: false, message: "이미 등록된 캘린더예요." };
  }
  return { ok: true, next: existing.concat(added) };
}

function ChildForm(props: { store: BoardStore; draft: Draft; onDone: () => void }) {
  const { store } = props;
  const [draft, setDraft] = useState(props.draft);
  const [calLabel, setCalLabel] = useState("");
  const [calInput, setCalInput] = useState("");
  const [calError, setCalError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const name = draft.name.trim();
  const canSave = name.length > 0 && !busy;

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
    const res = appendParsedCalendars(draft.calendars, calInput, calLabel);
    if (!res.ok) {
      setCalError(res.message);
      return;
    }
    setCalError(null);
    setCalLabel("");
    setCalInput("");
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
      const res = appendParsedCalendars(calendars, calInput, calLabel);
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
        <span class="p-label">구글 캘린더 (오늘 일정)</span>
        {draft.calendars.length === 0 ? (
          <div class="cal-empty">등록된 캘린더가 없어요.</div>
        ) : (
          <div class="cal-list">
            {draft.calendars.map((cal) => {
              const title = cal.label || shortCalendarSrc(cal.src);
              return (
                <div class="cal-row" key={cal.id}>
                  {cal.color && <span class="cal-dot" style={{ background: cal.color }} />}
                  <div class="cal-info">
                    <div class="cal-title">{title}</div>
                    {cal.label && <div class="cal-src">{shortCalendarSrc(cal.src)}</div>}
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
          <input
            class="p-input cal-label-input"
            type="text"
            value={calLabel}
            placeholder="캘린더 이름 (예: 학교, 학원 — 비워도 돼요)"
            maxLength={20}
            aria-label="캘린더 이름"
            onInput={(e) => setCalLabel((e.currentTarget as HTMLInputElement).value)}
          />
          <textarea
            class="p-textarea"
            rows={3}
            value={calInput}
            placeholder='<iframe src="https://calendar.google.com/calendar/embed?src=..." ...></iframe>'
            aria-label="구글 캘린더 코드"
            onInput={(e) => {
              setCalError(null);
              setCalInput((e.currentTarget as HTMLTextAreaElement).value);
            }}
          />
          <div class="cal-add-actions">
            <button type="button" class="p-button" onClick={addCalendar}>
              ＋ 캘린더 추가
            </button>
          </div>
          <ErrorLine text={calError} />
          <div class="cal-guide">
            Google 캘린더 설정에서 공개로 켠 뒤 ‘퍼가기 코드(&lt;iframe ...&gt;)’ 또는 주소를 붙여 넣으세요. 여러 개를 등록할 수 있어요.
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
    </div>
  );
}
