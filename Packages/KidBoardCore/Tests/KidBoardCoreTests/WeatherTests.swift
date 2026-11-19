import Foundation
import Testing
@testable import KidBoardCore

private struct StubHTTP: HTTPClient {
    let result: Result<Data, Error>
    func fetch(_ url: URL) async throws -> Data { try result.get() }
}

private struct StubError: Error {}

private func fixture(_ name: String) throws -> Data {
    let url = try #require(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
    return try Data(contentsOf: url)
}

@Test func forecastURLMatchesSpec() {
    let url = OpenMeteoClient.forecastURL(latitude: 37.5, longitude: 127.0)
    #expect(url.absoluteString == "https://api.open-meteo.com/v1/forecast?latitude=37.5&longitude=127.0&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1")
}

@Test func geocodingURLEncodesKorean() {
    let url = OpenMeteoClient.geocodingURL(query: "성남")
    #expect(url.absoluteString.contains("name=%EC%84%B1%EB%82%A8"))
    #expect(url.absoluteString == "https://geocoding-api.open-meteo.com/v1/search?name=%EC%84%B1%EB%82%A8&count=10&language=ko&format=json")
}

@Test func parsesForecast() async throws {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    let client = OpenMeteoClient(http: StubHTTP(result: .success(try fixture("forecast"))), now: { now })
    let snap = try await client.forecast(latitude: 37.5, longitude: 127.0)
    #expect(snap == WeatherSnapshot(temperature: 3.2, weatherCode: 0, high: 9.1, low: -1.4, precipitationProbability: 10, fetchedAt: now))
}

@Test func forecastNullPrecipitationIsZeroAndMissingDailyThrows() async throws {
    let nullJSON = #"{"current":{"temperature_2m":1.0,"weather_code":3},"daily":{"temperature_2m_max":[2.0],"temperature_2m_min":[0.0],"precipitation_probability_max":[null]}}"#
    let c1 = OpenMeteoClient(http: StubHTTP(result: .success(Data(nullJSON.utf8))))
    #expect(try await c1.forecast(latitude: 1, longitude: 2).precipitationProbability == 0)
    let bad = #"{"current":{"temperature_2m":1.0,"weather_code":3}}"#
    let c2 = OpenMeteoClient(http: StubHTTP(result: .success(Data(bad.utf8))))
    await #expect(throws: (any Error).self) { try await c2.forecast(latitude: 1, longitude: 2) }
}

@Test func parsesGeocoding() async throws {
    let client = OpenMeteoClient(http: StubHTTP(result: .success(try fixture("geocoding"))))
    let places = try await client.searchPlaces("성")
    #expect(places.count == 2)
    #expect(places[0].name == "서울특별시")
    #expect(places[1].admin1 == "경기도")
}

@Test func geocodingWithoutResultsIsEmpty() async throws {
    let client = OpenMeteoClient(http: StubHTTP(result: .success(Data("{}".utf8))))
    #expect(try await client.searchPlaces("zzz").isEmpty)
}

@Test func displayFreshStaleUnavailable() {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    func snap(ago: TimeInterval) -> WeatherSnapshot {
        WeatherSnapshot(temperature: 1, weatherCode: 0, high: 2, low: 0, precipitationProbability: 0, fetchedAt: now.addingTimeInterval(-ago))
    }
    let fresh = snap(ago: 2 * 3600 + 59 * 60)
    let stale = snap(ago: 3 * 3600 + 60)
    let edge = snap(ago: 10800)
    #expect(WeatherPolicy.display(cached: fresh, now: now) == .fresh(fresh))
    #expect(WeatherPolicy.display(cached: edge, now: now) == .fresh(edge))
    #expect(WeatherPolicy.display(cached: stale, now: now) == .stale(stale))
    #expect(WeatherPolicy.display(cached: nil, now: now) == .unavailable)
}

@Test func fetchFailureWithoutCacheIsUnavailable() async {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    let client = OpenMeteoClient(http: StubHTTP(result: .failure(StubError())), now: { now })
    await #expect(throws: (any Error).self) { try await client.forecast(latitude: 1, longitude: 2) }
    #expect(WeatherPolicy.display(cached: nil, now: now) == .unavailable)
}
