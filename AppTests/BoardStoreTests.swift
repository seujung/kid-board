import Combine
import Foundation
import SwiftData
import Testing
import KidBoardCore
@testable import KidBoard

private let seoul: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
    return calendar
}()

private func date(_ month: Int, _ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
    seoul.date(from: DateComponents(year: 2026, month: month, day: day, hour: hour, minute: minute))!
}

private let thu = DayDate(year: 2026, month: 11, day: 19)
private let wed = DayDate(year: 2026, month: 11, day: 18)

@MainActor
private func makeStore() throws -> BoardStore {
    let container = try KidBoardContainer.make(inMemory: true)
    return BoardStore(context: ModelContext(container), calendar: seoul)
}

@MainActor
private func seeded() throws -> (BoardStore, BoardData) {
    let store = try makeStore()
    store.seedIfEmpty(today: wed)
    return (store, store.snapshot())
}

@MainActor
private func morningTask(_ data: BoardData) -> (child: UUID, task: UUID) {
    let child = data.children[0].id
    let task = data.tasks.first { $0.childID == child && $0.title == "세수하기" }!.id
    return (child, task)
}

@MainActor @Test func seedCreatesTwoChildrenOnce() throws {
    let store = try makeStore()
    store.seedIfEmpty(today: wed)
    store.seedIfEmpty(today: wed)
    let data = store.snapshot()
    #expect(data.children.count == 2)
    #expect(data.tasks.count == 18)
    #expect(data.children.map(\.name) == ["첫째", "둘째"])
}

@MainActor @Test func toggleCreatesAndRemovesCompletion() throws {
    let (store, data) = try seeded()
    let (child, task) = morningTask(data)
    #expect(store.toggleCompletion(childID: child, taskID: task, now: date(11, 19, 7)))
    #expect(store.snapshot().completions.count == 1)
    #expect(store.toggleCompletion(childID: child, taskID: task, now: date(11, 19, 7, 5)))
    #expect(store.snapshot().completions.count == 0)
}

@MainActor @Test func toggleRejectedAfterDeadline() throws {
    let (store, data) = try seeded()
    let (child, task) = morningTask(data)
    #expect(!store.toggleCompletion(childID: child, taskID: task, now: date(11, 19, 8, 30)))
    #expect(store.snapshot().completions.count == 0)
}

@MainActor @Test func doubleToggleKeepsAtMostOne() throws {
    let (store, data) = try seeded()
    let (child, task) = morningTask(data)
    #expect(store.toggleCompletion(childID: child, taskID: task, now: date(11, 19, 7)))
    #expect(store.snapshot().completions.count == 1)
    #expect(store.toggleCompletion(childID: child, taskID: task, now: date(11, 19, 7, 1)))
    #expect(store.snapshot().completions.isEmpty)
}

@MainActor @Test func updateScheduleSplits() throws {
    let (store, data) = try seeded()
    let (_, task) = morningTask(data)
    #expect(store.snapshot().schedules.filter { $0.taskID == task }.count == 1)
    store.updateTaskSchedule(taskID: task, slot: .morning, weekdays: [.mon], today: thu)
    let schedules = store.snapshot().schedules.filter { $0.taskID == task }
    #expect(schedules.count == 2)
    #expect(schedules.contains { $0.endOn == wed })
    #expect(schedules.contains { $0.startOn == thu && $0.weekdays == [.mon] })
}

@MainActor @Test func deleteChildRemovesOwnedData() throws {
    let (store, data) = try seeded()
    let first = data.children[0].id
    let second = data.children[1].id
    let task = data.tasks.first { $0.childID == first && $0.title == "세수하기" }!.id
    #expect(store.toggleCompletion(childID: first, taskID: task, now: date(11, 19, 7)))
    let other = data.tasks.first { $0.childID == second && $0.title == "세수하기" }!.id
    #expect(store.toggleCompletion(childID: second, taskID: other, now: date(11, 19, 7)))
    store.deleteChild(id: first)
    let after = store.snapshot()
    #expect(after.children.map(\.id) == [second])
    #expect(after.tasks.allSatisfy { $0.childID == second } && after.tasks.count == 9)
    #expect(after.times.allSatisfy { $0.childID == second } && after.times.count == 7)
    #expect(after.completions.allSatisfy { $0.childID == second } && after.completions.count == 1)
    #expect(after.schedules.count == 9)
}

@MainActor @Test func copyTaskToOtherChild() throws {
    let (store, data) = try seeded()
    let first = data.children[0].id
    let second = data.children[1].id
    let source = data.tasks.first { $0.childID == first && $0.title == "숙제하기" }!
    let newID = store.copyTask(taskID: source.id, to: second, today: thu)
    let after = store.snapshot()
    let copy = after.tasks.first { $0.id == newID }!
    #expect(copy.childID == second)
    #expect(copy.title == source.title && copy.icon == source.icon)
    let a = after.schedules.first { $0.taskID == source.id }!
    let b = after.schedules.first { $0.taskID == newID }!
    #expect(a.slot == b.slot && a.weekdays == b.weekdays)
}

@MainActor @Test func mutationsNotifyObservers() throws {
    let store = try makeStore()
    var count = 0
    let subscription = store.objectWillChange.sink { count += 1 }
    defer { subscription.cancel() }

    store.seedIfEmpty(today: wed)
    #expect(count == 1)
    store.seedIfEmpty(today: wed)
    #expect(count == 1)

    let data = store.snapshot()
    let (child, task) = morningTask(data)
    #expect(store.toggleCompletion(childID: child, taskID: task, now: date(11, 19, 7)))
    #expect(count == 2)
    #expect(!store.toggleCompletion(childID: child, taskID: task, now: date(11, 19, 8, 30)))
    #expect(count == 2)
}

// MARK: PIN and weather location

@MainActor
private func makeContainer() throws -> ModelContainer {
    try KidBoardContainer.make(inMemory: true)
}

@MainActor @Test func pinSetAndVerify() throws {
    let store = try makeStore()
    #expect(!store.hasPin)
    store.setPin("1234")
    #expect(store.hasPin)
    #expect(store.verifyPin("1234", now: date(11, 19, 7)) == .ok)
    #expect(store.verifyPin("0000", now: date(11, 19, 7)) == .wrong)
}

@MainActor @Test func pinLocksAfterFive() throws {
    let store = try makeStore()
    store.setPin("1234")
    let start = date(11, 19, 7)
    for attempt in 0..<4 {
        #expect(store.verifyPin("0000", now: start.addingTimeInterval(Double(attempt))) == .wrong)
    }
    let fifth = start.addingTimeInterval(4)
    #expect(store.verifyPin("0000", now: fifth) == .locked(until: fifth.addingTimeInterval(60)))
    #expect(store.verifyPin("1234", now: fifth.addingTimeInterval(30)) == .locked(until: fifth.addingTimeInterval(60)))
    #expect(store.verifyPin("1234", now: fifth.addingTimeInterval(61)) == .ok)
}

@MainActor @Test func pinLockoutPersistsAcrossStores() throws {
    let container = try makeContainer()
    let store = BoardStore(context: ModelContext(container), calendar: seoul)
    store.setPin("1234")
    let start = date(11, 19, 7)
    for _ in 0..<5 { _ = store.verifyPin("0000", now: start) }
    let reopened = BoardStore(context: ModelContext(container), calendar: seoul)
    #expect(reopened.verifyPin("1234", now: start.addingTimeInterval(10)) == .locked(until: start.addingTimeInterval(60)))
}

@MainActor @Test func weatherLocationPersists() throws {
    let container = try makeContainer()
    let store = BoardStore(context: ModelContext(container), calendar: seoul)
    #expect(store.weatherLocation == nil)
    store.setWeatherLocation(GeoPlace(name: "성남시", admin1: "경기도", latitude: 37.42, longitude: 127.13))
    let reopened = BoardStore(context: ModelContext(container), calendar: seoul)
    #expect(reopened.weatherLocation?.name == "성남시")
    #expect(reopened.weatherLocation?.admin1 == "경기도")
    #expect(reopened.weatherLocation?.latitude == 37.42)
}
