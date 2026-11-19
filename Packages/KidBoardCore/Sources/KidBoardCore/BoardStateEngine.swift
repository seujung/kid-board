import Foundation

public enum BoardPhase: Hashable, Sendable {
    case morning(deadline: Date)
    case evening(deadline: Date)
    case allDay(deadline: Date)
    case finished(allDone: Bool)
}

public struct ChildBoardState: Hashable, Sendable {
    public var child: ChildInfo
    public var day: DayDate
    public var phase: BoardPhase
    public var visibleTasks: [ScheduledTask]
    public var doneTaskIDs: Set<UUID>
    public var nowTaskID: UUID?
    public var remaining: Int
    public var progress: Double

    public init(
        child: ChildInfo, day: DayDate, phase: BoardPhase, visibleTasks: [ScheduledTask],
        doneTaskIDs: Set<UUID>, nowTaskID: UUID?, remaining: Int, progress: Double
    ) {
        self.child = child
        self.day = day
        self.phase = phase
        self.visibleTasks = visibleTasks
        self.doneTaskIDs = doneTaskIDs
        self.nowTaskID = nowTaskID
        self.remaining = remaining
        self.progress = progress
    }
}

public struct BoardStateEngine: Sendable {
    public let calendar: Calendar

    public init(calendar: Calendar) {
        self.calendar = calendar
    }

    public func state(for child: ChildInfo, now: Date, data: BoardData) -> ChildBoardState {
        let schedule = ScheduleEngine(calendar: calendar)
        let day = DayDate(now, calendar: calendar)
        let all = schedule.tasks(childID: child.id, on: day, data: data)
        let times = schedule.times(childID: child.id, on: day, data: data)
        let bed = day.date(at: times.bedTime, calendar: calendar)
        let school = times.schoolTime.map { day.date(at: $0, calendar: calendar) }

        let phase: BoardPhase
        let visible: [ScheduledTask]
        if let school {
            if now < school {
                phase = .morning(deadline: school)
                visible = all.filter { $0.slot == .morning }
            } else {
                visible = all.filter { $0.slot == .evening }
                phase = now < bed ? .evening(deadline: bed) : .finished(allDone: Self.allDone(schedule, child, day, data))
            }
        } else {
            visible = all
            phase = now < bed ? .allDay(deadline: bed) : .finished(allDone: Self.allDone(schedule, child, day, data))
        }

        let completedIDs = Set(data.completions.filter { $0.childID == child.id && $0.day == day }.map(\.taskID))
        let doneIDs = Set(visible.map(\.id)).intersection(completedIDs)
        let remaining = visible.count - doneIDs.count
        var nowTaskID: UUID?
        if case .finished = phase {} else {
            nowTaskID = visible.first { !doneIDs.contains($0.id) }?.id
        }
        return ChildBoardState(
            child: child, day: day, phase: phase, visibleTasks: visible, doneTaskIDs: doneIDs,
            nowTaskID: nowTaskID, remaining: remaining,
            progress: visible.isEmpty ? 0 : Double(doneIDs.count) / Double(visible.count)
        )
    }

    public func canToggle(taskID: UUID, childID: UUID, now: Date, data: BoardData) -> Bool {
        guard let child = data.children.first(where: { $0.id == childID }) else { return false }
        let state = state(for: child, now: now, data: data)
        if case .finished = state.phase { return false }
        return state.visibleTasks.contains { $0.id == taskID }
    }

    private static func allDone(_ schedule: ScheduleEngine, _ child: ChildInfo, _ day: DayDate, _ data: BoardData) -> Bool {
        let summary = schedule.summary(childID: child.id, on: day, data: data)
        return summary.done == summary.total
    }
}

public enum BoardCopy {
    public static func countdownLabel(_ phase: BoardPhase) -> String? {
        switch phase {
        case .morning: "등교까지"
        case .evening, .allDay: "잘 준비까지"
        case .finished: nil
        }
    }

    public static func remainingText(_ remaining: Int) -> String {
        remaining >= 1 ? "할 일 \(remaining)개 남았어!" : "다 했어! 최고야!"
    }

    public static func finishedText(allDone: Bool) -> String {
        allDone ? "오늘 수고했어!" : "내일 또 해 보자"
    }
}
