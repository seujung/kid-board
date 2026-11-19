import Foundation

public protocol HTTPClient: Sendable {
    func fetch(_ url: URL) async throws -> Data
}

public enum WeatherError: Error, Equatable, Sendable {
    case badStatus(Int)
    case missingField(String)
}

extension URLSession: HTTPClient {
    public func fetch(_ url: URL) async throws -> Data {
        let (data, response) = try await self.data(from: url)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw WeatherError.badStatus(http.statusCode)
        }
        return data
    }
}

public struct WeatherSnapshot: Codable, Hashable, Sendable {
    public var temperature: Double
    public var weatherCode: Int
    public var high: Double
    public var low: Double
    public var precipitationProbability: Int
    public var fetchedAt: Date

    public init(temperature: Double, weatherCode: Int, high: Double, low: Double,
                precipitationProbability: Int, fetchedAt: Date) {
        self.temperature = temperature
        self.weatherCode = weatherCode
        self.high = high
        self.low = low
        self.precipitationProbability = precipitationProbability
        self.fetchedAt = fetchedAt
    }
}

public struct GeoPlace: Codable, Hashable, Sendable {
    public var name: String
    public var admin1: String?
    public var latitude: Double
    public var longitude: Double

    public init(name: String, admin1: String?, latitude: Double, longitude: Double) {
        self.name = name
        self.admin1 = admin1
        self.latitude = latitude
        self.longitude = longitude
    }
}

public struct OpenMeteoClient: Sendable {
    private let http: HTTPClient
    private let now: @Sendable () -> Date

    public init(http: HTTPClient, now: @Sendable @escaping () -> Date = Date.init) {
        self.http = http
        self.now = now
    }

    public static func forecastURL(latitude: Double, longitude: Double) -> URL {
        URL(string: "https://api.open-meteo.com/v1/forecast?latitude=\(latitude)&longitude=\(longitude)&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1")!
    }

    public static func geocodingURL(query: String) -> URL {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        let encoded = query.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
        return URL(string: "https://geocoding-api.open-meteo.com/v1/search?name=\(encoded)&count=10&language=ko&format=json")!
    }

    private struct ForecastResponse: Decodable {
        struct Current: Decodable {
            let temperature_2m: Double
            let weather_code: Int
        }
        struct Daily: Decodable {
            let temperature_2m_max: [Double]
            let temperature_2m_min: [Double]
            let precipitation_probability_max: [Double?]
        }
        let current: Current
        let daily: Daily
    }

    public func forecast(latitude: Double, longitude: Double) async throws -> WeatherSnapshot {
        let data = try await http.fetch(Self.forecastURL(latitude: latitude, longitude: longitude))
        let response = try JSONDecoder().decode(ForecastResponse.self, from: data)
        guard let high = response.daily.temperature_2m_max.first else {
            throw WeatherError.missingField("daily.temperature_2m_max")
        }
        guard let low = response.daily.temperature_2m_min.first else {
            throw WeatherError.missingField("daily.temperature_2m_min")
        }
        let precipitation = response.daily.precipitation_probability_max.first.flatMap { $0 } ?? 0
        return WeatherSnapshot(
            temperature: response.current.temperature_2m,
            weatherCode: response.current.weather_code,
            high: high,
            low: low,
            precipitationProbability: Int(precipitation.rounded()),
            fetchedAt: now()
        )
    }

    private struct GeocodingResponse: Decodable {
        let results: [GeoPlace]?
    }

    public func searchPlaces(_ query: String) async throws -> [GeoPlace] {
        let data = try await http.fetch(Self.geocodingURL(query: query))
        return try JSONDecoder().decode(GeocodingResponse.self, from: data).results ?? []
    }
}

public enum WeatherDisplay: Hashable, Sendable {
    case fresh(WeatherSnapshot)
    case stale(WeatherSnapshot)
    case unavailable
}

public enum WeatherPolicy {
    public static let refreshInterval: TimeInterval = 1800
    public static let staleAfter: TimeInterval = 10800

    public static func display(cached: WeatherSnapshot?, now: Date) -> WeatherDisplay {
        guard let cached else { return .unavailable }
        return now.timeIntervalSince(cached.fetchedAt) <= staleAfter ? .fresh(cached) : .stale(cached)
    }
}
