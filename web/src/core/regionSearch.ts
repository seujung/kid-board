import { KR_REGIONS } from "./krRegions";
import type { KrRegion } from "./krRegions";
import { searchPlaces } from "./weather";
import type { Fetcher, GeoPlace } from "./weather";

/** 내장 목록에서 이만큼 찾지 못하면 Open-Meteo 결과를 뒤에 붙입니다. */
export const MIN_BUILT_IN = 5;
/** 내장 결과와 위도·경도가 모두 이만큼 가까운 Open-Meteo 결과는 같은 곳으로 보고 뺍니다. */
const NEAR_DEG = 0.02;

/** 긴 접미사부터 뗍니다. "서울특별시"에서 "시"만 떼지 않도록 합니다. */
const SUFFIXES = ["특별자치시", "특별자치도", "통합특별시", "특별시", "광역시", "도", "시", "군", "구"];

/** 시·도의 흔한 줄임말입니다. */
const ADMIN1_ALIASES: Record<string, string[]> = {
  서울특별시: ["서울", "서울시"],
  부산광역시: ["부산", "부산시"],
  대구광역시: ["대구", "대구시"],
  인천광역시: ["인천", "인천시"],
  대전광역시: ["대전", "대전시"],
  울산광역시: ["울산", "울산시"],
  세종특별자치시: ["세종", "세종시"],
  경기도: ["경기"],
  강원특별자치도: ["강원", "강원도"],
  충청북도: ["충북"],
  충청남도: ["충남"],
  전북특별자치도: ["전북", "전라북도"],
  전남광주통합특별시: ["전남광주", "광주특별시", "광주", "광주광역시", "전남", "전라남도"],
  경상북도: ["경북"],
  경상남도: ["경남"],
  제주특별자치도: ["제주", "제주도"],
};

/** 이름과 접미사를 뗀 이름입니다. 떼고 남는 글자가 없으면 넣지 않습니다. */
function forms(value: string): string[] {
  const list = [value];
  for (const suffix of SUFFIXES) {
    if (value.length > suffix.length && value.slice(-suffix.length) === suffix) {
      list.push(value.slice(0, -suffix.length));
      break;
    }
  }
  return list;
}

function startsWith(value: string, prefix: string): boolean {
  return value.slice(0, prefix.length) === prefix;
}

/** 0: 맞지 않음, 1: 앞부분이 맞음, 2: 전체가 맞음 */
function matchLevel(token: string, candidates: string[]): number {
  let level = 0;
  for (const c of candidates) {
    if (c === token) return 2;
    if (startsWith(c, token)) level = 1;
  }
  return level;
}

interface Indexed {
  region: KrRegion;
  /** 이름(시·도 항목은 줄임말 포함)과 일반구의 시 이름입니다. */
  own: string[];
  /** 시·도 이름과 줄임말입니다. */
  admin1: string[];
  isProvince: boolean;
}

const INDEX: Indexed[] = KR_REGIONS.map((region) => {
  const admin1 = forms(region.admin1).concat(ADMIN1_ALIASES[region.admin1] ?? []);
  const isProvince = region.name === region.admin1;
  const own = isProvince ? admin1 : forms(region.name).concat(region.city ? forms(region.city) : []);
  return { region, own, admin1: isProvince ? [] : admin1, isProvince };
});

/** 내장 목록의 항목을 지역 형식으로 바꿉니다. 일반구는 "성남시 분당구"처럼 시 이름을 붙입니다. */
function toPlace(r: KrRegion): GeoPlace {
  return {
    name: r.city ? `${r.city} ${r.name}` : r.name,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

/**
 * 내장 시·군·구 목록에서 찾습니다. 네트워크를 쓰지 않습니다.
 * - 공백으로 나눈 낱말이 모두 맞아야 합니다.
 * - 낱말마다 이름, 일반구의 시 이름, 시·도 이름과 견줍니다. 접미사(구·군·시·특별시·광역시·도)를 뗀 이름과 시·도 줄임말도 봅니다.
 * - 앞부분만 맞아도 됩니다("송파" → 송파구).
 * - 이름이 맞는 항목이 시·도만 맞는 항목보다 먼저 옵니다. 점수가 같으면 시·도 항목, 그다음 목록 순서입니다.
 */
export function searchKrRegions(query: string): GeoPlace[] {
  const tokens = query.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return [];
  const scored: { item: Indexed; score: number; order: number }[] = [];
  INDEX.forEach((item, order) => {
    let score = 0;
    for (const token of tokens) {
      const own = matchLevel(token, item.own);
      const admin1 = matchLevel(token, item.admin1);
      if (own === 0 && admin1 === 0) return;
      // 이름: 전체 4, 앞부분 3. 시·도: 전체 2, 앞부분 1.
      score += Math.max(own > 0 ? own + 2 : 0, admin1);
    }
    scored.push({ item, score, order });
  });
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.item.isProvince !== b.item.isProvince) return a.item.isProvince ? -1 : 1;
    return a.order - b.order;
  });
  return scored.map((s) => toPlace(s.item.region));
}

function isNear(a: GeoPlace, b: GeoPlace): boolean {
  return Math.abs(a.latitude - b.latitude) <= NEAR_DEG && Math.abs(a.longitude - b.longitude) <= NEAR_DEG;
}

/**
 * 지역 검색입니다. 내장 목록 결과를 먼저 보여 줍니다.
 * 내장 결과가 5개보다 적으면 Open-Meteo 결과를 뒤에 붙이고, 내장 결과와 0.02° 안으로 가까운 곳은 뺍니다.
 * Open-Meteo 검색이 실패해도 내장 결과가 있으면 그 결과를 돌려줍니다. 내장 결과도 없으면 실패합니다.
 */
export async function findPlaces(fetcher: Fetcher, query: string): Promise<GeoPlace[]> {
  const builtIn = searchKrRegions(query);
  if (builtIn.length >= MIN_BUILT_IN) return builtIn;
  let remote: GeoPlace[];
  try {
    remote = await searchPlaces(fetcher, query);
  } catch (err) {
    if (builtIn.length > 0) return builtIn;
    throw err;
  }
  return builtIn.concat(remote.filter((r) => !builtIn.some((b) => isNear(b, r))));
}
