import Foundation
import Testing
@testable import KidBoardCore

private let taskID = UUID()
private let today = DayDate(year: 2026, month: 11, day: 19)

@Test func editorModifiesInPlaceWhenStartedToday() {
    let s = TaskScheduleInfo(id: UUID(), taskID: taskID, slot: .morning, weekdays: [.mon], startOn: today)
    let result = ScheduleEditor.change([s], taskID: taskID, slot: .evening, weekdays: [.tue, .thu], today: today, calendar: seoul)
    #expect(result.count == 1)
    #expect(result[0].id == s.id)
    #expect(result[0].slot == .evening)
    #expect(result[0].weekdays == [.tue, .thu])
}

@Test func editorSplitsWhenStartedBefore() {
    let s = TaskScheduleInfo(id: UUID(), taskID: taskID, slot: .morning, weekdays: [.mon],
                             startOn: DayDate(year: 2026, month: 11, day: 10))
    let newID = UUID()
    let result = ScheduleEditor.change([s], taskID: taskID, slot: .evening, weekdays: [.thu], today: today, calendar: seoul, newID: newID)
    #expect(result.count == 2)
    #expect(result[0].endOn == DayDate(year: 2026, month: 11, day: 18))
    #expect(result[1].id == newID)
    #expect(result[1].startOn == today)
    #expect(result[1].endOn == nil)
    #expect(result[1].slot == .evening)
    #expect(result[1].weekdays == [.thu])
}

@Test func editorLeavesOtherTasksUntouched() {
    let other = TaskScheduleInfo(id: UUID(), taskID: UUID(), slot: .morning, weekdays: [.mon],
                                 startOn: DayDate(year: 2026, month: 11, day: 1))
    let result = ScheduleEditor.change([other], taskID: taskID, slot: .evening, weekdays: [.thu], today: today, calendar: seoul)
    #expect(result.count == 2)
    #expect(result[0] == other)
    #expect(result[1].taskID == taskID)
    #expect(result[1].startOn == today)
}
