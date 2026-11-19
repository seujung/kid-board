import Foundation
import Testing
@testable import KidBoardCore

private let kid = UUID()
private let engine = ScheduleEngine(calendar: seoul)
private let d17 = DayDate(year: 2026, month: 11, day: 17)
private let d18 = DayDate(year: 2026, month: 11, day: 18)
private let d19 = DayDate(year: 2026, month: 11, day: 19)
private let d24 = DayDate(year: 2026, month: 11, day: 24)
private let longAgo = DayDate(year: 2026, month: 1, day: 1)

private func task(_ order: Int = 0, archivedOn: DayDate? = nil) -> TaskInfo {
    TaskInfo(id: UUID(), childID: kid, title: "t", icon: "star", order: order, archivedOn: archivedOn)
}

private func schedule(_ t: TaskInfo, _ slot: TimeSlot = .morning, _ weekdays: Set<Weekday> = Set(Weekday.allCases),
                      start: DayDate = longAgo, end: DayDate? = nil) -> TaskScheduleInfo {
    TaskScheduleInfo(id: UUID(), taskID: t.id, slot: slot, weekdays: weekdays, startOn: start, endOn: end)
}

@Test func tasksFilteredByWeekday() {
    let t = task()
    let data = BoardData(tasks: [t], schedules: [schedule(t, .morning, [.mon, .wed])])
    #expect(engine.tasks(childID: kid, on: d19, data: data).isEmpty)
    #expect(engine.tasks(childID: kid, on: d18, data: data).map(\.id) == [t.id])
}

@Test func tasksOrderedMorningFirstThenOrder() {
    let e0 = task(0), m1 = task(1), m0 = task(0)
    let data = BoardData(tasks: [e0, m1, m0], schedules: [
        schedule(e0, .evening), schedule(m1, .morning), schedule(m0, .morning),
    ])
    let result = engine.tasks(childID: kid, on: d19, data: data)
    #expect(result.map(\.id) == [m0.id, m1.id, e0.id])
    #expect(result.map(\.slot) == [.morning, .morning, .evening])
}

@Test func archivedTaskHiddenFromArchiveDay() {
    let t = task(archivedOn: d19)
    let data = BoardData(tasks: [t], schedules: [schedule(t)])
    #expect(engine.tasks(childID: kid, on: d18, data: data).count == 1)
    #expect(engine.tasks(childID: kid, on: d19, data: data).isEmpty)
}

@Test func pastDayUsesScheduleValidThatDay() {
    let t = task()
    let old = schedule(t, .morning, [.mon, .tue, .wed, .thu, .fri], end: d17)
    let new = schedule(t, .morning, [.mon], start: d18)
    let data = BoardData(tasks: [t], schedules: [old, new])
    #expect(engine.tasks(childID: kid, on: d17, data: data).count == 1)
    #expect(engine.tasks(childID: kid, on: d24, data: data).isEmpty)
}

@Test func summaryCountsDoneOfThatDayOnly() {
    let a = task(0), b = task(1)
    let data = BoardData(tasks: [a, b], schedules: [schedule(a), schedule(b)], completions: [
        CompletionInfo(childID: kid, taskID: a.id, day: d19, completedAt: at(2026, 11, 19, 8)),
        CompletionInfo(childID: kid, taskID: b.id, day: d18, completedAt: at(2026, 11, 18, 8)),
    ])
    #expect(engine.summary(childID: kid, on: d19, data: data) == DaySummary(done: 1, total: 2))
}

@Test func summaryZeroTasksIsNotStar() {
    let s = engine.summary(childID: kid, on: d19, data: BoardData())
    #expect(s == DaySummary(done: 0, total: 0))
    #expect(s.isStar == false)
}

@Test func summaryAllDoneIsStar() {
    let a = task(0), b = task(1)
    let data = BoardData(tasks: [a, b], schedules: [schedule(a), schedule(b)], completions: [
        CompletionInfo(childID: kid, taskID: a.id, day: d19, completedAt: at(2026, 11, 19, 8)),
        CompletionInfo(childID: kid, taskID: b.id, day: d19, completedAt: at(2026, 11, 19, 9)),
    ])
    let s = engine.summary(childID: kid, on: d19, data: data)
    #expect(s == DaySummary(done: 2, total: 2))
    #expect(s.isStar)
}

@Test func missingTimesDefaultToNoSchoolAndBed2130() {
    let t = engine.times(childID: kid, on: d19, data: BoardData())
    #expect(t.schoolTime == nil)
    #expect(t.bedTime == TimeOfDay(hour: 21, minute: 30))
    #expect(t.weekday == .thu)
    #expect(t.childID == kid)
}
