import { useEffect, useRef, useState } from "preact/hooks";
import { jsonFetcher, searchPlaces } from "../../core/weather";
import type { Fetcher, GeoPlace } from "../../core/weather";
import type { BoardStore } from "../../store/boardStore";
import { ErrorLine, errorText } from "./common";
import { placeLabel } from "./format";

type Status =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "empty" }
  | { kind: "failed" }
  | { kind: "saved"; label: string };

function samePlace(a: GeoPlace | null, b: GeoPlace): boolean {
  return a !== null && a.name === b.name && a.latitude === b.latitude && a.longitude === b.longitude;
}

/** 날씨 지역입니다. 검색해서 고르면 저장하고 보드의 날씨를 바로 다시 가져옵니다. */
export function LocationPicker(props: { store: BoardStore; refreshWeather: () => void; fetcher?: Fetcher }) {
  const { store } = props;
  const fetcher = props.fetcher ?? jsonFetcher;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const searchID = useRef(0);
  useEffect(
    () => () => {
      searchID.current++;
    },
    [],
  );
  const current = store.settings().location;

  const search = (e?: Event) => {
    e?.preventDefault();
    const text = query.trim();
    if (!text) return;
    const id = ++searchID.current;
    setStatus({ kind: "searching" });
    searchPlaces(fetcher, text).then(
      (found) => {
        if (id !== searchID.current) return;
        setResults(found);
        setStatus(found.length === 0 ? { kind: "empty" } : { kind: "idle" });
      },
      () => {
        if (id !== searchID.current) return;
        setResults([]);
        setStatus({ kind: "failed" });
      },
    );
  };

  const choose = (place: GeoPlace) => {
    setError(null);
    store.setLocation(place).then(
      () => {
        props.refreshWeather();
        setStatus({ kind: "saved", label: placeLabel(place) });
      },
      (err: unknown) => setError(errorText(err)),
    );
  };

  return (
    <div class="p-section">
      <div class="p-group">
        <div class="p-group-title">지금 지역</div>
        <div class="p-current">{current ? placeLabel(current) : "아직 정하지 않았어요"}</div>
      </div>
      <form class="p-search" onSubmit={search}>
        <input
          class="p-input"
          type="search"
          value={query}
          placeholder="지역 이름 (예: 성남)"
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
        <button type="submit" class="p-button primary" disabled={query.trim() === ""}>
          검색
        </button>
      </form>
      <ErrorLine text={error} />
      <div class="p-status">
        {status.kind === "searching" && "찾는 중이에요…"}
        {status.kind === "empty" && "검색 결과가 없어요. 다른 이름으로 찾아 주세요."}
        {status.kind === "failed" && <span class="p-error-text">검색하지 못했어요. 인터넷 연결을 확인해 주세요.</span>}
        {status.kind === "saved" && <span class="p-ok-text">{status.label}(으)로 바꿨어요. 날씨를 새로 가져와요.</span>}
      </div>
      {results.length > 0 && (
        <div class="p-list">
          {results.map((place, i) => (
            <div class="p-row" key={i}>
              <button type="button" class="p-row-main place-result" onClick={() => choose(place)}>
                <span class="p-row-title">{placeLabel(place)}</span>
                {samePlace(current, place) && <span class="p-check-mark">✓</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
