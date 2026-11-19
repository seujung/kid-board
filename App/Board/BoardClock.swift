import Foundation

/// 보드가 쓰는 현재 시각입니다.
///
/// 배포 빌드에서는 항상 `Date()`입니다. DEBUG 빌드에서 실행 인자
/// `-KidBoardFixedNow <ISO8601>`이 있으면 그 시각에 실행 후 지난 시간을 더해 씁니다.
/// 스크린숏과 미리보기에서 특정 시각의 화면을 보기 위한 장치입니다.
struct BoardClock: Sendable {
    private let fixedStart: Date?
    private let launchedAt: Date

    init(fixedStart: Date? = nil, launchedAt: Date = Date()) {
        self.fixedStart = fixedStart
        self.launchedAt = launchedAt
    }

    func now() -> Date {
        guard let fixedStart else { return Date() }
        return fixedStart.addingTimeInterval(Date().timeIntervalSince(launchedAt))
    }

    static let live: BoardClock = {
        #if DEBUG
        if let value = launchArgument("-KidBoardFixedNow"),
           let fixed = ISO8601DateFormatter().date(from: value) {
            return BoardClock(fixedStart: fixed)
        }
        #endif
        return BoardClock()
    }()

    #if DEBUG
    /// 실행 인자 `name` 바로 뒤의 값을 돌려줍니다.
    static func launchArgument(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let index = args.firstIndex(of: name), args.indices.contains(index + 1) else { return nil }
        return args[index + 1]
    }
    #endif
}
