import Foundation
import KidBoardCore

enum SeedData {
    struct SeedTask {
        let title: String
        let icon: String
        let slot: TimeSlot
        let weekdays: Set<Weekday>
    }

    static let children: [(name: String, avatar: String, themeColor: String)] = [
        ("첫째", "🐰", "coral"),
        ("둘째", "🐻", "sky"),
    ]

    static let weekdaysOnly: Set<Weekday> = [.mon, .tue, .wed, .thu, .fri]
    static let everyDay: Set<Weekday> = Set(Weekday.allCases)

    static let tasks: [SeedTask] = [
        SeedTask(title: "세수하기", icon: "🧼", slot: .morning, weekdays: weekdaysOnly),
        SeedTask(title: "옷 입기", icon: "👕", slot: .morning, weekdays: weekdaysOnly),
        SeedTask(title: "아침 먹기", icon: "🍚", slot: .morning, weekdays: weekdaysOnly),
        SeedTask(title: "양치하기", icon: "🪥", slot: .morning, weekdays: weekdaysOnly),
        SeedTask(title: "가방 챙기기", icon: "🎒", slot: .morning, weekdays: weekdaysOnly),
        SeedTask(title: "숙제하기", icon: "📚", slot: .evening, weekdays: everyDay),
        SeedTask(title: "책 읽기", icon: "📖", slot: .evening, weekdays: everyDay),
        SeedTask(title: "내일 준비물 챙기기", icon: "✏️", slot: .evening, weekdays: everyDay),
        SeedTask(title: "샤워하기", icon: "🛁", slot: .evening, weekdays: everyDay),
    ]

    static func times(for weekday: Weekday) -> (school: TimeOfDay?, bed: TimeOfDay) {
        let bed = TimeOfDay(hour: 21, minute: 30)
        switch weekday {
        case .sat, .sun: return (nil, bed)
        default: return (TimeOfDay(hour: 8, minute: 20), bed)
        }
    }
}
