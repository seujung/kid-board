import Foundation
import KidBoardCore

/// 야간 어둡게 하기의 판정만 담은 순수 상태 기계입니다. 밝기 조작은 `KioskController`가 합니다.
struct NightDimState {
    struct Output: Equatable {
        /// 화면을 어둡게 해야 하면 `true`입니다.
        var dimmed: Bool
        /// 지금이 야간(22:00~06:00)이면 `true`입니다. 깨어 있는 30초 동안에도 `true`입니다.
        var isNight: Bool
    }

    let calendar: Calendar
    private var wakeUntil: Date?

    init(calendar: Calendar) {
        self.calendar = calendar
    }

    /// `suspended`가 `true`이면(부모 모드가 열려 있으면) 어둡게 하지 않습니다.
    /// 그동안 깨어 있는 시간을 계속 늘리므로, 다시 풀린 뒤 `nightWakeDuration` 동안 밝게 유지합니다.
    mutating func step(now: Date, touched: Bool, suspended: Bool = false) -> Output {
        guard DisplayPolicy.isNightMode(now, calendar: calendar) else {
            wakeUntil = nil
            return Output(dimmed: false, isNight: false)
        }
        if touched || suspended { wakeUntil = now.addingTimeInterval(DisplayPolicy.nightWakeDuration) }
        let awake = wakeUntil.map { now < $0 } ?? false
        return Output(dimmed: !awake, isNight: true)
    }
}
