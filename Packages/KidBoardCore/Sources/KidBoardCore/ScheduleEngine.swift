import Foundation

public struct ScheduledTask: Identifiable, Hashable, Sendable {
    public var task: TaskInfo
    public var slot: TimeSlot
    public var id: UUID { task.id }

    public init(task: TaskInfo, slot: TimeSlot) {
        self.task = task
        self.slot = slot
    }
}

public struct DaySummary: Hashable, Sendable {
    public var done: Int
    public var total: Int
    public var isStar: Bool { total > 0 && done == total }

    public init(done: Int, total: Int) {
        self.done = done
        self.total = total
    }
}

public struct ScheduleEngine: Sendable {
    public let calendar: Calendar

    public init(calendar: Calendar) {
        self.calendar = calendar
    }

    public func tasks(childID: UUID, on day: DayDate, data: BoardData) -> [ScheduledTask] {
        let weekday = day.weekday(calendar: calendar)
        var result: [ScheduledTask] = []
        for task in data.tasks where task.childID == childID {
            if let archivedOn = task.archivedOn, archivedOn <= day { continue }
            guard let schedule = data.schedules.first(where: {
                $0.taskID == task.id
                    && $0.startOn <= day
                    && ($0.endOn.map { day <= $0 } ?? true)
                    && $0.weekdays.contains(weekday)
            }) else { continue }
            result.append(ScheduledTask(task: task, slot: schedule.slot))
        }
        return result.sorted { lhs, rhs in
            if lhs.slot != rhs.slot { return lhs.slot == .morning }
            return lhs.task.order < rhs.task.order
        }
    }

    public func summary(childID: UUID, on day: DayDate, data: BoardData) -> DaySummary {
        let scheduled = tasks(childID: childID, on: day, data: data)
        let doneIDs = Set(data.completions.filter { $0.childID == childID && $0.day == day }.map(\.taskID))
        return DaySummary(done: scheduled.filter { doneIDs.contains($0.id) }.count, total: scheduled.count)
    }

    public func times(childID: UUID, on day: DayDate, data: BoardData) -> DailyTimesInfo {
        let weekday = day.weekday(calendar: calendar)
        return data.times.first { $0.childID == childID && $0.weekday == weekday }
            ?? DailyTimesInfo(childID: childID, weekday: weekday, schoolTime: nil, bedTime: TimeOfDay(hour: 21, minute: 30))
    }
}
