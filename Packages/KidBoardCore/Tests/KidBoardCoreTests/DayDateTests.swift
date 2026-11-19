import Testing
import Foundation
@testable import KidBoardCore

@Test func weekdayOfThursday() {
    #expect(DayDate(at(2026, 11, 19, 9), calendar: seoul).weekday(calendar: seoul) == .thu)
}
@Test func weekdayOfSunday() {
    #expect(DayDate(at(2026, 11, 22), calendar: seoul).weekday(calendar: seoul) == .sun)
}
@Test func addingDaysCrossesMonth() {
    #expect(DayDate(year: 2026, month: 11, day: 30).adding(days: 1, calendar: seoul) == DayDate(year: 2026, month: 12, day: 1))
}
@Test func dateAtTime() {
    #expect(DayDate(year: 2026, month: 11, day: 19).date(at: TimeOfDay(hour: 8, minute: 20), calendar: seoul) == at(2026, 11, 19, 8, 20))
}
@Test func timeOfDayOrdering() {
    #expect(TimeOfDay(hour: 8, minute: 20) < TimeOfDay(hour: 21, minute: 30))
}
