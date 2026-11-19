import Foundation
import SwiftData
import KidBoardCore

@Model
final class ChildModel {
    @Attribute(.unique) var id: UUID
    var name: String
    var avatar: String
    var themeColor: String
    var order: Int

    init(id: UUID = UUID(), name: String, avatar: String, themeColor: String, order: Int) {
        self.id = id
        self.name = name
        self.avatar = avatar
        self.themeColor = themeColor
        self.order = order
    }

    var info: ChildInfo {
        ChildInfo(id: id, name: name, avatar: avatar, themeColor: themeColor, order: order)
    }
}

@Model
final class TaskModel {
    @Attribute(.unique) var id: UUID
    var childID: UUID
    var title: String
    var icon: String
    var order: Int
    var createdAt: Date
    var archivedYear: Int?
    var archivedMonth: Int?
    var archivedDay: Int?

    init(id: UUID = UUID(), childID: UUID, title: String, icon: String, order: Int, createdAt: Date = Date()) {
        self.id = id
        self.childID = childID
        self.title = title
        self.icon = icon
        self.order = order
        self.createdAt = createdAt
    }

    var archivedOn: DayDate? {
        get {
            guard let archivedYear, let archivedMonth, let archivedDay else { return nil }
            return DayDate(year: archivedYear, month: archivedMonth, day: archivedDay)
        }
        set {
            archivedYear = newValue?.year
            archivedMonth = newValue?.month
            archivedDay = newValue?.day
        }
    }

    var info: TaskInfo {
        TaskInfo(id: id, childID: childID, title: title, icon: icon, order: order, archivedOn: archivedOn)
    }
}

@Model
final class TaskScheduleModel {
    @Attribute(.unique) var id: UUID
    var taskID: UUID
    var slotRaw: String
    var weekdayRaws: [Int]
    var startYear: Int
    var startMonth: Int
    var startDay: Int
    var endYear: Int?
    var endMonth: Int?
    var endDay: Int?

    init(_ info: TaskScheduleInfo) {
        id = info.id
        taskID = info.taskID
        slotRaw = info.slot.rawValue
        weekdayRaws = info.weekdays.map(\.rawValue).sorted()
        startYear = info.startOn.year
        startMonth = info.startOn.month
        startDay = info.startOn.day
        endYear = info.endOn?.year
        endMonth = info.endOn?.month
        endDay = info.endOn?.day
    }

    func apply(_ info: TaskScheduleInfo) {
        taskID = info.taskID
        slotRaw = info.slot.rawValue
        weekdayRaws = info.weekdays.map(\.rawValue).sorted()
        startYear = info.startOn.year
        startMonth = info.startOn.month
        startDay = info.startOn.day
        endYear = info.endOn?.year
        endMonth = info.endOn?.month
        endDay = info.endOn?.day
    }

    var info: TaskScheduleInfo {
        var end: DayDate?
        if let endYear, let endMonth, let endDay {
            end = DayDate(year: endYear, month: endMonth, day: endDay)
        }
        return TaskScheduleInfo(
            id: id,
            taskID: taskID,
            slot: TimeSlot(rawValue: slotRaw) ?? .morning,
            weekdays: Set(weekdayRaws.compactMap(Weekday.init(rawValue:))),
            startOn: DayDate(year: startYear, month: startMonth, day: startDay),
            endOn: end
        )
    }
}

@Model
final class DailyTimesModel {
    var childID: UUID
    var weekdayRaw: Int
    var schoolHour: Int?
    var schoolMinute: Int?
    var bedHour: Int
    var bedMinute: Int

    init(_ info: DailyTimesInfo) {
        childID = info.childID
        weekdayRaw = info.weekday.rawValue
        schoolHour = info.schoolTime?.hour
        schoolMinute = info.schoolTime?.minute
        bedHour = info.bedTime.hour
        bedMinute = info.bedTime.minute
    }

    func apply(schoolTime: TimeOfDay?, bedTime: TimeOfDay) {
        schoolHour = schoolTime?.hour
        schoolMinute = schoolTime?.minute
        bedHour = bedTime.hour
        bedMinute = bedTime.minute
    }

    var info: DailyTimesInfo {
        var school: TimeOfDay?
        if let schoolHour, let schoolMinute { school = TimeOfDay(hour: schoolHour, minute: schoolMinute) }
        return DailyTimesInfo(
            childID: childID,
            weekday: Weekday(rawValue: weekdayRaw) ?? .mon,
            schoolTime: school,
            bedTime: TimeOfDay(hour: bedHour, minute: bedMinute)
        )
    }
}

@Model
final class CompletionModel {
    var childID: UUID
    var taskID: UUID
    var year: Int
    var month: Int
    var dayOfMonth: Int
    var completedAt: Date

    init(childID: UUID, taskID: UUID, day: DayDate, completedAt: Date) {
        self.childID = childID
        self.taskID = taskID
        self.year = day.year
        self.month = day.month
        self.dayOfMonth = day.day
        self.completedAt = completedAt
    }

    var day: DayDate { DayDate(year: year, month: month, day: dayOfMonth) }

    var info: CompletionInfo {
        CompletionInfo(childID: childID, taskID: taskID, day: day, completedAt: completedAt)
    }
}

struct AppSettingsInfo: Equatable {
    var pinHash: String?
    var pinSalt: Data?
    var lockout: PinLockout
    var locationName: String?
    var latitude: Double?
    var longitude: Double?
    var lastSeenProfileCreation: Date?
}

@Model
final class AppSettingsModel {
    var pinHash: String?
    var pinSalt: Data?
    var lockoutFailures: Int
    var lockoutUntil: Date?
    var locationName: String?
    /// 날씨 지역의 시도 이름입니다. 부모 모드 표시에만 씁니다.
    var locationAdmin1: String?
    var latitude: Double?
    var longitude: Double?
    var lastSeenProfileCreation: Date?

    init() {
        lockoutFailures = 0
    }

    var lockout: PinLockout {
        get { PinLockout(failures: lockoutFailures, lockedUntil: lockoutUntil) }
        set {
            lockoutFailures = newValue.failures
            lockoutUntil = newValue.lockedUntil
        }
    }

    var info: AppSettingsInfo {
        AppSettingsInfo(
            pinHash: pinHash, pinSalt: pinSalt, lockout: lockout,
            locationName: locationName, latitude: latitude, longitude: longitude,
            lastSeenProfileCreation: lastSeenProfileCreation
        )
    }
}

@Model
final class WeatherCacheModel {
    var snapshotData: Data?

    init(snapshot: WeatherSnapshot? = nil) {
        snapshotData = snapshot.flatMap { try? JSONEncoder().encode($0) }
    }

    var info: WeatherSnapshot? {
        get { snapshotData.flatMap { try? JSONDecoder().decode(WeatherSnapshot.self, from: $0) } }
        set { snapshotData = newValue.flatMap { try? JSONEncoder().encode($0) } }
    }
}
