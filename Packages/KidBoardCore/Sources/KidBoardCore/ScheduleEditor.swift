import Foundation

public enum ScheduleEditor {
    /// 오늘부터 적용되는 일정 변경을 반영한 일정 목록을 돌려줍니다. 과거 기록이 바뀌지 않도록 필요하면 일정을 나눕니다.
    public static func change(
        _ schedules: [TaskScheduleInfo],
        taskID: UUID,
        slot: TimeSlot,
        weekdays: Set<Weekday>,
        today: DayDate,
        calendar: Calendar,
        newID: UUID = UUID()
    ) -> [TaskScheduleInfo] {
        var result = schedules
        let current = result.firstIndex {
            $0.taskID == taskID && $0.startOn <= today && ($0.endOn.map { today <= $0 } ?? true)
        }
        if let index = current {
            if result[index].startOn == today {
                result[index].slot = slot
                result[index].weekdays = weekdays
                return result
            }
            result[index].endOn = today.adding(days: -1, calendar: calendar)
        }
        result.append(TaskScheduleInfo(id: newID, taskID: taskID, slot: slot, weekdays: weekdays, startOn: today))
        return result
    }
}
