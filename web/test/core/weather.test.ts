import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  type Fetcher,
  type WeatherSnapshot,
  fetchForecast,
  forecastURL,
  geocodingURL,
  searchPlaces,
  weatherDisplay,
} from "../../src/core/weather";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));
}
const stub = (value: unknown): Fetcher => async () => value;
const failing: Fetcher = async () => {
  throw new Error("stub");
};
const NOW = 1_800_000_000_000;

test("forecastURLMatchesSpec", () => {
  // Swift는 127.0을 "127.0"으로 찍지만 JS Number는 "127"입니다.
  expect(forecastURL(37.5, 127)).toBe(
    "https://api.open-meteo.com/v1/forecast?latitude=37.5&longitude=127&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1",
  );
});

test("geocodingURLEncodesKorean", () => {
  const url = geocodingURL("성남");
  expect(url).toContain("name=%EC%84%B1%EB%82%A8");
  expect(url).toBe("https://geocoding-api.open-meteo.com/v1/search?name=%EC%84%B1%EB%82%A8&count=10&language=ko&format=json");
});

test("parsesForecast", async () => {
  const snap = await fetchForecast(stub(fixture("forecast")), 37.5, 127, NOW);
  expect(snap).toEqual({ temperature: 3.2, weatherCode: 0, high: 9.1, low: -1.4, precipitationProbability: 10, fetchedAt: NOW });
});

test("forecastNullPrecipitationIsZeroAndMissingDailyThrows", async () => {
  const nullJSON = { current: { temperature_2m: 1.0, weather_code: 3 }, daily: { temperature_2m_max: [2.0], temperature_2m_min: [0.0], precipitation_probability_max: [null] } };
  expect((await fetchForecast(stub(nullJSON), 1, 2, NOW)).precipitationProbability).toBe(0);
  const bad = { current: { temperature_2m: 1.0, weather_code: 3 } };
  await expect(fetchForecast(stub(bad), 1, 2, NOW)).rejects.toThrow();
});

test("parsesGeocoding", async () => {
  const places = await searchPlaces(stub(fixture("geocoding")), "성");
  expect(places.length).toBe(2);
  expect(places[0]?.name).toBe("서울특별시");
  expect(places[1]?.admin1).toBe("경기도");
});

test("geocodingWithoutResultsIsEmpty", async () => {
  expect(await searchPlaces(stub({}), "zzz")).toEqual([]);
});

test("displayFreshStaleUnavailable", () => {
  const snap = (agoSec: number): WeatherSnapshot => ({ temperature: 1, weatherCode: 0, high: 2, low: 0, precipitationProbability: 0, fetchedAt: NOW - agoSec * 1000 });
  const fresh = snap(2 * 3600 + 59 * 60);
  const stale = snap(3 * 3600 + 60);
  const edge = snap(10800);
  expect(weatherDisplay(fresh, NOW)).toEqual({ kind: "fresh", snap: fresh });
  expect(weatherDisplay(edge, NOW)).toEqual({ kind: "fresh", snap: edge });
  expect(weatherDisplay(stale, NOW)).toEqual({ kind: "stale", snap: stale });
  expect(weatherDisplay(null, NOW)).toEqual({ kind: "unavailable" });
});

test("fetchFailureWithoutCacheIsUnavailable", async () => {
  await expect(fetchForecast(failing, 1, 2, NOW)).rejects.toThrow();
  expect(weatherDisplay(null, NOW)).toEqual({ kind: "unavailable" });
});

test("fetchForecastPassesSignalToFetcher", async () => {
  const ctrl = new AbortController();
  let seen: AbortSignal | undefined;
  const f: Fetcher = async (_u, init) => {
    seen = init?.signal;
    return fixture("forecast");
  };
  await fetchForecast(f, 37.5, 127, NOW, ctrl.signal);
  expect(seen).toBe(ctrl.signal);
});
