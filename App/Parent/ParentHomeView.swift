import SwiftUI
import KidBoardCore

/// 부모 모드의 첫 화면입니다. 메뉴 6개를 보여 줍니다.
struct ParentHomeView: View {
    let onClose: () -> Void

    private let menu: [ParentScreen] = [.children, .tasks, .times, .weather, .history, .changePin]

    var body: some View {
        List {
            Section {
                ForEach(menu, id: \.self) { screen in
                    NavigationLink(value: screen) {
                        Label(screen.title, systemImage: screen.symbol)
                            .font(.system(size: 22, weight: .medium))
                            .padding(.vertical, 8)
                    }
                }
            } footer: {
                Text("2분 동안 아무것도 누르지 않으면 보드로 돌아가요.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("부모 모드")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("보드로 돌아가기", action: onClose)
                    .font(.system(size: 18, weight: .semibold))
            }
        }
    }
}
