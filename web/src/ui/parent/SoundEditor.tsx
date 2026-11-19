import { useState } from "preact/hooks";
import type { BoardStore } from "../../store/boardStore";
import type { SoundSettings, SoundVolume } from "../../store/schema";
import { playChime, playFanfare } from "../sound/sounds";
import { ErrorLine, Notice, errorText, useNotice } from "./common";

export const SOUND_FOOTNOTE = "iPad 음량 버튼과 제어 센터의 음소거 설정에 따라 소리가 작거나 들리지 않을 수 있어요.";

const VOLUMES: { volume: SoundVolume; label: string }[] = [
  { volume: "low", label: "작게" },
  { volume: "medium", label: "보통" },
  { volume: "high", label: "크게" },
];

/**
 * 완료 소리 설정입니다. 켜기와 크기는 바꾸는 즉시 저장합니다.
 * "들어 보기"는 "소리 켜기"와 관계없이 고른 크기로 한 번 울립니다.
 */
export function SoundEditor({ store }: { store: BoardStore }) {
  const [sound, setSound] = useState<SoundSettings>(() => store.settings().sound);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice] = useNotice();

  const save = async (next: SoundSettings) => {
    setSound(next);
    setError(null);
    try {
      await store.setSound(next);
      showNotice("저장했어요");
    } catch (err) {
      setSound(store.settings().sound);
      setError(errorText(err));
    }
  };

  return (
    <div class="p-section">
      <ErrorLine text={error} />
      <div class="p-list">
        <div class="p-row sound-row">
          <span class="p-row-title" id="sound-enabled-label">
            소리 켜기
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={sound.enabled}
            aria-labelledby="sound-enabled-label"
            class={sound.enabled ? "p-switch on" : "p-switch"}
            onClick={() => save({ ...sound, enabled: !sound.enabled })}
          >
            <span class="p-switch-knob" />
          </button>
        </div>
        <div class="p-row sound-row">
          <span class="p-row-title">크기</span>
          <div class="p-segment" role="radiogroup" aria-label="소리 크기">
            {VOLUMES.map((v) => (
              <button
                type="button"
                key={v.volume}
                role="radio"
                aria-checked={sound.volume === v.volume}
                class={sound.volume === v.volume ? "p-segment-item on" : "p-segment-item"}
                onClick={() => {
                  if (sound.volume !== v.volume) save({ ...sound, volume: v.volume });
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div class="p-button-row">
        <button type="button" class="p-button big" onClick={() => playChime(sound.volume)}>
          띵 들어 보기
        </button>
        <button type="button" class="p-button big" onClick={() => playFanfare(sound.volume)}>
          빵빠레 들어 보기
        </button>
      </div>
      <div class="p-footnote">{SOUND_FOOTNOTE}</div>
      <Notice text={notice} />
    </div>
  );
}
