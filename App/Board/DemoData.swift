#if DEBUG
import Foundation
import KidBoardCore

/// 미리보기와 스크린숏용 예시 데이터입니다. DEBUG 빌드에만 있습니다.
///
/// 실행 인자 `-KidBoardDemoData YES`가 있고 저장소가 비어 있으면 앱이 이 데이터를 넣습니다.
/// 이번 주 월요일부터 할 일을 시작하고 지난 날과 오늘에 완료 기록을 남깁니다.
/// 날씨 지역을 서울로 정하고 날씨는 네트워크 대신 고정 응답(비 올 확률 70%)을 씁니다.
@MainActor
enum DemoData {
    static var isRequested: Bool { BoardClock.launchArgument("-KidBoardDemoData") != nil }

    static var httpClient: HTTPClient? { isRequested ? CannedWeather() : nil }

    static func seedIfRequested(_ store: BoardStore, now: Date) {
        guard isRequested, store.snapshot().children.isEmpty else { return }
        seed(store, now: now)
        let settings = store.settings()
        settings.locationName = "서울"
        settings.latitude = 37.5665
        settings.longitude = 126.978
        try? store.context.save()
    }

    /// 오늘 완료 기록을 남기는 시각과 개수입니다. 자녀 순서대로 씁니다.
    private static let todayPlan: [[(hour: Int, minute: Int, count: Int)]] = [
        [(7, 0, 3), (8, 0, 2), (19, 0, 2)],
        [(7, 0, 1), (8, 0, 4), (19, 0, 3), (21, 0, 1)],
    ]
    /// 지난 날마다 남겨 두는(완료하지 않는) 할 일 수입니다. 키는 월요일부터 센 날 수입니다.
    private static let pastSkips: [[Int: Int]] = [[2: 1], [0: 2]]

    static func seed(_ store: BoardStore, now: Date) {
        let calendar = store.calendar
        let today = DayDate(now, calendar: calendar)
        let week = WeekStripView.week(containing: today, calendar: calendar)
        store.seedIfEmpty(today: week[0])
        let schedule = ScheduleEngine(calendar: calendar)
        let engine = BoardStateEngine(calendar: calendar)
        for (index, child) in store.snapshot().children.enumerated() {
            for (offset, day) in week.enumerated() where day < today {
                let tasks = schedule.tasks(childID: child.id, on: day, data: store.snapshot())
                let skip = pastSkips[safe: index]?[offset] ?? 0
                for task in tasks.dropLast(skip) {
                    let time = TimeOfDay(hour: task.slot == .morning ? 7 : 19, minute: 0)
                    _ = store.toggleCompletion(childID: child.id, taskID: task.id,
                                               now: day.date(at: time, calendar: calendar))
                }
            }
            var plan = todayPlan[safe: index] ?? []
            if schedule.times(childID: child.id, on: today, data: store.snapshot()).schoolTime == nil {
                plan = Array(plan.prefix(1))
            }
            for step in plan {
                let at = today.date(at: TimeOfDay(hour: step.hour, minute: step.minute), calendar: calendar)
                guard at <= now else { continue }
                let state = engine.state(for: child, now: at, data: store.snapshot())
                let open = state.visibleTasks.filter { !state.doneTaskIDs.contains($0.id) }
                for task in open.prefix(step.count) {
                    _ = store.toggleCompletion(childID: child.id, taskID: task.id, now: at)
                }
            }
        }
    }

    // MARK: Parent mode route

    /// 실행 인자 `-KidBoardOpenParent <화면>`으로 부모 모드를 바로 엽니다. 스크린숏용입니다.
    ///
    /// 화면: home, children, childeditor, tasks, taskeditor, times, weather, history, pinsetup, gate, locked, recovery
    static var parentRouteName: String? { BoardClock.launchArgument("-KidBoardOpenParent") }

    static var parentRoute: (stage: ParentModeView.Stage, path: [ParentScreen])? {
        switch parentRouteName {
        case nil: nil
        case "home": (.unlocked, [])
        case "children", "childeditor": (.unlocked, [.children])
        case "tasks", "taskeditor": (.unlocked, [.tasks])
        case "times": (.unlocked, [.times])
        case "weather": (.unlocked, [.weather])
        case "history": (.unlocked, [.history])
        case "pinsetup": (.settingPin, [])
        case "recovery": (.recovering, [])
        default: (.unlocking, [])
        }
    }

    /// 예시 화면에 필요한 상태를 만듭니다. PIN은 "1234"이고, `locked`이면 5회 틀려 잠근 상태입니다.
    static func prepareParentRoute(_ store: BoardStore, now: Date) {
        if !store.hasPin { store.setPin("1234") }
        if parentRouteName == "locked" {
            for _ in 0..<PinLockout.maxFailures { _ = store.verifyPin("0000", now: now) }
        }
    }

    static var opensFirstEditor: Bool { ["childeditor", "taskeditor"].contains(parentRouteName) }
    static var weatherQuery: String { parentRouteName == "weather" ? "성남" : "" }

    private struct CannedWeather: HTTPClient {
        func fetch(_ url: URL) async throws -> Data {
            if url.host()?.hasPrefix("geocoding") == true {
                return Data("""
                {"results":[
                 {"name":"성남시","admin1":"경기도","latitude":37.4386,"longitude":127.1378},
                 {"name":"성남동","admin1":"경기도","latitude":37.4350,"longitude":127.1400},
                 {"name":"성남면","admin1":"충청남도","latitude":36.7300,"longitude":127.2500}]}
                """.utf8)
            }
            return Data("""
            {"current":{"temperature_2m":3.4,"weather_code":61},
             "daily":{"temperature_2m_max":[9.2],"temperature_2m_min":[-1.3],"precipitation_probability_max":[70]}}
            """.utf8)
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
#endif
