import SwiftUI
import KidBoardCore

/// 할 일 관리 화면입니다. 자녀를 고르면 아침과 저녁 목록을 따로 보여 줍니다.
struct TaskListEditorView: View {
    @ObservedObject var store: BoardStore
    let clock: BoardClock
    /// 스크린숏용입니다. 화면이 열리면 첫 아침 할 일의 편집 시트를 띄웁니다.
    var opensFirstEditor = false

    @State private var childID: UUID?
    @State private var editing: TaskDraft?
    @State private var archiving: TaskInfo?
    @State private var copying: TaskInfo?
    @State private var editMode: EditMode = .inactive
    @State private var notice: String?

    private var today: DayDate { DayDate(clock.now(), calendar: store.calendar) }

    var body: some View {
        let data = store.snapshot()
        let selected = childID.flatMap { id in data.children.first { $0.id == id } } ?? data.children.first
        List {
            if data.children.count > 1 {
                Section {
                    Picker("자녀", selection: Binding(get: { selected?.id }, set: { childID = $0 })) {
                        ForEach(data.children) { child in
                            Text("\(child.avatar) \(child.name)").tag(Optional(child.id))
                        }
                    }
                    .pickerStyle(.segmented)
                } footer: {
                    Text("할 일을 누르면 고칠 수 있어요. 왼쪽으로 밀면 지우기와 다른 자녀에게 복사가 나와요.")
                }
            }
            if let selected {
                slotSection(.morning, child: selected, data: data)
                slotSection(.evening, child: selected, data: data)
            } else {
                Text("먼저 자녀 관리에서 자녀를 추가해 주세요.")
            }
        }
        .environment(\.editMode, $editMode)
        .navigationTitle(ParentScreen.tasks.title)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(editMode.isEditing ? "완료" : "순서 바꾸기") {
                    withAnimation { editMode = editMode.isEditing ? .inactive : .active }
                }
            }
        }
        .onAppear {
            let data = store.snapshot()
            if opensFirstEditor, let child = data.children.first,
               let first = Self.tasks(of: child.id, slot: .morning, data: data).first {
                editing = TaskDraft(first.task, schedule: first.schedule)
            }
        }
        .sheet(item: $editing) { draft in
            TaskEditorView(store: store, draft: draft, today: today) { editing = nil }
        }
        .alert("이 할 일을 지울까요?", isPresented: binding($archiving), presenting: archiving) { task in
            Button("취소", role: .cancel) {}
            Button("지우기", role: .destructive) { store.archiveTask(taskID: task.id, today: today) }
        } message: { task in
            Text("\(task.icon) \(task.title)\n지난 완료 기록은 남아요.")
        }
        .confirmationDialog("누구에게 복사할까요?", isPresented: binding($copying), presenting: copying) { task in
            ForEach(data.children.filter { $0.id != task.childID }) { child in
                Button("\(child.avatar) \(child.name)") {
                    store.copyTask(taskID: task.id, to: child.id, today: today)
                    notice = "\(child.name)에게 \"\(task.title)\"을(를) 복사했어요"
                }
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
    }

    private func slotSection(_ slot: TimeSlot, child: ChildInfo, data: BoardData) -> some View {
        let tasks = Self.tasks(of: child.id, slot: slot, data: data)
        let canCopy = data.children.count > 1
        return Section(slot == .morning ? "아침" : "저녁") {
            ForEach(tasks, id: \.task.id) { item in
                Button {
                    editing = TaskDraft(item.task, schedule: item.schedule)
                } label: {
                    HStack(spacing: 14) {
                        Text(item.task.icon).font(.system(size: 32))
                        Text(item.task.title).font(.system(size: 20, weight: .medium))
                        Spacer()
                        Text(WeekdayPicker.summary(item.schedule.weekdays))
                            .foregroundStyle(.secondary)
                    }
                    .foregroundStyle(Color.primary)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button("지우기", role: .destructive) { archiving = item.task }
                    if canCopy {
                        Button("복사") { copying = item.task }.tint(.blue)
                    }
                }
                .contextMenu {
                    if canCopy {
                        Button("다른 자녀에게 복사", systemImage: "doc.on.doc") { copying = item.task }
                    }
                    Button("지우기", systemImage: "trash", role: .destructive) { archiving = item.task }
                }
            }
            .onMove { from, to in store.moveTask(childID: child.id, slot: slot, from: from, to: to) }
            Button {
                editing = TaskDraft(childID: child.id, slot: slot)
            } label: {
                Label(slot == .morning ? "아침 할 일 추가" : "저녁 할 일 추가", systemImage: "plus.circle.fill")
            }
        }
    }

    /// `BoardStore.moveTask`와 같은 기준(보관하지 않았고, 이 시간대의 열린 일정이 있음, `order` 순)으로 고릅니다.
    static func tasks(of childID: UUID, slot: TimeSlot,
                      data: BoardData) -> [(task: TaskInfo, schedule: TaskScheduleInfo)] {
        data.tasks
            .filter { $0.childID == childID && $0.archivedOn == nil }
            .sorted { $0.order < $1.order }
            .compactMap { task in
                data.schedules
                    .filter { $0.taskID == task.id && $0.slot == slot && $0.endOn == nil }
                    .max { $0.startOn < $1.startOn }
                    .map { (task, $0) }
            }
    }

    private func binding<T>(_ value: Binding<T?>) -> Binding<Bool> {
        Binding(get: { value.wrappedValue != nil }, set: { if !$0 { value.wrappedValue = nil } })
    }
}
