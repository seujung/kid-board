export type Fetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<unknown>;

export interface WeatherSnapshot {
  temperature: number;
  weatherCode: number;
  high: number;
  low: number;
  precipitationProbability: number;
  /** epoch ms */
  fetchedAt: number;
}

export interface GeoPlace {
  name: string;
  admin1: string | null;
  latitude: number;
  longitude: number;
}

export type WeatherDisplay =
  | { kind: "fresh"; snap: WeatherSnapshot }
  | { kind: "stale"; snap: WeatherSnapshot }
  | { kind: "unavailable" };

export const REFRESH_MS = 1_800_000;
const STALE_AFTER_MS = 10_800_000;

export const jsonFetcher: Fetcher = async (url, init) => {
  const res = await fetch(url, { signal: init?.signal });
  if (res.status < 200 || res.status > 299) throw new Error(`bad status ${res.status}`);
  return res.json();
};

export function forecastURL(lat: number, lon: number): string {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1`;
}

export function geocodingURL(query: string): string {
  return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=ko&format=json`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function num(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`missing field: ${field}`);
  return v;
}

function firstNum(v: unknown, field: string): number {
  if (!Array.isArray(v) || v.length === 0) throw new Error(`missing field: ${field}`);
  return num(v[0], field);
}

export async function fetchForecast(
  fetcher: Fetcher,
  lat: number,
  lon: number,
  now: number,
  signal?: AbortSignal,
): Promise<WeatherSnapshot> {
  const json = await fetcher(forecastURL(lat, lon), { signal });
  if (!isRecord(json) || !isRecord(json.current) || !isRecord(json.daily)) throw new Error("missing field: current/daily");
  const { current, daily } = json;
  const precip = Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max[0] : undefined;
  return {
    temperature: num(current.temperature_2m, "current.temperature_2m"),
    weatherCode: num(current.weather_code, "current.weather_code"),
    high: firstNum(daily.temperature_2m_max, "daily.temperature_2m_max"),
    low: firstNum(daily.temperature_2m_min, "daily.temperature_2m_min"),
    precipitationProbability: typeof precip === "number" ? Math.round(precip) : 0,
    fetchedAt: now,
  };
}

export async function searchPlaces(fetcher: Fetcher, query: string): Promise<GeoPlace[]> {
  const json = await fetcher(geocodingURL(query));
  if (!isRecord(json) || !Array.isArray(json.results)) return [];
  return json.results.map((r: unknown): GeoPlace => {
    if (!isRecord(r)) throw new Error("bad place");
    return {
      name: String(r.name),
      admin1: typeof r.admin1 === "string" ? r.admin1 : null,
      latitude: num(r.latitude, "latitude"),
      longitude: num(r.longitude, "longitude"),
    };
  });
}

export function weatherDisplay(cached: WeatherSnapshot | null, now: number): WeatherDisplay {
  if (cached === null) return { kind: "unavailable" };
  return now - cached.fetchedAt <= STALE_AFTER_MS ? { kind: "fresh", snap: cached } : { kind: "stale", snap: cached };
}
