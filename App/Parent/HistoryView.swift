import SwiftUI
import KidBoardCore

/// 완료 기록 화면입니다. 오늘까지 최근 28일을 최근 날짜부터 자녀별로 보여 줍니다.
struct HistoryView: View {
    @ObservedObject var store: BoardStore
    let clock: BoardClock

    static let dayCount = 28

    /// 오늘부터 거꾸로 `dayCount`일입니다.
    static func days(endingAt today: DayDate, calendar: Calendar) -> [DayDate] {
        (0..<dayCount).map { today.adding(days: -$0, calendar: calendar) }
    }

    /// 한 칸에 쓰는 글자입니다. 할 일이 없는 날은 "-"입니다.
    static func cellText(_ summary: DaySummary) -> String {
        guard summary.total > 0 else { return "-" }
        return "\(summary.done)/\(summary.total)" + (summary.isStar ? " ★" : "")
    }

    var body: some View {
        let calendar = store.calendar
        let data = store.snapshot()
        let schedule = ScheduleEngine(calendar: calendar)
        let today = DayDate(clock.now(), calendar: calendar)
        List {
            Section {
                ForEach(Self.days(endingAt: today, calendar: calendar), id: \.self) { day in
                    HStack {
                        Text(dateLabel(day, calendar: calendar))
                            .font(.system(size: 19, weight: day == today ? .bold : .regular))
                            .monospacedDigit()
                            .frame(width: 140, alignment: .leading)
                        ForEach(data.children) { child in
                            let summary = schedule.summary(childID: child.id, on: day, data: data)
                            Text(Self.cellText(summary))
                                .font(.system(size: 19, weight: summary.isStar ? .bold : .regular))
                                .foregroundStyle(summary.isStar ? ChildTheme.named(child.themeColor).accent : .primary)
                                .monospacedDigit()
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            } header: {
                HStack {
                    Text("날짜").frame(width: 140, alignment: .leading)
                    ForEach(data.children) { child in
                        Text("\(child.avatar) \(child.name)")
                            .frame(maxWidth: .infinity)
                    }
                }
                .font(.system(size: 17, weight: .semibold))
            } footer: {
                Text("완료한 할 일 수 / 그날 할 일 수. 모두 끝낸 날은 ★로 표시해요.")
            }
        }
        .navigationTitle(ParentScreen.history.title)
    }

    private func dateLabel(_ day: DayDate, calendar: Calendar) -> String {
        BoardFormat.format(day.date(at: TimeOfDay(hour: 12, minute: 0), calendar: calendar), "M/d (E)",
                           calendar: calendar)
    }
}
