import SwiftUI
import SwiftData
import KidBoardCore

@main
struct KidBoardApp: App {
    /// 저장소를 열지 못하면 `nil`입니다. 이때 앱을 끝내지 않고 안내 화면을 표시합니다.
    private let container: ModelContainer?

    init() {
        do {
            container = try KidBoardContainer.make()
        } catch {
            print("KidBoard: failed to open the data store: \(error)")
            container = nil
        }
    }

    var body: some Scene {
        WindowGroup {
            if let container {
                BoardRootView(container: container)
                    .modelContainer(container)
            } else {
                DataErrorView()
            }
        }
    }
}

/// 저장소를 연 뒤의 첫 화면입니다. 저장소와 화면 관리자를 한 번만 만듭니다.
private struct BoardRootView: View {
    @StateObject private var store: BoardStore
    @StateObject private var kiosk: KioskController

    init(container: ModelContainer) {
        let store = BoardStore(context: container.mainContext)
        _store = StateObject(wrappedValue: store)
        _kiosk = StateObject(wrappedValue: KioskController(store: store))
    }

    var body: some View {
        BoardView(store: store, kiosk: kiosk)
            .onAppear { kiosk.start() }
    }
}

/// 저장소를 열 수 없을 때 보이는 화면입니다.
struct DataErrorView: View {
    static let message = "데이터를 열 수 없어요. 앱을 다시 설치해 주세요."

    var body: some View {
        ZStack {
            Color(red: 0.98, green: 0.96, blue: 0.92).ignoresSafeArea()
            Text(Self.message)
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundStyle(Color(red: 0.25, green: 0.22, blue: 0.2))
                .multilineTextAlignment(.center)
                .padding(40)
        }
        .preferredColorScheme(.light)
        .statusBarHidden()
    }
}
