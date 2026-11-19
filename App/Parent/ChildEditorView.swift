import SwiftUI
import KidBoardCore

/// 자녀 관리 화면입니다. 자녀를 추가, 수정, 삭제하고 끌어서 표시 순서를 바꿉니다.
struct ChildListEditorView: View {
    @ObservedObject var store: BoardStore
    /// 스크린숏용입니다. 화면이 열리면 첫 자녀의 편집 시트를 띄웁니다.
    var opensFirstEditor = false

    /// 편집 시트에 띄우는 자녀입니다. 새 자녀는 `id`가 새로 만든 값입니다.
    @State private var editing: ChildDraft?
    @State private var editMode: EditMode = .inactive

    var body: some View {
        let children = store.snapshot().children
        List {
            Section {
                ForEach(children) { child in
                    Button {
                        editing = ChildDraft(child)
                    } label: {
                        HStack(spacing: 16) {
                            Text(child.avatar).font(.system(size: 40))
                            Text(child.name).font(.system(size: 22, weight: .semibold))
                            Spacer()
                            Circle().fill(ChildTheme.named(child.themeColor).accent).frame(width: 24, height: 24)
                        }
                        .foregroundStyle(Color.primary)
                    }
                }
                .onMove { from, to in move(children, from: from, to: to) }
            } footer: {
                Text("보드에는 위에서부터 2명만 보여요. 오른쪽 위 \"순서 바꾸기\"로 순서를 바꿀 수 있어요.")
            }
            Section {
                Button {
                    editing = ChildDraft(order: (children.map(\.order).max() ?? -1) + 1)
                } label: {
                    Label("자녀 추가", systemImage: "plus.circle.fill")
                        .font(.system(size: 20, weight: .semibold))
                }
            }
        }
        .environment(\.editMode, $editMode)
        .navigationTitle(ParentScreen.children.title)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(editMode.isEditing ? "완료" : "순서 바꾸기") {
                    withAnimation { editMode = editMode.isEditing ? .inactive : .active }
                }
            }
        }
        .onAppear {
            if opensFirstEditor, let first = store.snapshot().children.first { editing = ChildDraft(first) }
        }
        .sheet(item: $editing) { draft in
            ChildEditorView(store: store, draft: draft) { editing = nil }
        }
    }

    private func move(_ children: [ChildInfo], from: IndexSet, to: Int) {
        var ordered = children
        ordered.move(fromOffsets: from, toOffset: to)
        for (index, var child) in ordered.enumerated() where child.order != index {
            child.order = index
            store.updateChild(child)
        }
    }
}

/// 자녀 편집 시트의 입력값입니다.
struct ChildDraft: Identifiable {
    var id: UUID
    var isNew: Bool
    var name: String
    var avatar: String
    var themeColor: String
    var order: Int

    init(_ child: ChildInfo) {
        id = child.id
        isNew = false
        name = child.name
        avatar = child.avatar
        themeColor = child.themeColor
        order = child.order
    }

    init(order: Int) {
        id = UUID()
        isNew = true
        name = ""
        avatar = ChildEditorView.avatars[0]
        themeColor = ChildTheme.choices[0].name
        self.order = order
    }

    var info: ChildInfo {
        ChildInfo(id: id, name: name.trimmingCharacters(in: .whitespaces), avatar: avatar,
                  themeColor: themeColor, order: order)
    }
}

/// 자녀 한 명의 이름, 이모지 아바타, 테마 색을 고칩니다.
struct ChildEditorView: View {
    let store: BoardStore
    @State var draft: ChildDraft
    let onDone: () -> Void

    @State private var confirmingDelete = false

    static let avatars = ["🐰", "🐻", "🐶", "🐱", "🐼", "🦊", "🐯", "🦁",
                          "🐨", "🐸", "🐷", "🐵", "🐧", "🐥", "🦄", "🐳"]

    private var canSave: Bool {
        !draft.info.name.isEmpty && !draft.avatar.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("이름") {
                    TextField("이름", text: $draft.name)
                        .font(.system(size: 22))
                }
                Section("아바타") {
                    EmojiPicker(choices: Self.avatars, selection: $draft.avatar, columns: 8)
                }
                Section("테마 색") {
                    HStack(spacing: 18) {
                        ForEach(ChildTheme.choices, id: \.name) { choice in
                            themeButton(choice)
                        }
                    }
                    .padding(.vertical, 6)
                }
                if !draft.isNew {
                    Section {
                        Button("이 자녀 삭제", role: .destructive) { confirmingDelete = true }
                    }
                }
            }
            .navigationTitle(draft.isNew ? "자녀 추가" : "자녀 수정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소", action: onDone) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장", action: save).disabled(!canSave)
                }
            }
            .alert("\(draft.name)을(를) 삭제할까요?", isPresented: $confirmingDelete) {
                Button("취소", role: .cancel) {}
                Button("삭제", role: .destructive) {
                    store.deleteChild(id: draft.id)
                    onDone()
                }
            } message: {
                Text("이 자녀의 할 일, 시각 설정, 완료 기록이 모두 지워져요.")
            }
        }
    }

    private func themeButton(_ choice: (name: String, label: String)) -> some View {
        let selected = draft.themeColor == choice.name
        return Button {
            draft.themeColor = choice.name
        } label: {
            VStack(spacing: 6) {
                Circle()
                    .fill(ChildTheme.named(choice.name).accent)
                    .frame(width: 44, height: 44)
                    .overlay(Circle().strokeBorder(Color.primary, lineWidth: selected ? 3 : 0).padding(-5))
                Text(choice.label).font(.system(size: 15)).foregroundStyle(Color.primary)
            }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func save() {
        if draft.isNew {
            store.addChild(name: draft.info.name, avatar: draft.avatar, themeColor: draft.themeColor)
        } else {
            store.updateChild(draft.info)
        }
        onDone()
    }
}

/// 이모지 고르기입니다. 고정된 칸에서 고르거나 직접 입력합니다.
struct EmojiPicker: View {
    let choices: [String]
    @Binding var selection: String
    var columns = 8

    @State private var custom = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: columns), spacing: 10) {
                ForEach(choices, id: \.self) { emoji in
                    Button {
                        selection = emoji
                        custom = ""
                    } label: {
                        Text(emoji)
                            .font(.system(size: 34))
                            .frame(width: 56, height: 56)
                            .background(RoundedRectangle(cornerRadius: 12)
                                .fill(selection == emoji ? Color.accentColor.opacity(0.25) : Color.clear))
                    }
                    .buttonStyle(.plain)
                }
            }
            HStack {
                Text("직접 입력")
                TextField("이모지 하나", text: $custom)
                    .onChange(of: custom) { _, value in
                        let trimmed = value.trimmingCharacters(in: .whitespaces)
                        if let first = trimmed.first { selection = String(first) }
                    }
                Text(selection).font(.system(size: 30))
            }
        }
    }
}
