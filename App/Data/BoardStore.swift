import Foundation
import SwiftData
import KidBoardCore

extension Calendar {
    /// 앱 전체에서 쓰는 달력입니다. 저장되는 DayDate가 서기 연도가 되도록 그레고리력으로 고정합니다.
    static var appCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        return calendar
    }
}

/// `BoardStore.verifyPin`의 결과입니다.
enum PinResult: Equatable {
    case ok
    case wrong
    case locked(until: Date)
}

@MainActor
final class BoardStore: ObservableObject {
    let context: ModelContext
    let calendar: Calendar

    init(context: ModelContext, calendar: Calendar = Calendar.appCalendar) {
        self.context = context
        self.calendar = calendar
    }

    // MARK: Fetch helpers

    private func all<T: PersistentModel>(_ type: T.Type) -> [T] {
        (try? context.fetch(FetchDescriptor<T>())) ?? []
    }

    /// 여러 변경을 묶을 때 알림을 한 번만 보내기 위한 중첩 깊이입니다.
    private var batchDepth = 0

    private func save() {
        try? context.save()
        if batchDepth == 0 { objectWillChange.send() }
    }

    private func batch(_ body: () -> Void) {
        batchDepth += 1
        body()
        batchDepth -= 1
        save()
    }

    private func taskModel(_ id: UUID) -> TaskModel? {
        all(TaskModel.self).first { $0.id == id }
    }

    private func tasks(of childID: UUID, slot: TimeSlot? = nil) -> [TaskModel] {
        let schedules = all(TaskScheduleModel.self).map(\.info)
        return all(TaskModel.self)
            .filter { $0.childID == childID && $0.archivedOn == nil }
            .filter { task in
                guard let slot else { return true }
                return schedules.contains { $0.taskID == task.id && $0.slot == slot && $0.endOn == nil }
            }
            .sorted { $0.order < $1.order }
    }

    // MARK: Snapshot

    func snapshot() -> BoardData {
        BoardData(
            children: all(ChildModel.self).map(\.info).sorted { $0.order < $1.order },
            tasks: all(TaskModel.self).map(\.info),
            schedules: all(TaskScheduleModel.self).map(\.info),
            times: all(DailyTimesModel.self).map(\.info),
            completions: all(CompletionModel.self).map(\.info)
        )
    }

    // MARK: Settings

    func settings() -> AppSettingsModel {
        if let existing = all(AppSettingsModel.self).first { return existing }
        let created = AppSettingsModel()
        context.insert(created)
        try? context.save()
        return created
    }

    func setLastSeenProfileCreation(_ date: Date) {
        settings().lastSeenProfileCreation = date
        save()
    }

    // MARK: PIN

    var hasPin: Bool { settings().pinHash != nil }

    /// 새 salt로 PIN 해시를 저장하고 잠금 상태를 풉니다.
    func setPin(_ pin: String) {
        let settings = settings()
        let salt = PinHasher.makeSalt()
        settings.pinSalt = salt
        settings.pinHash = PinHasher.hash(pin: pin, salt: salt)
        settings.lockout = PinLockout()
        save()
    }

    /// PIN을 확인합니다. 실패 횟수와 잠금 시각은 `AppSettingsModel`에 저장하므로 다시 실행해도 유지됩니다.
    func verifyPin(_ pin: String, now: Date) -> PinResult {
        let settings = settings()
        var lockout = settings.lockout
        if lockout.isLocked(now: now), let until = lockout.lockedUntil { return .locked(until: until) }
        guard let hash = settings.pinHash, let salt = settings.pinSalt else { return .wrong }
        let result: PinResult
        if PinHasher.hash(pin: pin, salt: salt) == hash {
            lockout.recordSuccess()
            result = .ok
        } else {
            lockout.recordFailure(now: now)
            if lockout.isLocked(now: now), let until = lockout.lockedUntil {
                result = .locked(until: until)
            } else {
                result = .wrong
            }
        }
        settings.lockout = lockout
        save()
        return result
    }

    /// 잠겨 있으면 풀리는 시각을 돌려줍니다.
    func pinLockedUntil(now: Date) -> Date? {
        let lockout = settings().lockout
        return lockout.isLocked(now: now) ? lockout.lockedUntil : nil
    }

    // MARK: Weather location

    var weatherLocation: GeoPlace? {
        let settings = settings()
        guard let name = settings.locationName, let latitude = settings.latitude,
              let longitude = settings.longitude else { return nil }
        return GeoPlace(name: name, admin1: settings.locationAdmin1, latitude: latitude, longitude: longitude)
    }

    func setWeatherLocation(_ place: GeoPlace) {
        let settings = settings()
        settings.locationName = place.name
        settings.locationAdmin1 = place.admin1
        settings.latitude = place.latitude
        settings.longitude = place.longitude
        save()
    }

    // MARK: Seed

    func seedIfEmpty(today: DayDate) {
        guard all(ChildModel.self).isEmpty else { return }
        batch {
        for (index, seed) in SeedData.children.enumerated() {
            let childID = addChild(name: seed.name, avatar: seed.avatar, themeColor: seed.themeColor)
            if let child = all(ChildModel.self).first(where: { $0.id == childID }) { child.order = index }
            for weekday in Weekday.allCases {
                let times = SeedData.times(for: weekday)
                context.insert(DailyTimesModel(DailyTimesInfo(
                    childID: childID, weekday: weekday, schoolTime: times.school, bedTime: times.bed)))
            }
            for task in SeedData.tasks {
                _ = addTask(childID: childID, title: task.title, icon: task.icon,
                            slot: task.slot, weekdays: task.weekdays, today: today)
            }
        }
        }
    }

    // MARK: Children

    @discardableResult
    func addChild(name: String, avatar: String, themeColor: String) -> UUID {
        let order = (all(ChildModel.self).map(\.order).max() ?? -1) + 1
        let child = ChildModel(name: name, avatar: avatar, themeColor: themeColor, order: order)
        context.insert(child)
        save()
        return child.id
    }

    func updateChild(_ info: ChildInfo) {
        guard let child = all(ChildModel.self).first(where: { $0.id == info.id }) else { return }
        child.name = info.name
        child.avatar = info.avatar
        child.themeColor = info.themeColor
        child.order = info.order
        save()
    }

    func deleteChild(id: UUID) {
        let taskIDs = Set(all(TaskModel.self).filter { $0.childID == id }.map(\.id))
        for schedule in all(TaskScheduleModel.self) where taskIDs.contains(schedule.taskID) { context.delete(schedule) }
        for task in all(TaskModel.self) where task.childID == id { context.delete(task) }
        for times in all(DailyTimesModel.self) where times.childID == id { context.delete(times) }
        for completion in all(CompletionModel.self) where completion.childID == id { context.delete(completion) }
        for child in all(ChildModel.self) where child.id == id { context.delete(child) }
        save()
    }

    // MARK: Tasks

    @discardableResult
    func addTask(childID: UUID, title: String, icon: String, slot: TimeSlot,
                 weekdays: Set<Weekday>, today: DayDate) -> UUID {
        let order = (all(TaskModel.self).filter { $0.childID == childID }.map(\.order).max() ?? -1) + 1
        let task = TaskModel(childID: childID, title: title, icon: icon, order: order)
        context.insert(task)
        context.insert(TaskScheduleModel(TaskScheduleInfo(
            id: UUID(), taskID: task.id, slot: slot, weekdays: weekdays, startOn: today)))
        save()
        return task.id
    }

    func updateTaskAppearance(taskID: UUID, title: String, icon: String) {
        guard let task = taskModel(taskID) else { return }
        task.title = title
        task.icon = icon
        save()
    }

    func updateTaskSchedule(taskID: UUID, slot: TimeSlot, weekdays: Set<Weekday>, today: DayDate) {
        let existing = all(TaskScheduleModel.self)
        let updated = ScheduleEditor.change(
            existing.map(\.info), taskID: taskID, slot: slot, weekdays: weekdays,
            today: today, calendar: calendar)
        for info in updated {
            if let model = existing.first(where: { $0.id == info.id }) {
                model.apply(info)
            } else {
                context.insert(TaskScheduleModel(info))
            }
        }
        save()
    }

    func archiveTask(taskID: UUID, today: DayDate) {
        taskModel(taskID)?.archivedOn = today
        save()
    }

    func moveTask(childID: UUID, slot: TimeSlot, from: IndexSet, to: Int) {
        var ordered = tasks(of: childID, slot: slot)
        let slots = ordered.map(\.order).sorted()
        ordered.move(fromOffsets: from, toOffset: to)
        for (task, order) in zip(ordered, slots) { task.order = order }
        save()
    }

    @discardableResult
    func copyTask(taskID: UUID, to childID: UUID, today: DayDate) -> UUID {
        guard let source = taskModel(taskID) else { return UUID() }
        let schedule = all(TaskScheduleModel.self).map(\.info)
            .filter { $0.taskID == taskID && $0.endOn == nil }
            .max { $0.startOn < $1.startOn }
        return addTask(
            childID: childID, title: source.title, icon: source.icon,
            slot: schedule?.slot ?? .morning, weekdays: schedule?.weekdays ?? Set(Weekday.allCases),
            today: today)
    }

    // MARK: Times

    func setTimes(childID: UUID, weekday: Weekday, schoolTime: TimeOfDay?, bedTime: TimeOfDay) {
        if let model = all(DailyTimesModel.self).first(where: { $0.childID == childID && $0.weekdayRaw == weekday.rawValue }) {
            model.apply(schoolTime: schoolTime, bedTime: bedTime)
        } else {
            context.insert(DailyTimesModel(DailyTimesInfo(
                childID: childID, weekday: weekday, schoolTime: schoolTime, bedTime: bedTime)))
        }
        save()
    }

    // MARK: Completion

    func toggleCompletion(childID: UUID, taskID: UUID, now: Date) -> Bool {
        let data = snapshot()
        guard BoardStateEngine(calendar: calendar).canToggle(taskID: taskID, childID: childID, now: now, data: data)
        else { return false }
        let day = DayDate(now, calendar: calendar)
        let existing = all(CompletionModel.self).filter {
            $0.childID == childID && $0.taskID == taskID && $0.day == day
        }
        if existing.isEmpty {
            context.insert(CompletionModel(childID: childID, taskID: taskID, day: day, completedAt: now))
        } else {
            for record in existing { context.delete(record) }
        }
        save()
        return true
    }
}
