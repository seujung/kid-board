import SwiftUI
import SwiftData
import KidBoardCore

/// 보드 화면입니다. 위쪽은 공통 헤더, 아래쪽은 자녀 패널을 좌우로 놓습니다.
struct BoardView: View {
    @ObservedObject var store: BoardStore
    @StateObject private var weather: WeatherViewModel
    private let clock: BoardClock

    /// 한 화면에 놓는 자녀 패널의 최대 수입니다.
    static let maxPanels = 2

    init(store: BoardStore, clock: BoardClock = .live, weather: WeatherViewModel? = nil) {
        self.store = store
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
            content(now: clock.now())
        }
        .background(BoardPalette.background.ignoresSafeArea())
        .preferredColorScheme(.light)
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .onAppear {
            let today = DayDate(clock.now(), calendar: store.calendar)
            #if DEBUG
            DemoData.seedIfRequested(store, now: clock.now())
            #endif
            store.seedIfEmpty(today: today)
            weather.start()
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
                                                                   calendar: calendar, data: data))
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
        BoardView(store: store, clock: clock, weather: weather)
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
