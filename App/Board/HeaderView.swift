import SwiftUI
import KidBoardCore

/// 위쪽 공통 영역입니다. 날짜, 시계, 날씨를 풍경 위에 표시합니다.
///
/// `trailingAccessory`는 오른쪽 위 빈자리입니다. Task 10에서 부모 모드 설정 아이콘을 넣습니다.
struct HeaderView<TrailingAccessory: View>: View {
    let now: Date
    let calendar: Calendar
    let weather: WeatherDisplay
    let needsLocation: Bool
    let locationName: String?
    /// 표시 중인 자녀들의 오늘 등교 시각 중 가장 늦은 값입니다.
    let latestSchoolTime: Date?
    @ViewBuilder var trailingAccessory: () -> TrailingAccessory

    private var scene: BoardScene { DisplayPolicy.scene(now, calendar: calendar) }
    private var isDay: Bool { scene == .day }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.clear
            HStack(alignment: .center) {
                clock
                Spacer(minLength: 24)
                weatherCard
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 18)
            trailingAccessory()
                .padding(10)
        }
        .background(SceneBackground(scene: scene).ignoresSafeArea(edges: .top))
    }

    // MARK: Clock

    private var clock: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(BoardFormat.format(now, "M월 d일 EEEE", calendar: calendar))
                .font(.system(size: 28, weight: .bold, design: .rounded))
            Text(BoardFormat.format(now, "HH:mm:ss", calendar: calendar))
                .font(.system(size: 84, weight: .heavy, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
        }
        .foregroundStyle(isDay ? BoardPalette.ink : Color.white)
        .padding(.horizontal, 24)
        .padding(.vertical, 10)
        .background(cardBackground)
        .accessibilityElement(children: .combine)
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 24)
            .fill(isDay ? Color.white.opacity(0.8) : Color.black.opacity(0.35))
    }

    // MARK: Weather

    private var weatherCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            if needsLocation {
                message("📍", "지역을 설정해 주세요")
            } else {
                switch weather {
                case .fresh(let snapshot): details(snapshot, stale: false)
                case .stale(let snapshot): details(snapshot, stale: true)
                case .unavailable: message("🌈", "날씨 정보 없음")
                }
            }
        }
        .foregroundStyle(isDay ? BoardPalette.ink : Color.white)
        .padding(.horizontal, 22)
        .padding(.vertical, 12)
        .background(cardBackground)
        .frame(maxWidth: 380)
    }

    private func message(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 10) {
            Text(icon).font(.system(size: 40))
            Text(text).font(.system(size: 24, weight: .bold, design: .rounded))
        }
    }

    private func details(_ snapshot: WeatherSnapshot, stale: Bool) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 12) {
                Text(BoardFormat.icon(for: snapshot.weatherCode, isDay: isDay)).font(.system(size: 52))
                Text("\(BoardFormat.degrees(snapshot.temperature))")
                    .font(.system(size: 52, weight: .heavy, design: .rounded))
                VStack(alignment: .leading, spacing: 2) {
                    Text("최고 \(BoardFormat.degrees(snapshot.high))  최저 \(BoardFormat.degrees(snapshot.low))")
                    Text("비 올 확률 \(snapshot.precipitationProbability)%")
                }
                .font(.system(size: 19, weight: .bold, design: .rounded))
            }
            .opacity(stale ? 0.45 : 1)
            if stale {
                Text("\(BoardFormat.format(snapshot.fetchedAt, "M/d HH:mm", calendar: calendar))에 받은 날씨")
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .opacity(0.8)
            } else if let locationName {
                Text(locationName)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .opacity(0.7)
            }
            if DisplayPolicy.showsUmbrella(precipitationProbability: snapshot.precipitationProbability,
                                           now: now, latestSchoolTime: latestSchoolTime) {
                Text("☂️ 우산 챙기기!")
                    .font(.system(size: 20, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color(red: 0.2, green: 0.45, blue: 0.85)))
            }
        }
    }
}

extension HeaderView where TrailingAccessory == EmptyView {
    init(now: Date, calendar: Calendar, weather: WeatherDisplay, needsLocation: Bool,
         locationName: String?, latestSchoolTime: Date?) {
        self.init(now: now, calendar: calendar, weather: weather, needsLocation: needsLocation,
                  locationName: locationName, latestSchoolTime: latestSchoolTime) { EmptyView() }
    }
}

/// 보드 화면의 날짜·기온 표기입니다.
@MainActor
enum BoardFormat {
    static func degrees(_ value: Double) -> String {
        "\(Int(value.rounded()))°"
    }

    /// Open-Meteo WMO 날씨 코드를 이모지로 바꿉니다.
    static func icon(for code: Int, isDay: Bool) -> String {
        switch code {
        case 0: isDay ? "☀️" : "🌙"
        case 1, 2: isDay ? "🌤️" : "☁️"
        case 3: "☁️"
        case 45, 48: "🌫️"
        case 51...67: "🌧️"
        case 71...77, 85, 86: "❄️"
        case 80...82: "🌦️"
        case 95...99: "⛈️"
        default: "🌡️"
        }
    }

    private static var formatters: [String: DateFormatter] = [:]

    static func format(_ date: Date, _ pattern: String, calendar: Calendar) -> String {
        let key = "\(pattern)|\(calendar.timeZone.identifier)"
        let formatter = formatters[key] ?? {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "ko_KR")
            formatter.calendar = calendar
            formatter.timeZone = calendar.timeZone
            formatter.dateFormat = pattern
            formatters[key] = formatter
            return formatter
        }()
        return formatter.string(from: date)
    }
}

#Preview("헤더") {
    let now = Date()
    let snapshot = WeatherSnapshot(temperature: 3.4, weatherCode: 61, high: 9, low: -1,
                                   precipitationProbability: 60, fetchedAt: now)
    return VStack(spacing: 0) {
        HeaderView(now: now, calendar: .appCalendar, weather: .fresh(snapshot), needsLocation: false,
                   locationName: "서울", latestSchoolTime: now.addingTimeInterval(1800))
        HeaderView(now: now, calendar: .appCalendar, weather: .stale(snapshot), needsLocation: false,
                   locationName: "서울", latestSchoolTime: nil)
        HeaderView(now: now, calendar: .appCalendar, weather: .unavailable, needsLocation: true,
                   locationName: nil, latestSchoolTime: nil)
    }
    .frame(width: 1180, height: 660)
}
