import Foundation

let seoul: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
    return calendar
}()

func at(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 0, _ min: Int = 0, _ s: Int = 0) -> Date {
    seoul.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min, second: s))!
}
