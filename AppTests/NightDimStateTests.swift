import Foundation
import Testing
@testable import KidBoard

private let seoul: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
    return calendar
}()

private func at(_ hour: Int, _ minute: Int = 0, _ second: Int = 0, day: Int = 19) -> Date {
    seoul.date(from: DateComponents(year: 2026, month: 11, day: day, hour: hour, minute: minute, second: second))!
}

struct NightDimStateTests {
    @Test func daytimeIsNeverDimmed() {
        var state = NightDimState(calendar: seoul)
        #expect(state.step(now: at(21, 59, 59), touched: false) == .init(dimmed: false, isNight: false))
        #expect(state.step(now: at(12), touched: true) == .init(dimmed: false, isNight: false))
    }

    @Test func entersAtTen() {
        var state = NightDimState(calendar: seoul)
        _ = state.step(now: at(21, 59, 59), touched: false)
        #expect(state.step(now: at(22), touched: false) == .init(dimmed: true, isNight: true))
    }

    @Test func touchWakesForThirtySecondsThenDimsAgain() {
        var state = NightDimState(calendar: seoul)
        _ = state.step(now: at(23), touched: false)
        #expect(state.step(now: at(23, 0, 10), touched: true).dimmed == false)
        #expect(state.step(now: at(23, 0, 39), touched: false).dimmed == false)
        #expect(state.step(now: at(23, 0, 40), touched: false).dimmed == true)
        #expect(state.step(now: at(23, 5), touched: false).dimmed == true)
    }

    @Test func exitsAtSix() {
        var state = NightDimState(calendar: seoul)
        #expect(state.step(now: at(5, 59, 59, day: 20), touched: false) == .init(dimmed: true, isNight: true))
        #expect(state.step(now: at(6, 0, 0, day: 20), touched: false) == .init(dimmed: false, isNight: false))
    }

    @Test func wakeDoesNotCarryIntoNextNight() {
        var state = NightDimState(calendar: seoul)
        _ = state.step(now: at(23), touched: true)
        _ = state.step(now: at(6, day: 20), touched: false)
        #expect(state.step(now: at(22, day: 20), touched: false).dimmed == true)
    }
}

struct NightDimSuspensionTests {
    @Test func suspendedIsNeverDimmedAndWakesAfterResume() {
        var state = NightDimState(calendar: seoul)
        #expect(state.step(now: at(23), touched: false).dimmed)
        #expect(state.step(now: at(23, 1), touched: false, suspended: true) == .init(dimmed: false, isNight: true))
        #expect(!state.step(now: at(23, 10), touched: false, suspended: true).dimmed)
        #expect(!state.step(now: at(23, 10, 29), touched: false).dimmed)
        #expect(state.step(now: at(23, 10, 30), touched: false).dimmed)
    }

    @Test func touchDuringWakeExtendsIt() {
        var state = NightDimState(calendar: seoul)
        _ = state.step(now: at(23), touched: false)
        _ = state.step(now: at(23, 0, 10), touched: true)
        #expect(!state.step(now: at(23, 0, 35), touched: true).dimmed)
        #expect(!state.step(now: at(23, 1, 4), touched: false).dimmed)
        #expect(state.step(now: at(23, 1, 5), touched: false).dimmed)
    }
}
