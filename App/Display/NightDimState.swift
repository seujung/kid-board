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

    mutating func step(now: Date, touched: Bool) -> Output {
        guard DisplayPolicy.isNightMode(now, calendar: calendar) else {
            wakeUntil = nil
            return Output(dimmed: false, isNight: false)
        }
        if touched { wakeUntil = now.addingTimeInterval(DisplayPolicy.nightWakeDuration) }
        let awake = wakeUntil.map { now < $0 } ?? false
        return Output(dimmed: !awake, isNight: true)
    }
}
