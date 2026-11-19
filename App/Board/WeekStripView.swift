import SwiftUI
import KidBoardCore

/// 이번 주 월~일 7칸입니다. 칸을 누르면 그날 할 일을 봅니다.
struct WeekStripView: View {
    struct DayCell: Identifiable, Hashable {
        let day: DayDate
        let weekday: Weekday
        let summary: DaySummary
        var id: DayDate { day }
    }

    let cells: [DayCell]
    let today: DayDate
    /// 읽기 전용으로 보고 있는 날입니다. 없으면 오늘을 보고 있습니다.
    let selected: DayDate?
    let theme: ChildTheme
    var onSelect: (DayDate) -> Void = { _ in }

    /// 이번 주(월요일 시작) 7일을 돌려줍니다.
    static func week(containing today: DayDate, calendar: Calendar) -> [DayDate] {
        let monday = today.adding(days: -(today.weekday(calendar: calendar).rawValue - 1), calendar: calendar)
        return (0..<7).map { monday.adding(days: $0, calendar: calendar) }
    }

    var body: some View {
        HStack(spacing: 6) {
            ForEach(cells) { cell in
                Button { onSelect(cell.day) } label: { cellView(cell) }
                    .buttonStyle(PressableCardStyle())
            }
        }
    }

    private func cellView(_ cell: DayCell) -> some View {
        let isToday = cell.day == today
        let isSelected = (selected ?? today) == cell.day
        return VStack(spacing: 2) {
            Text(cell.weekday.koreanShort)
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(weekdayColor(cell.weekday, isToday: isToday))
            Text("\(cell.day.month)/\(cell.day.day)")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(isToday ? .white.opacity(0.9) : BoardPalette.ink.opacity(0.6))
            ZStack {
                Text("\(cell.summary.done)/\(cell.summary.total)")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(isToday ? .white : BoardPalette.ink)
                    .opacity(cell.summary.isStar ? 0 : 1)
                if cell.summary.isStar {
                    StampView(kind: .star, size: 30)
                }
            }
            .frame(height: 30)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(isToday ? theme.accent : Color.white)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(isSelected && !isToday ? theme.accent : theme.accent.opacity(0.2),
                              lineWidth: isSelected && !isToday ? 3 : 1.5)
        )
        .overlay(alignment: .top) {
            if isToday {
                Text("오늘")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundStyle(theme.accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Color.white))
                    .overlay(Capsule().strokeBorder(theme.accent, lineWidth: 1.5))
                    .offset(y: -15)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(cell.weekday.koreanShort)요일 \(cell.day.month)월 \(cell.day.day)일, \(cell.summary.done)/\(cell.summary.total)\(cell.summary.isStar ? ", 별" : "")\(isToday ? ", 오늘" : "")")
    }

    private func weekdayColor(_ weekday: Weekday, isToday: Bool) -> Color {
        if isToday { return .white }
        switch weekday {
        case .sun: return Color(red: 0.85, green: 0.25, blue: 0.25)
        case .sat: return Color(red: 0.2, green: 0.45, blue: 0.85)
        default: return BoardPalette.ink
        }
    }
}

#Preview("이번 주") {
    let calendar = Calendar.appCalendar
    let today = DayDate(year: 2026, month: 11, day: 19)
    let cells = WeekStripView.week(containing: today, calendar: calendar).enumerated().map { index, day in
        WeekStripView.DayCell(day: day, weekday: day.weekday(calendar: calendar),
                              summary: DaySummary(done: index < 2 ? 9 : (index == 3 ? 3 : 0), total: 9))
    }
    return WeekStripView(cells: cells, today: today, selected: cells[1].day, theme: .named("coral"))
        .padding(30)
        .frame(width: 560)
        .background(BoardPalette.background)
}
