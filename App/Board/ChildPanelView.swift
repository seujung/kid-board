import SwiftUI
import KidBoardCore

/// 자녀 한 명의 패널입니다. 카운트다운, 이번 주, 할 일 카드를 표시합니다.
struct ChildPanelView: View {
    let store: BoardStore
    let clock: BoardClock
    let state: ChildBoardState
    let data: BoardData
    let now: Date

    /// 읽기 전용으로 보고 있는 다른 날입니다.
    @State private var selectedDay: DayDate?
    /// 패널을 만질 때마다 늘어납니다. 30초 자동 복귀 타이머를 다시 시작합니다.
    @State private var interactions = 0
    @State private var stampedTaskID: UUID?
    @State private var pendingUndo: ScheduledTask?
    @State private var shakes: [UUID: Int] = [:]
    @State private var celebrating = false

    static let readOnlyTimeout: Duration = .seconds(30)

    init(store: BoardStore, clock: BoardClock, state: ChildBoardState, data: BoardData, now: Date,
         initialSelectedDay: DayDate? = nil) {
        self.store = store
        self.clock = clock
        self.state = state
        self.data = data
        self.now = now
        _selectedDay = State(initialValue: initialSelectedDay)
    }

    private var theme: ChildTheme { .named(state.child.themeColor) }
    private var calendar: Calendar { store.calendar }
    private var schedule: ScheduleEngine { ScheduleEngine(calendar: calendar) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 14) {
                nameTag
                CountdownCard(phase: state.phase, now: now, remaining: state.remaining,
                              progress: state.progress, theme: theme)
            }
            WeekStripView(cells: weekCells, today: state.day, selected: selectedDay, theme: theme) { day in
                withAnimation(.easeInOut(duration: 0.2)) { selectedDay = day == state.day ? nil : day }
            }
            .padding(.top, 10)
            if let selectedDay {
                readOnlyList(selectedDay)
            } else {
                todayList
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(RoundedRectangle(cornerRadius: 28).fill(theme.panel))
        .overlay(RoundedRectangle(cornerRadius: 28).strokeBorder(theme.accent, lineWidth: 3))
        .overlay { if celebrating { CelebrationView().allowsHitTesting(false) } }
        .simultaneousGesture(TapGesture().onEnded { interactions += 1 })
        .task(id: ReturnTimerKey(day: selectedDay, interactions: interactions)) {
            guard selectedDay != nil else { return }
            try? await Task.sleep(for: Self.readOnlyTimeout)
            guard !Task.isCancelled else { return }
            withAnimation { selectedDay = nil }
        }
        .alert("취소할까요?", isPresented: undoBinding, presenting: pendingUndo) { task in
            Button("아니요", role: .cancel) {}
            Button("네, 취소할래요", role: .destructive) {
                _ = store.toggleCompletion(childID: state.child.id, taskID: task.id, now: clock.now())
            }
        } message: { task in
            Text("\(task.task.icon) \(task.task.title)")
        }
    }

    private struct ReturnTimerKey: Hashable {
        let day: DayDate?
        let interactions: Int
    }

    private var undoBinding: Binding<Bool> {
        Binding(get: { pendingUndo != nil }, set: { if !$0 { pendingUndo = nil } })
    }

    private var nameTag: some View {
        VStack(spacing: 4) {
            Text(state.child.avatar)
                .font(.system(size: 48))
                .frame(width: 76, height: 76)
                .background(Circle().fill(Color.white))
                .overlay(Circle().strokeBorder(theme.accent, lineWidth: 3))
            Text(state.child.name)
                .font(.system(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(theme.accent)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(width: 96)
    }

    private var weekCells: [WeekStripView.DayCell] {
        WeekStripView.week(containing: state.day, calendar: calendar).map { day in
            WeekStripView.DayCell(day: day, weekday: day.weekday(calendar: calendar),
                                  summary: schedule.summary(childID: state.child.id, on: day, data: data))
        }
    }

    // MARK: Today

    private var todayList: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("\(slotTitle) \(state.doneTaskIDs.count)/\(state.visibleTasks.count)")
            taskGrid(state.visibleTasks) { index, task, height in
                TaskCardView(number: index + 1, task: task.task,
                             isDone: state.doneTaskIDs.contains(task.id),
                             isNow: state.nowTaskID == task.id, theme: theme,
                             animateStamp: stampedTaskID == task.id,
                             shakes: shakes[task.id, default: 0], height: height) { tap(task) }
            }
        }
    }

    private var slotTitle: String {
        switch state.phase {
        case .morning: return "아침 할 일"
        case .evening: return "저녁 할 일"
        case .allDay: return "오늘 할 일"
        case .finished:
            let times = schedule.times(childID: state.child.id, on: state.day, data: data)
            return times.schoolTime == nil ? "오늘 할 일" : "저녁 할 일"
        }
    }

    private func tap(_ task: ScheduledTask) {
        let current = store.snapshot()
        let engine = BoardStateEngine(calendar: calendar)
        let tapNow = clock.now()
        guard engine.canToggle(taskID: task.id, childID: state.child.id, now: tapNow, data: current) else {
            shakes[task.id, default: 0] += 1
            return
        }
        if state.doneTaskIDs.contains(task.id) {
            pendingUndo = task
            return
        }
        guard store.toggleCompletion(childID: state.child.id, taskID: task.id, now: tapNow) else {
            shakes[task.id, default: 0] += 1
            return
        }
        stampedTaskID = task.id
        let after = engine.state(for: state.child, now: tapNow, data: store.snapshot())
        if after.remaining == 0 && !after.visibleTasks.isEmpty { celebrate() }
    }

    private func celebrate() {
        celebrating = true
        Task {
            try? await Task.sleep(for: CelebrationView.duration)
            withAnimation(.easeOut(duration: 0.3)) { celebrating = false }
        }
    }

    // MARK: Read-only day

    private func readOnlyList(_ day: DayDate) -> some View {
        let tasks = schedule.tasks(childID: state.child.id, on: day, data: data)
        let done = Set(data.completions.filter { $0.childID == state.child.id && $0.day == day }.map(\.taskID))
        let weekday = day.weekday(calendar: calendar)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                sectionTitle("\(day.month)월 \(day.day)일 \(weekday.koreanShort)요일 할 일 \(tasks.filter { done.contains($0.id) }.count)/\(tasks.count)")
                Spacer()
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { selectedDay = nil }
                } label: {
                    Label("오늘로", systemImage: "arrow.uturn.backward")
                        .font(.system(size: 18, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(theme.accent))
                }
            }
            if tasks.isEmpty {
                Text("이날은 할 일이 없어요")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundStyle(BoardPalette.ink.opacity(0.6))
                    .frame(maxWidth: .infinity, minHeight: 120)
            }
            taskGrid(tasks) { index, task, height in
                TaskCardView(number: index + 1, task: task.task, isDone: done.contains(task.id),
                             isNow: false, theme: theme, height: height)
                    .allowsHitTesting(false)
            }
        }
    }

    // MARK: Shared

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 22, weight: .heavy, design: .rounded))
            .foregroundStyle(BoardPalette.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }

    /// 할 일 카드를 남은 높이에 맞춰 격자로 놓습니다. 카드가 너무 작아지면 스크롤합니다.
    private func taskGrid<Item: Identifiable, Card: View>(
        _ items: [Item], @ViewBuilder card: @escaping (Int, Item, CGFloat) -> Card
    ) -> some View {
        GeometryReader { geo in
            let spacing: CGFloat = 12
            let rowSpacing: CGFloat = 20
            let topInset: CGFloat = 14
            let columns = max(1, Int((geo.size.width + spacing) / (Self.minCardWidth + spacing)))
            let rows = max(1, (items.count + columns - 1) / columns)
            let fitted = (geo.size.height - topInset - 8 - rowSpacing * CGFloat(rows - 1)) / CGFloat(rows)
            let height = min(150, max(Self.minCardHeight, fitted))
            ScrollView {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: spacing), count: columns),
                          spacing: rowSpacing) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        card(index, item, height)
                    }
                }
                .padding(.top, topInset)
                .padding(.horizontal, 4)
                .padding(.bottom, 8)
            }
            .scrollIndicators(.hidden)
            .scrollDisabled(fitted >= Self.minCardHeight)
        }
    }

    static let minCardWidth: CGFloat = 150
    static let minCardHeight: CGFloat = 104
}

#if DEBUG
#Preview("자녀 패널 (목 07:42)") {
    let preview = BoardPreview(now: BoardPreview.thursdayMorning)
    let child = preview.data.children[0]
    return ChildPanelView(store: preview.store, clock: preview.clock,
                          state: preview.state(for: child), data: preview.data, now: preview.now)
        .padding(20)
        .frame(width: 600, height: 620)
        .background(BoardPalette.background)
}

#Preview("다른 날 보기 (월)") {
    let preview = BoardPreview(now: BoardPreview.thursdayMorning)
    let child = preview.data.children[1]
    return ChildPanelView(store: preview.store, clock: preview.clock,
                          state: preview.state(for: child), data: preview.data, now: preview.now,
                          initialSelectedDay: DayDate(year: 2026, month: 11, day: 16))
        .padding(20)
        .frame(width: 600, height: 620)
        .background(BoardPalette.background)
}
#endif
