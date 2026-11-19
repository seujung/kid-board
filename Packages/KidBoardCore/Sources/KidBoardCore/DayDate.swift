import Foundation

/// 시간대 없이 달력상의 하루를 나타냅니다.
public struct DayDate: Codable, Hashable, Comparable, Sendable {
    public var year: Int
    public var month: Int
    public var day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    public init(_ date: Date, calendar: Calendar) {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        self.init(year: parts.year!, month: parts.month!, day: parts.day!)
    }

    public static func < (lhs: DayDate, rhs: DayDate) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }

    public func weekday(calendar: Calendar) -> Weekday {
        let start = date(at: TimeOfDay(hour: 12, minute: 0), calendar: calendar)
        // Calendar.weekday: 1 = 일요일 … 7 = 토요일. 월요일 시작 값(1...7)으로 바꿉니다.
        let raw = calendar.component(.weekday, from: start)
        return Weekday(rawValue: (raw + 5) % 7 + 1)!
    }

    public func adding(days: Int, calendar: Calendar) -> DayDate {
        let start = date(at: TimeOfDay(hour: 12, minute: 0), calendar: calendar)
        return DayDate(calendar.date(byAdding: .day, value: days, to: start)!, calendar: calendar)
    }

    public func date(at time: TimeOfDay, calendar: Calendar) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: time.hour, minute: time.minute))!
    }
}
