import Foundation

public enum BoardScene: Sendable {
    case day
    case night
}

public enum DisplayPolicy {
    public static let nightWakeDuration: TimeInterval = 30

    /// 22:00 이상 또는 06:00 미만이면 야간 모드입니다.
    public static func isNightMode(_ now: Date, calendar: Calendar) -> Bool {
        let hour = calendar.component(.hour, from: now)
        return hour >= 22 || hour < 6
    }

    /// 06:00 이상 18:00 미만이면 `.day`입니다.
    public static func scene(_ now: Date, calendar: Calendar) -> BoardScene {
        let hour = calendar.component(.hour, from: now)
        return (6..<18).contains(hour) ? .day : .night
    }

    public static func showsUmbrella(precipitationProbability: Int, now: Date, latestSchoolTime: Date?) -> Bool {
        guard precipitationProbability >= 50, let latestSchoolTime else { return false }
        return now < latestSchoolTime
    }
}
