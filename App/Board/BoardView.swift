import SwiftUI
import SwiftData
import KidBoardCore

/// 보드 화면입니다. 위쪽은 공통 헤더, 아래쪽은 자녀 패널을 좌우로 놓습니다.
struct BoardView: View {
    @ObservedObject var store: BoardStore
    @ObservedObject var kiosk: KioskController
    @StateObject private var weather: WeatherViewModel
    private let clock: BoardClock
    @State private var showsParentMode = false

    /// 한 화면에 놓는 자녀 패널의 최대 수입니다.
    static let maxPanels = 2

    init(store: BoardStore, kiosk: KioskController, clock: BoardClock = .live, weather: WeatherViewModel? = nil) {
        self.store = store
        self.kiosk = kiosk
        self.clock = clock
        _weather = StateObject(wrappedValue: weather ?? WeatherViewModel(store: store, clock: clock, http: Self.http))
    }

    private static var http: HTTPClient {
        #if DEBUG
        if let canned = DemoData.httpClient { return canned }
        #endif
        return URLSession.shared
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            let now = clock.now()
            ZStack {
                content(now: now)
                overlays(now: now)
            }
        }
        .background(BoardPalette.background.ignoresSafeArea())
        .preferredColorScheme(.light)
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .background(TouchObserver { kiosk.userTouched(now: clock.now()) })
        .onChange(of: showsParentMode) { _, shown in
            kiosk.setSuspended(shown, now: clock.now())
        }
        .onAppear {
            let today = DayDate(clock.now(), calendar: store.calendar)
            #if DEBUG
            DemoData.seedIfRequested(store, now: clock.now())
            #endif
            store.seedIfEmpty(today: today)
            weather.start()
            #if DEBUG
            if DemoData.parentRoute != nil {
                DemoData.prepareParentRoute(store, now: clock.now())
                showsParentMode = true
            }
            #endif
        }
        .fullScreenCover(isPresented: $showsParentMode) {
            parentMode
        }
    }

    @ViewBuilder
    private var parentMode: some View {
        let close = { showsParentMode = false }
        #if DEBUG
        if let route = DemoData.parentRoute {
            ParentModeView(store: store, weather: weather, clock: clock,
                           initialStage: route.stage, initialPath: route.path, onClose: close)
        } else {
            ParentModeView(store: store, weather: weather, clock: clock, onClose: close)
        }
        #else
        ParentModeView(store: store, weather: weather, clock: clock, onClose: close)
        #endif
    }

    /// 부모 모드를 여는 설정 아이콘입니다. 아이들 눈에 덜 띄게 작고 흐리게 그립니다.
    /// `ParentGate.longPressDuration` 동안 계속 눌러야 열리고, 짧게 누르면 아무 일도 없습니다.
    private var settingsIcon: some View {
        Image(systemName: "gearshape")
            .font(.system(size: 18, weight: .regular))
            .foregroundStyle(Color.gray.opacity(0.45))
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
            .onLongPressGesture(minimumDuration: ParentGate.longPressDuration) {
                showsParentMode = true
            }
            .accessibilityLabel("부모 모드 (3초 길게 누르기)")
    }

    @ViewBuilder
    private func overlays(now: Date) -> some View {
        VStack(spacing: 0) {
            if kiosk.showsGuidedAccessBanner {
                GuidedAccessBannerView { kiosk.dismissGuidedAccessBanner() }
                    .padding(.top, 14)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        if let days = kiosk.expiryDaysLeft {
            ExpiryBadgeView(daysLeft: days)
                .padding(.top, 6)
                .padding(.trailing, 64)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        }
        if kiosk.isNightDimmed {
            NightOverlayView(now: now, calendar: store.calendar) { kiosk.userTouched(now: now) }
        }
    }

    private func content(now: Date) -> some View {
        let calendar = store.calendar
        let data = store.snapshot()
        let children = Array(data.children.prefix(Self.maxPanels))
        let engine = BoardStateEngine(calendar: calendar)
        return GeometryReader { geo in
            VStack(spacing: 0) {
                HeaderView(now: now, calendar: calendar, weather: weather.display,
                           needsLocation: weather.needsLocation, locationName: weather.locationName,
                           latestSchoolTime: Self.latestSchoolTime(children: children, now: now,
                                                                   calendar: calendar, data: data)) {
                    settingsIcon
                }
                .frame(height: min(max(geo.size.height * 0.26, 190), 280))
                HStack(spacing: 16) {
                    ForEach(children) { child in
                        ChildPanelView(store: store, clock: clock,
                                       state: engine.state(for: child, now: now, data: data),
                                       data: data, now: now)
                    }
                }
                .padding(16)
            }
        }
    }

    /// 표시 중인 자녀들의 오늘 등교 시각 중 가장 늦은 값입니다. 모두 등교하지 않으면 `nil`입니다.
    static func latestSchoolTime(children: [ChildInfo], now: Date, calendar: Calendar, data: BoardData) -> Date? {
        let today = DayDate(now, calendar: calendar)
        let schedule = ScheduleEngine(calendar: calendar)
        return children
            .compactMap { schedule.times(childID: $0.id, on: today, data: data).schoolTime }
            .map { today.date(at: $0, calendar: calendar) }
            .max()
    }
}

#if DEBUG
/// 미리보기용 메모리 전용 보드입니다. `SeedData`와 예시 완료 기록을 넣습니다.
@MainActor
struct BoardPreview {
    static let thursdayMorning = ISO8601DateFormatter().date(from: "2026-11-19T07:42:00+09:00")!
    static let thursdayEvening = ISO8601DateFormatter().date(from: "2026-11-19T20:00:00+09:00")!
    static let saturday = ISO8601DateFormatter().date(from: "2026-11-21T10:00:00+09:00")!

    let store: BoardStore
    let clock: BoardClock
    let now: Date
    var data: BoardData { store.snapshot() }

    init(now: Date) {
        let schema = Schema([
            ChildModel.self, TaskModel.self, TaskScheduleModel.self, DailyTimesModel.self,
            CompletionModel.self, AppSettingsModel.self, WeatherCacheModel.self,
        ])
        let container = try! ModelContainer(
            for: schema, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        store = BoardStore(context: ModelContext(container))
        clock = BoardClock(fixedStart: now)
        self.now = now
        DemoData.seed(store, now: now)
    }

    func state(for child: ChildInfo) -> ChildBoardState {
        BoardStateEngine(calendar: store.calendar).state(for: child, now: now, data: data)
    }

    var weather: WeatherViewModel {
        .preview(.fresh(WeatherSnapshot(temperature: 3.4, weatherCode: 61, high: 9, low: -1,
                                        precipitationProbability: 60, fetchedAt: now)))
    }

    func board() -> some View {
        BoardView(store: store, kiosk: KioskController(store: store, clock: clock, profile: nil),
                  clock: clock, weather: weather)
    }
}

#Preview("아침 (목 07:42)", traits: .landscapeLeft) {
    BoardPreview(now: BoardPreview.thursdayMorning).board()
}

#Preview("저녁 (목 20:00)", traits: .landscapeLeft) {
    BoardPreview(now: BoardPreview.thursdayEvening).board()
}

#Preview("등교 없는 날 (토 10:00)", traits: .landscapeLeft) {
    BoardPreview(now: BoardPreview.saturday).board()
}
#endif
