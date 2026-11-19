import Foundation
import Testing
@testable import KidBoardCore

private let kid = ChildInfo(id: UUID(), name: "민준", avatar: "star", themeColor: "blue", order: 0)
private let engine = BoardStateEngine(calendar: seoul)
private let start = DayDate(year: 2026, month: 1, day: 1)
private let allWeekdays = Set(Weekday.allCases)

private func makeTask(_ order: Int, _ slot: TimeSlot) -> (TaskInfo, TaskScheduleInfo) {
    let task = TaskInfo(id: UUID(), childID: kid.id, title: "t\(order)", icon: "i", order: order)
    let schedule = TaskScheduleInfo(id: UUID(), taskID: task.id, slot: slot, weekdays: allWeekdays, startOn: start)
    return (task, schedule)
}

private func makeData(_ pairs: [(TaskInfo, TaskScheduleInfo)], school: TimeOfDay? = TimeOfDay(hour: 8, minute: 20),
                      times: Bool = true, done: [(TaskInfo, DayDate)] = []) -> BoardData {
    var timesList: [DailyTimesInfo] = []
    if times {
        timesList = Weekday.allCases.map {
            DailyTimesInfo(childID: kid.id, weekday: $0, schoolTime: $0 == .sat || $0 == .sun ? nil : school,
                           bedTime: TimeOfDay(hour: 21, minute: 30))
        }
    }
    return BoardData(
        children: [kid], tasks: pairs.map(\.0), schedules: pairs.map(\.1), times: timesList,
        completions: done.map { CompletionInfo(childID: kid.id, taskID: $0.0.id, day: $0.1, completedAt: at(2026, 11, 19)) }
    )
}

private let thu = DayDate(year: 2026, month: 11, day: 19)

@Test func beforeSchoolIsMorningWithSchoolDeadline() {
    let m = makeTask(0, .morning), e = makeTask(1, .evening)
    let state = engine.state(for: kid, now: at(2026, 11, 19, 7, 42), data: makeData([m, e]))
    #expect(state.phase == .morning(deadline: at(2026, 11, 19, 8, 20)))
    #expect(state.visibleTasks.map(\.id) == [m.0.id])
}

@Test func atSchoolTimeIsEvening() {
    let m = makeTask(0, .morning), e = makeTask(1, .evening)
    let state = engine.state(for: kid, now: at(2026, 11, 19, 8, 20, 0), data: makeData([m, e]))
    #expect(state.phase == .evening(deadline: at(2026, 11, 19, 21, 30)))
    #expect(state.visibleTasks.map(\.id) == [e.0.id])
}

@Test func morningTaskNotToggleableAtSchoolTime() {
    let m = makeTask(0, .morning), e = makeTask(1, .evening)
    let data = makeData([m, e])
    #expect(!engine.canToggle(taskID: m.0.id, childID: kid.id, now: at(2026, 11, 19, 8, 20, 0), data: data))
    #expect(engine.canToggle(taskID: e.0.id, childID: kid.id, now: at(2026, 11, 19, 8, 20, 0), data: data))
}

@Test func eveningTaskNotToggleableInMorning() {
    let m = makeTask(0, .morning), e = makeTask(1, .evening)
    let data = makeData([m, e])
    #expect(!engine.canToggle(taskID: e.0.id, childID: kid.id, now: at(2026, 11, 19, 7, 0), data: data))
    #expect(engine.canToggle(taskID: m.0.id, childID: kid.id, now: at(2026, 11, 19, 7, 0), data: data))
}

@Test func noSchoolDayShowsAllTasksUntilBed() {
    let m = makeTask(0, .morning), e = makeTask(1, .evening)
    let state = engine.state(for: kid, now: at(2026, 11, 21, 10, 0), data: makeData([m, e]))
    #expect(state.phase == .allDay(deadline: at(2026, 11, 21, 21, 30)))
    #expect(state.visibleTasks.map(\.id) == [m.0.id, e.0.id])
}

@Test func afterBedIsFinishedNotAllDone() {
    let m = makeTask(0, .morning)
    let state = engine.state(for: kid, now: at(2026, 11, 19, 22, 0), data: makeData([m]))
    #expect(state.phase == .finished(allDone: false))
    #expect(state.nowTaskID == nil)
    #expect(!engine.canToggle(taskID: m.0.id, childID: kid.id, now: at(2026, 11, 19, 22, 0), data: makeData([m])))
}

@Test func afterBedIsFinishedAllDone() {
    let m = makeTask(0, .morning), e = makeTask(1, .evening)
    let data = makeData([m, e], done: [(m.0, thu), (e.0, thu)])
    let state = engine.state(for: kid, now: at(2026, 11, 19, 22, 0), data: data)
    #expect(state.phase == .finished(allDone: true))
    #expect(state.remaining == 0)
}

@Test func finishedWithZeroTasksIsAllDone() {
    let state = engine.state(for: kid, now: at(2026, 11, 19, 22, 0), data: makeData([]))
    #expect(state.phase == .finished(allDone: true))
}

@Test func nowTaskIsFirstUndone() {
    let tasks = [makeTask(0, .morning), makeTask(1, .morning), makeTask(2, .morning)]
    let data = makeData(tasks, done: [(tasks[0].0, thu)])
    let state = engine.state(for: kid, now: at(2026, 11, 19, 7, 0), data: data)
    #expect(state.nowTaskID == tasks[1].0.id)
    #expect(state.remaining == 2)
    #expect(state.doneTaskIDs == [tasks[0].0.id])
    #expect(abs(state.progress - 1.0 / 3.0) < 1e-9)
}

@Test func zeroVisibleTasksProgressIsZero() {
    let state = engine.state(for: kid, now: at(2026, 11, 19, 7, 0), data: makeData([]))
    #expect(state.progress == 0)
    #expect(state.remaining == 0)
}

@Test func missingTimesUsesDefaults() {
    let m = makeTask(0, .morning)
    let state = engine.state(for: kid, now: at(2026, 11, 19, 10, 0), data: makeData([m], times: false))
    #expect(state.phase == .allDay(deadline: at(2026, 11, 19, 21, 30)))
}

@Test func midnightRollsToNewDay() {
    let m = makeTask(0, .morning)
    let data = makeData([m], done: [(m.0, thu)])
    let before = engine.state(for: kid, now: at(2026, 11, 19, 23, 59, 59), data: data)
    let after = engine.state(for: kid, now: at(2026, 11, 20, 0, 0, 0), data: data)
    #expect(before.day == thu)
    #expect(after.day == DayDate(year: 2026, month: 11, day: 20))
    #expect(after.doneTaskIDs.isEmpty)
}

@Test func copyTexts() {
    #expect(BoardCopy.remainingText(2) == "할 일 2개 남았어!")
    #expect(BoardCopy.remainingText(0) == "다 했어! 최고야!")
    #expect(BoardCopy.finishedText(allDone: true) == "오늘 수고했어!")
    #expect(BoardCopy.finishedText(allDone: false) == "내일 또 해 보자")
    let d = at(2026, 11, 19)
    #expect(BoardCopy.countdownLabel(.morning(deadline: d)) == "등교까지")
    #expect(BoardCopy.countdownLabel(.evening(deadline: d)) == "잘 준비까지")
    #expect(BoardCopy.countdownLabel(.allDay(deadline: d)) == "잘 준비까지")
    #expect(BoardCopy.countdownLabel(.finished(allDone: true)) == nil)
}
