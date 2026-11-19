import SwiftUI
import UIKit
import KidBoardCore

/// 부모 모드에서 여는 화면입니다.
enum ParentScreen: String, Hashable, CaseIterable {
    case children, tasks, times, weather, history, changePin

    var title: String {
        switch self {
        case .children: "자녀 관리"
        case .tasks: "할 일 관리"
        case .times: "시각 설정"
        case .weather: "날씨 지역"
        case .history: "완료 기록"
        case .changePin: "PIN 변경"
        }
    }

    var symbol: String {
        switch self {
        case .children: "person.2.fill"
        case .tasks: "checklist"
        case .times: "clock.fill"
        case .weather: "cloud.sun.fill"
        case .history: "calendar"
        case .changePin: "lock.fill"
        }
    }
}

/// 보드 위에 전체 화면으로 띄우는 부모 모드의 맨 바깥 화면입니다.
///
/// PIN 확인(또는 첫 PIN 설정, PIN 찾기)을 거친 뒤 `ParentHomeView`를 엽니다.
/// 어느 화면에서든 `ParentGate.idleTimeout` 동안 손대지 않으면 보드로 돌아갑니다.
struct ParentModeView: View {
    enum Stage: Equatable {
        case unlocking, recovering, settingPin, unlocked
    }

    @ObservedObject var store: BoardStore
    let weather: WeatherViewModel
    let clock: BoardClock
    let onClose: () -> Void

    @State private var stage: Stage
    @State private var path: [ParentScreen]
    /// 손댈 때마다 늘어납니다. 자동 복귀 타이머를 다시 시작합니다.
    @State private var touches = 0

    init(store: BoardStore, weather: WeatherViewModel, clock: BoardClock,
         initialStage: Stage? = nil, initialPath: [ParentScreen] = [], onClose: @escaping () -> Void) {
        self.store = store
        self.weather = weather
        self.clock = clock
        self.onClose = onClose
        _stage = State(initialValue: initialStage ?? (store.hasPin ? .unlocking : .settingPin))
        _path = State(initialValue: initialPath)
    }

    var body: some View {
        content
            .statusBarHidden()
            .persistentSystemOverlays(.hidden)
            .background(TouchObserver { touches += 1 })
            .onReceive(NotificationCenter.default.publisher(for: UITextField.textDidChangeNotification)) { _ in
                touches += 1
            }
            .task(id: touches) {
                try? await Task.sleep(for: .seconds(ParentGate.idleTimeout))
                guard !Task.isCancelled else { return }
                onClose()
            }
    }

    @ViewBuilder
    private var content: some View {
        switch stage {
        case .unlocking:
            ParentGateView(store: store, clock: clock, title: "PIN을 입력해 주세요",
                           onSuccess: { stage = .unlocked },
                           onForgot: { stage = .recovering },
                           onCancel: onClose)
        case .recovering:
            PinRecoveryView(onSuccess: { stage = .settingPin }, onCancel: { stage = .unlocking })
        case .settingPin:
            PinSetupView(store: store, title: "새 PIN을 정해 주세요",
                         onDone: { stage = .unlocked }, onCancel: onClose)
        case .unlocked:
            NavigationStack(path: $path) {
                ParentHomeView(onClose: onClose)
                    .navigationDestination(for: ParentScreen.self) { screen in
                        destination(screen)
                    }
            }
        }
    }

    @ViewBuilder
    private func destination(_ screen: ParentScreen) -> some View {
        #if DEBUG
        let openEditor = DemoData.opensFirstEditor
        let query = DemoData.weatherQuery
        #else
        let openEditor = false
        let query = ""
        #endif
        switch screen {
        case .children: ChildListEditorView(store: store, opensFirstEditor: openEditor)
        case .tasks: TaskListEditorView(store: store, clock: clock, opensFirstEditor: openEditor)
        case .times: TimesEditorView(store: store)
        case .weather: WeatherLocationView(store: store, weather: weather, initialQuery: query)
        case .history: HistoryView(store: store, clock: clock)
        case .changePin: PinChangeView(store: store, clock: clock) { path.removeLast() }
        }
    }
}
