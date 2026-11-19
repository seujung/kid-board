import Foundation
import SwiftData
import KidBoardCore

/// 날씨를 `WeatherPolicy.refreshInterval`마다 새로 가져와 `WeatherCacheModel`에 저장합니다.
///
/// 지역(위도·경도)이 정해지지 않았으면 네트워크 요청을 하지 않고 `needsLocation`을 `true`로 둡니다.
/// 요청이 실패하면 저장해 둔 날씨를 그대로 쓰고 `WeatherPolicy.display`로 표시 상태만 다시 정합니다.
@MainActor
final class WeatherViewModel: ObservableObject {
    @Published var display: WeatherDisplay = .unavailable
    @Published private(set) var needsLocation = true
    @Published private(set) var locationName: String?

    private let store: BoardStore?
    private let clock: BoardClock
    private let client: OpenMeteoClient
    private var cached: WeatherSnapshot?
    private var loop: Task<Void, Never>?
    private var isRefreshing = false

    init(store: BoardStore, clock: BoardClock = .live, http: HTTPClient = URLSession.shared) {
        self.store = store
        self.clock = clock
        self.client = OpenMeteoClient(http: http, now: { clock.now() })
    }

    /// 미리보기용입니다. 저장소와 네트워크를 쓰지 않고 정해진 날씨만 보여 줍니다.
    private init(preview display: WeatherDisplay, locationName: String?) {
        store = nil
        clock = BoardClock()
        client = OpenMeteoClient(http: URLSession.shared)
        self.display = display
        self.needsLocation = false
        self.locationName = locationName
    }

    static func preview(_ display: WeatherDisplay, locationName: String? = "서울") -> WeatherViewModel {
        WeatherViewModel(preview: display, locationName: locationName)
    }

    deinit {
        loop?.cancel()
    }

    /// 저장해 둔 날씨를 읽고 주기적인 새로 고침을 시작합니다. 여러 번 불러도 한 번만 시작합니다.
    func start() {
        guard loop == nil, store != nil else { return }
        cached = cacheRow()?.info
        recompute()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                try? await Task.sleep(for: .seconds(WeatherPolicy.refreshInterval))
            }
        }
    }

    /// 지금 바로 다시 가져옵니다. 부모 모드에서 지역을 바꾼 뒤에 부릅니다.
    func refreshNow() {
        Task { await refresh() }
    }

    private func refresh() async {
        guard let store, !isRefreshing else { return }
        let settings = store.settings()
        locationName = settings.locationName
        guard let latitude = settings.latitude, let longitude = settings.longitude else {
            needsLocation = true
            recompute()
            return
        }
        needsLocation = false
        isRefreshing = true
        defer { isRefreshing = false }
        if let snapshot = try? await client.forecast(latitude: latitude, longitude: longitude) {
            cached = snapshot
            persist(snapshot)
        }
        recompute()
    }

    private func recompute() {
        display = WeatherPolicy.display(cached: cached, now: clock.now())
    }

    private func cacheRow() -> WeatherCacheModel? {
        try? store?.context.fetch(FetchDescriptor<WeatherCacheModel>()).first
    }

    private func persist(_ snapshot: WeatherSnapshot) {
        guard let context = store?.context else { return }
        if let row = cacheRow() {
            row.info = snapshot
        } else {
            context.insert(WeatherCacheModel(snapshot: snapshot))
        }
        try? context.save()
    }
}
