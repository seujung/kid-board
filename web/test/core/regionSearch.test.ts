import { expect, test } from "vitest";
import { findPlaces, searchKrRegions } from "../../src/core/regionSearch";
import type { Fetcher, GeoPlace } from "../../src/core/weather";
import { placeLabel } from "../../src/ui/parent/format";

const labels = (places: GeoPlace[]) => places.map(placeLabel);

test("districtAndProvinceTokens", () => {
  for (const q of ["서울 송파구", "송파구", "송파", " 송파 ", "서울특별시 송파구", "송파구 서울"]) {
    expect([q, labels(searchKrRegions(q))[0]]).toEqual([q, "송파구, 서울특별시"]);
  }
  expect(labels(searchKrRegions("서울 송파구"))).toEqual(["송파구, 서울특별시"]);
});

test("generalDistrictShowsCity", () => {
  expect(labels(searchKrRegions("분당"))[0]).toBe("성남시 분당구, 경기도");
  expect(labels(searchKrRegions("성남 분당구"))).toEqual(["성남시 분당구, 경기도"]);
  expect(labels(searchKrRegions("수원 장안"))).toEqual(["수원시 장안구, 경기도"]);
  // 시 이름으로 찾으면 시가 먼저, 그다음 일반구입니다.
  expect(labels(searchKrRegions("성남"))).toEqual([
    "성남시, 경기도",
    "성남시 분당구, 경기도",
    "성남시 수정구, 경기도",
    "성남시 중원구, 경기도",
  ]);
});

test("shortProvinceNames", () => {
  expect(labels(searchKrRegions("서울"))[0]).toBe("서울특별시");
  expect(searchKrRegions("서울").length).toBe(26);
  expect(labels(searchKrRegions("부산"))[0]).toBe("부산광역시");
  expect(labels(searchKrRegions("경기"))[0]).toBe("경기도");
  expect(labels(searchKrRegions("충북"))[0]).toBe("충청북도");
  expect(labels(searchKrRegions("강원"))[0]).toBe("강원특별자치도");
  expect(labels(searchKrRegions("세종"))).toEqual(["세종특별자치시"]);
  expect(labels(searchKrRegions("광주")).slice(0, 2)).toEqual(["전남광주통합특별시", "광주시, 경기도"]);
  expect(labels(searchKrRegions("광주 광산"))).toEqual(["광산구, 전남광주통합특별시"]);
});

test("sameNameDistrictsNeedProvince", () => {
  const jung = labels(searchKrRegions("중구"));
  expect(jung[0]).toBe("중구, 서울특별시");
  expect(jung).toContain("중구, 부산광역시");
  expect(labels(searchKrRegions("대구 중구"))).toEqual(["중구, 대구광역시"]);
  expect(labels(searchKrRegions("포항 남구"))).toEqual(["포항시 남구, 경상북도"]);
});

test("allTokensMustMatch", () => {
  expect(searchKrRegions("부산 송파")).toEqual([]);
  expect(searchKrRegions("없는동네")).toEqual([]);
  expect(searchKrRegions("")).toEqual([]);
  expect(searchKrRegions("   ")).toEqual([]);
});

test("suffixOnlyTokensDoNotMatchEverything", () => {
  // "구"만 입력하면 접미사를 뗀 빈 이름과 맞추지 않습니다. 이름이 "구"로 시작하는 곳만 찾습니다.
  for (const p of searchKrRegions("구")) expect(p.name.split(" ").pop()!.indexOf("구")).toBe(0);
});

function stubFetcher(results: unknown[] | Error) {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    if (results instanceof Error) throw results;
    return { results };
  };
  return { fetcher, calls };
}

const REMOTE_SEOUL = { name: "서울특별시", admin1: "서울특별시", latitude: 37.56826, longitude: 126.97783 };
const REMOTE_SONGPA_DUP = { name: "송파구", admin1: "서울특별시", latitude: 37.51, longitude: 127.1 };
const REMOTE_YEONGAM = { name: "송파", admin1: "전라남도", latitude: 34.77, longitude: 126.6 };

test("builtInFirstThenRemoteWithoutNearDuplicates", async () => {
  const { fetcher, calls } = stubFetcher([REMOTE_SONGPA_DUP, REMOTE_YEONGAM, REMOTE_SEOUL]);
  const found = await findPlaces(fetcher, "송파");
  expect(labels(found)).toEqual(["송파구, 서울특별시", "송파, 전라남도", "서울특별시"]);
  expect(calls.length).toBe(1);
});

test("fiveOrMoreBuiltInSkipsNetwork", async () => {
  const { fetcher, calls } = stubFetcher([REMOTE_YEONGAM]);
  const found = await findPlaces(fetcher, "서울");
  expect(found.length).toBe(26);
  expect(calls.length).toBe(0);
});

test("builtInWorksOffline", async () => {
  const { fetcher } = stubFetcher(new Error("offline"));
  expect(labels(await findPlaces(fetcher, "송파"))).toEqual(["송파구, 서울특별시"]);
  // 목록에도 없고 인터넷도 안 되면 실패를 그대로 알립니다.
  await expect(findPlaces(fetcher, "Tokyo")).rejects.toThrow("offline");
});

test("remoteOnlyWhenNoBuiltInMatch", async () => {
  const tokyo = { name: "도쿄", admin1: "도쿄도", latitude: 35.68, longitude: 139.69 };
  const { fetcher } = stubFetcher([tokyo]);
  expect(await findPlaces(fetcher, "도쿄")).toEqual([tokyo]);
});
