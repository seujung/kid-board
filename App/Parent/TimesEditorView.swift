import SwiftUI
import KidBoardCore

/// 시각 설정 화면입니다. 자녀와 요일마다 등교 시각(켜기/끄기)과 잘 준비 시각을 정합니다.
struct TimesEditorView: View {
    @ObservedObject var store: BoardStore

    struct Draft: Equatable {
        var school: TimeOfDay?
        var bed: TimeOfDay

        /// 잘 준비 시각은 등교 시각보다 늦어야 합니다.
        var isValid: Bool { school.map { bed > $0 } ?? true }
    }

    static let invalidMessage = "잘 준비 시각은 등교 시각보다 늦어야 해요"
    private static let defaultSchool = TimeOfDay(hour: 8, minute: 30)

    @State private var childID: UUID?
    /// 자녀 id → 요일 → 입력값입니다. 저장하기 전까지 화면에만 있습니다.
    @State private var drafts: [UUID: [Weekday: Draft]] = [:]
    @State private var saved: [UUID: [Weekday: Draft]] = [:]
    @State private var notice: String?

    private var isValid: Bool { drafts.values.allSatisfy { $0.values.allSatisfy(\.isValid) } }
    private var isDirty: Bool { drafts != saved }

    var body: some View {
        let children = store.snapshot().children
        let selected = childID.flatMap { id in children.first { $0.id == id } } ?? children.first
        Form {
            if children.count > 1 {
                Picker("자녀", selection: Binding(get: { selected?.id }, set: { childID = $0 })) {
                    ForEach(children) { child in
                        Text("\(child.avatar) \(child.name)").tag(Optional(child.id))
                    }
                }
                .pickerStyle(.segmented)
            }
            if let selected {
                Section {
                    ForEach(Weekday.allCases, id: \.self) { day in
                        row(child: selected.id, day: day)
                    }
                } footer: {
                    Text("등교를 끄면 그날은 하루 종일 할 일 목록을 보여 줘요.")
                }
            }
            if !isValid {
                Text(Self.invalidMessage)
                    .foregroundStyle(.red)
                    .font(.system(size: 18, weight: .semibold))
            }
        }
        .navigationTitle(ParentScreen.times.title)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("저장", action: save).disabled(!isValid || !isDirty)
            }
        }
        .safeAreaInset(edge: .bottom) {
            if let notice {
                Text(notice)
                    .font(.system(size: 18, weight: .semibold))
                    .padding(.horizontal, 20).padding(.vertical, 10)
                    .background(Capsule().fill(.thinMaterial))
                    .task(id: notice) {
                        try? await Task.sleep(for: .seconds(3))
                        self.notice = nil
                    }
            }
        }
        .onAppear(perform: load)
    }

    private func row(child: UUID, day: Weekday) -> some View {
        let draft = drafts[child]?[day] ?? Draft(school: nil, bed: TimeOfDay(hour: 21, minute: 30))
        let binding = Binding<Draft>(
            get: { drafts[child]?[day] ?? draft },
            set: { drafts[child, default: [:]][day] = $0 })
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 20) {
                Text(day.koreanShort)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .frame(width: 36)
                Toggle("등교", isOn: Binding(
                    get: { binding.wrappedValue.school != nil },
                    set: { binding.wrappedValue.school = $0 ? Self.defaultSchool : nil }))
                    .fixedSize()
                if draft.school != nil {
                    DatePicker("등교 시각", selection: timeBinding(Binding(
                        get: { binding.wrappedValue.school ?? Self.defaultSchool },
                        set: { binding.wrappedValue.school = $0 })), displayedComponents: .hourAndMinute)
                        .fixedSize()
                }
                Spacer()
                DatePicker("잘 준비", selection: timeBinding(Binding(
                    get: { binding.wrappedValue.bed },
                    set: { binding.wrappedValue.bed = $0 })), displayedComponents: .hourAndMinute)
                    .fixedSize()
            }
            if !draft.isValid {
                Text(Self.invalidMessage)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.red)
            }
        }
        .padding(.vertical, 4)
    }

    /// `TimeOfDay`를 `DatePicker`가 쓰는 `Date`로 바꿉니다. 날짜 부분은 쓰지 않습니다.
    private func timeBinding(_ time: Binding<TimeOfDay>) -> Binding<Date> {
        let calendar = store.calendar
        let base = DayDate(year: 2026, month: 1, day: 1)
        return Binding(
            get: { base.date(at: time.wrappedValue, calendar: calendar) },
            set: {
                let parts = calendar.dateComponents([.hour, .minute], from: $0)
                time.wrappedValue = TimeOfDay(hour: parts.hour ?? 0, minute: parts.minute ?? 0)
            })
    }

    private func load() {
        let data = store.snapshot()
        var result: [UUID: [Weekday: Draft]] = [:]
        for child in data.children {
            for day in Weekday.allCases {
                let times = data.times.first { $0.childID == child.id && $0.weekday == day }
                result[child.id, default: [:]][day] = Draft(
                    school: times?.schoolTime, bed: times?.bedTime ?? TimeOfDay(hour: 21, minute: 30))
            }
        }
        drafts = result
        saved = result
    }

    private func save() {
        guard isValid else { return }
        for (child, days) in drafts {
            for (day, draft) in days where saved[child]?[day] != draft {
                store.setTimes(childID: child, weekday: day, schoolTime: draft.school, bedTime: draft.bed)
            }
        }
        saved = drafts
        notice = "저장했어요"
    }
}
