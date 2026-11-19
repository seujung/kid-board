import SwiftUI
import KidBoardCore

/// 할 일 편집 시트의 입력값입니다.
struct TaskDraft: Identifiable {
    let id: UUID
    /// 새 할 일이면 `nil`입니다.
    let taskID: UUID?
    let childID: UUID
    var title: String
    var icon: String
    var slot: TimeSlot
    var weekdays: Set<Weekday>
    private let original: (title: String, icon: String, slot: TimeSlot, weekdays: Set<Weekday>)?

    init(_ task: TaskInfo, schedule: TaskScheduleInfo) {
        id = task.id
        taskID = task.id
        childID = task.childID
        title = task.title
        icon = task.icon
        slot = schedule.slot
        weekdays = schedule.weekdays
        original = (task.title, task.icon, schedule.slot, schedule.weekdays)
    }

    init(childID: UUID, slot: TimeSlot) {
        id = UUID()
        taskID = nil
        self.childID = childID
        title = ""
        icon = TaskEditorView.icons[0]
        self.slot = slot
        weekdays = [.mon, .tue, .wed, .thu, .fri]
        original = nil
    }

    var trimmedTitle: String { title.trimmingCharacters(in: .whitespaces) }
    var appearanceChanged: Bool { original.map { $0.title != trimmedTitle || $0.icon != icon } ?? true }
    var scheduleChanged: Bool { original.map { $0.slot != slot || $0.weekdays != weekdays } ?? true }
}

/// 할 일 하나의 제목, 아이콘, 시간대, 반복 요일을 고칩니다.
///
/// 제목과 아이콘은 `updateTaskAppearance`(지난 날짜까지 반영), 시간대와 요일은
/// `updateTaskSchedule`(오늘부터 반영)로 저장합니다.
struct TaskEditorView: View {
    let store: BoardStore
    @State var draft: TaskDraft
    let today: DayDate
    let onDone: () -> Void

    static let icons = ["🪥", "🧼", "🚿", "🛁", "💧", "👕", "👖", "🧦",
                        "🎒", "🍚", "🥛", "🍎", "📚", "📖", "✏️", "📝",
                        "🧸", "🧹", "🛏️", "🧺", "🍽️", "👟", "💊", "🎹"]

    private var canSave: Bool {
        !draft.trimmedTitle.isEmpty && !draft.icon.isEmpty && !draft.weekdays.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("제목") {
                    TextField("예: 이 닦기", text: $draft.title)
                        .font(.system(size: 22))
                }
                Section("아이콘") {
                    EmojiPicker(choices: Self.icons, selection: $draft.icon, columns: 8)
                }
                Section {
                    Picker("시간대", selection: $draft.slot) {
                        Text("아침").tag(TimeSlot.morning)
                        Text("저녁").tag(TimeSlot.evening)
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("시간대")
                } footer: {
                    if draft.taskID != nil { Text("시간대와 요일을 바꾸면 오늘부터 반영돼요.") }
                }
                Section {
                    WeekdayPicker(selection: $draft.weekdays)
                } header: {
                    Text("반복 요일")
                } footer: {
                    if draft.weekdays.isEmpty {
                        Text("요일을 하나 이상 골라 주세요").foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(draft.taskID == nil ? "할 일 추가" : "할 일 수정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소", action: onDone) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장", action: save).disabled(!canSave)
                }
            }
        }
    }

    private func save() {
        guard canSave else { return }
        if let taskID = draft.taskID {
            if draft.appearanceChanged {
                store.updateTaskAppearance(taskID: taskID, title: draft.trimmedTitle, icon: draft.icon)
            }
            if draft.scheduleChanged {
                store.updateTaskSchedule(taskID: taskID, slot: draft.slot, weekdays: draft.weekdays, today: today)
            }
        } else {
            store.addTask(childID: draft.childID, title: draft.trimmedTitle, icon: draft.icon,
                          slot: draft.slot, weekdays: draft.weekdays, today: today)
        }
        onDone()
    }
}

/// 월~일 요일 켜기/끄기 버튼입니다.
struct WeekdayPicker: View {
    @Binding var selection: Set<Weekday>

    var body: some View {
        HStack(spacing: 10) {
            ForEach(Weekday.allCases, id: \.self) { day in
                let on = selection.contains(day)
                Button {
                    if on { selection.remove(day) } else { selection.insert(day) }
                } label: {
                    Text(day.koreanShort)
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .frame(width: 52, height: 52)
                        .foregroundStyle(on ? Color.white : Color.primary)
                        .background(Circle().fill(on ? Color.accentColor : Color(.tertiarySystemFill)))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(.vertical, 4)
    }

    /// 목록에 보여 줄 요일 요약입니다. 예: "매일", "월~금", "월 수 금"
    static func summary(_ days: Set<Weekday>) -> String {
        let all = Set(Weekday.allCases)
        if days == all { return "매일" }
        if days == [.mon, .tue, .wed, .thu, .fri] { return "월~금" }
        if days == [.sat, .sun] { return "주말" }
        return Weekday.allCases.filter(days.contains).map(\.koreanShort).joined(separator: " ")
    }
}
