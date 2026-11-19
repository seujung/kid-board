import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Clock } from "../../clock";
import { REFRESH_MS, fetchForecast, jsonFetcher, weatherDisplay } from "../../core/weather";
import type { Fetcher, WeatherDisplay } from "../../core/weather";
import type { BoardStore } from "../../store/boardStore";

export interface WeatherState {
  display: WeatherDisplay | "noLocation";
  refreshNow(): void;
}

/**
 * 날씨를 30분마다 새로 가져와 `store.setWeather`로 저장합니다.
 * 지역이 없으면 `"noLocation"`이고 요청하지 않습니다. 지역이 바뀌면 진행 중 요청을 취소하고 바로 다시 가져옵니다.
 * `display`는 그릴 때마다 저장된 날씨와 현재 시각으로 다시 정합니다(오래된 날씨 표시).
 */
export function useWeather(store: BoardStore, clock: Clock, fetcher: Fetcher = jsonFetcher): WeatherState {
  const [, setVersion] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const location = store.settings().location;
  const locationKey = location ? `${location.latitude},${location.longitude}` : null;

  useEffect(() => store.subscribe(() => setVersion((v) => v + 1)), [store]);

  const fetchNow = useCallback(() => {
    controller.current?.abort();
    const place = store.settings().location;
    if (!place) {
      controller.current = null;
      return;
    }
    const ctrl = new AbortController();
    controller.current = ctrl;
    fetchForecast(fetcher, place.latitude, place.longitude, clock.now().getTime(), ctrl.signal)
      .then((snap) => {
        if (ctrl.signal.aborted) return;
        controller.current = null;
        return store.setWeather(snap);
      })
      .catch(() => {
        // 실패하면 마지막 날씨를 그대로 씁니다.
      });
  }, [store, clock, fetcher]);

  useEffect(() => {
    if (locationKey === null) return;
    fetchNow();
    const timer = window.setInterval(fetchNow, REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      controller.current?.abort();
      controller.current = null;
    };
  }, [locationKey, fetchNow]);

  const display = location ? weatherDisplay(store.weather(), clock.now().getTime()) : "noLocation";
  return { display, refreshNow: fetchNow };
}
