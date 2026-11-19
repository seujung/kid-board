import { expect, test } from "vitest";
import { KR_REGIONS } from "../../src/core/krRegions";

function find(name: string, admin1: string, city?: string) {
  const r = KR_REGIONS.find((x) => x.name === name && x.admin1 === admin1 && x.city === city);
  if (!r) throw new Error(`missing ${city ?? ""} ${name}, ${admin1}`);
  return r;
}

test("everyCoordinateIsInSouthKorea", () => {
  expect(KR_REGIONS.length).toBeGreaterThanOrEqual(250);
  for (const r of KR_REGIONS) {
    expect([r.name, r.latitude >= 33.0 && r.latitude <= 38.7]).toEqual([r.name, true]);
    expect([r.name, r.longitude >= 124.5 && r.longitude <= 131.0]).toEqual([r.name, true]);
  }
});

test("noDuplicateNameAdmin1City", () => {
  const seen = new Set<string>();
  for (const r of KR_REGIONS) {
    const key = `${r.city ?? ""} ${r.name}|${r.admin1}`;
    expect(seen.has(key)).toBe(false);
    seen.add(key);
  }
  // 일반구는 시 이름까지 붙여야 구별됩니다(예: 포항시 남구와 대구 남구는 시·도가 다릅니다).
  const plain = new Set<string>();
  for (const r of KR_REGIONS) {
    const key = `${r.city ? r.city + " " : ""}${r.name}|${r.admin1}`;
    expect(plain.has(key)).toBe(false);
    plain.add(key);
  }
});

test("everyProvinceIsListed", () => {
  const sido = KR_REGIONS.filter((r) => r.name === r.admin1).map((r) => r.name);
  expect(sido).toEqual([
    "서울특별시",
    "부산광역시",
    "대구광역시",
    "인천광역시",
    "대전광역시",
    "울산광역시",
    "세종특별자치시",
    "경기도",
    "강원특별자치도",
    "충청북도",
    "충청남도",
    "전북특별자치도",
    "전남광주통합특별시",
    "경상북도",
    "경상남도",
    "제주특별자치도",
  ]);
  const count = (admin1: string) => KR_REGIONS.filter((r) => r.admin1 === admin1 && !r.city && r.name !== admin1).length;
  expect(count("서울특별시")).toBe(25);
  expect(count("부산광역시")).toBe(16);
  expect(count("대구광역시")).toBe(9);
  expect(count("인천광역시")).toBe(11);
  expect(count("경기도")).toBe(31);
  expect(KR_REGIONS.filter((r) => r.city === "수원시").map((r) => r.name).sort()).toEqual(["권선구", "영통구", "장안구", "팔달구"]);
  expect(KR_REGIONS.filter((r) => r.city === "화성시").length).toBe(4);
});

/** 시청·구청 위치 기준값입니다. 목록 값은 이 값에서 0.05° 안이어야 합니다. */
const REFERENCE: [string, string, string | undefined, number, number][] = [
  ["송파구", "서울특별시", undefined, 37.5145, 127.1059],
  ["서울특별시", "서울특별시", undefined, 37.5665, 126.978],
  ["해운대구", "부산광역시", undefined, 35.1631, 129.1636],
  ["분당구", "경기도", "성남시", 37.3826, 127.1189],
  ["장안구", "경기도", "수원시", 37.304, 127.0101],
  ["유성구", "대전광역시", undefined, 36.3624, 127.3563],
  ["광산구", "전남광주통합특별시", undefined, 35.1396, 126.7937],
  ["강릉시", "강원특별자치도", undefined, 37.7519, 128.8761],
  ["전주시", "전북특별자치도", undefined, 35.8242, 127.148],
  ["창원시", "경상남도", undefined, 35.228, 128.6811],
  ["아산시", "충청남도", undefined, 36.7898, 127.0018],
  ["제주시", "제주특별자치도", undefined, 33.4996, 126.5312],
  ["울릉군", "경상북도", undefined, 37.4844, 130.9057],
];

test("spotValuesMatchReference", () => {
  for (const [name, admin1, city, lat, lon] of REFERENCE) {
    const r = find(name, admin1, city);
    expect([name, Math.abs(r.latitude - lat) <= 0.05]).toEqual([name, true]);
    expect([name, Math.abs(r.longitude - lon) <= 0.05]).toEqual([name, true]);
  }
});
