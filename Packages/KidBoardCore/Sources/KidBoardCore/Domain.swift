import Foundation

public enum Weekday: Int, CaseIterable, Codable, Sendable {
    case mon = 1, tue, wed, thu, fri, sat, sun

    public var koreanShort: String {
        switch self {
        case .mon: "월"
        case .tue: "화"
        case .wed: "수"
        case .thu: "목"
        case .fri: "금"
        case .sat: "토"
        case .sun: "일"
        }
    }
}

public enum TimeSlot: String, Codable, Sendable {
    case morning, evening
}

public struct TimeOfDay: Codable, Hashable, Comparable, Sendable {
    public var hour: Int
    public var minute: Int

    public init(hour: Int, minute: Int) {
        self.hour = hour
        self.minute = minute
    }

    public static func < (lhs: TimeOfDay, rhs: TimeOfDay) -> Bool {
        (lhs.hour, lhs.minute) < (rhs.hour, rhs.minute)
    }
}

public struct ChildInfo: Identifiable, Hashable, Sendable {
    public var id: UUID
    public var name: String
    public var avatar: String
    public var themeColor: String
    public var order: Int

    public init(id: UUID, name: String, avatar: String, themeColor: String, order: Int) {
        self.id = id
        self.name = name
        self.avatar = avatar
        self.themeColor = themeColor
        self.order = order
    }
}

public struct TaskInfo: Identifiable, Hashable, Sendable {
    public var id: UUID
    public var childID: UUID
    public var title: String
    public var icon: String
    public var order: Int
    public var archivedOn: DayDate?

    public init(id: UUID, childID: UUID, title: String, icon: String, order: Int, archivedOn: DayDate? = nil) {
        self.id = id
        self.childID = childID
        self.title = title
        self.icon = icon
        self.order = order
        self.archivedOn = archivedOn
    }
}

public struct TaskScheduleInfo: Identifiable, Hashable, Sendable {
    public var id: UUID
    public var taskID: UUID
    public var slot: TimeSlot
    public var weekdays: Set<Weekday>
    public var startOn: DayDate
    public var endOn: DayDate?

    public init(id: UUID, taskID: UUID, slot: TimeSlot, weekdays: Set<Weekday>, startOn: DayDate, endOn: DayDate? = nil) {
        self.id = id
        self.taskID = taskID
        self.slot = slot
        self.weekdays = weekdays
        self.startOn = startOn
        self.endOn = endOn
    }
}

public struct DailyTimesInfo: Hashable, Sendable {
    public var childID: UUID
    public var weekday: Weekday
    public var schoolTime: TimeOfDay?
    public var bedTime: TimeOfDay

    public init(childID: UUID, weekday: Weekday, schoolTime: TimeOfDay?, bedTime: TimeOfDay) {
        self.childID = childID
        self.weekday = weekday
        self.schoolTime = schoolTime
        self.bedTime = bedTime
    }
}

public struct CompletionInfo: Hashable, Sendable {
    public var childID: UUID
    public var taskID: UUID
    public var day: DayDate
    public var completedAt: Date

    public init(childID: UUID, taskID: UUID, day: DayDate, completedAt: Date) {
        self.childID = childID
        self.taskID = taskID
        self.day = day
        self.completedAt = completedAt
    }
}

public struct BoardData: Sendable {
    public var children: [ChildInfo]
    public var tasks: [TaskInfo]
    public var schedules: [TaskScheduleInfo]
    public var times: [DailyTimesInfo]
    public var completions: [CompletionInfo]

    public init(
        children: [ChildInfo] = [],
        tasks: [TaskInfo] = [],
        schedules: [TaskScheduleInfo] = [],
        times: [DailyTimesInfo] = [],
        completions: [CompletionInfo] = []
    ) {
        self.children = children
        self.tasks = tasks
        self.schedules = schedules
        self.times = times
        self.completions = completions
    }
}
