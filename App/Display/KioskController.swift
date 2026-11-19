import Foundation
import KidBoardCore
import UIKit

/// 화면을 계속 켜 두고, 야간에 어둡게 하며, 서명 만료와 유도 접근 안내를 관리합니다.
@MainActor
final class KioskController: ObservableObject {
    @Published private(set) var isNightDimmed = false
    /// 만료가 2일 이내일 때 남은 일수입니다. 프로파일이 없으면(시뮬레이터) `nil`입니다.
    @Published private(set) var expiryDaysLeft: Int?
    @Published private(set) var showsGuidedAccessBanner = false

    private let store: BoardStore
    private let clock: BoardClock
    private let profile: (creation: Date, expiration: Date)?
    private var state: NightDimState
    private var pendingTouch = false
    private var savedBrightness: CGFloat?
    private var dimApplied = false
    private var isActive = true
    private var timer: Timer?
    private var lastExpiryCheck: Date?
    private var observers: [NSObjectProtocol] = []

    init(store: BoardStore, clock: BoardClock = .live,
         profile: (creation: Date, expiration: Date)? = KioskController.loadProfile()) {
        self.store = store
        self.clock = clock
        self.profile = profile
        self.state = NightDimState(calendar: store.calendar)
    }

    /// 앱 번들의 프로비저닝 프로파일에서 생성일과 만료일을 읽습니다. 시뮬레이터에는 파일이 없어 `nil`입니다.
    nonisolated static func loadProfile() -> (creation: Date, expiration: Date)? {
        #if DEBUG
        if let value = BoardClock.launchArgument("-KidBoardFakeProfile") {
            let parts = value.split(separator: ",").map(String.init)
            let formatter = ISO8601DateFormatter()
            if parts.count == 2, let creation = formatter.date(from: parts[0]),
               let expiration = formatter.date(from: parts[1]) {
                return (creation, expiration)
            }
        }
        #endif
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url) else { return nil }
        return ProvisioningProfile.dates(from: data)
    }

    func start() {
        guard timer == nil else { return }
        UIApplication.shared.isIdleTimerDisabled = true
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.didEnterBackground() }
            },
            center.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.willEnterForeground() }
            },
        ]
        evaluateGuidedAccess()
        tick()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
    }

    /// 화면을 눌렀을 때 부릅니다. 야간이면 `nightWakeDuration` 동안 평소 밝기로 돌립니다.
    func userTouched(now: Date) {
        pendingTouch = true
        evaluate(now: now)
    }

    func dismissGuidedAccessBanner() {
        showsGuidedAccessBanner = false
        if let profile { store.setLastSeenProfileCreation(profile.creation) }
    }

    // MARK: Private

    private func tick() {
        let now = clock.now()
        evaluate(now: now)
        if lastExpiryCheck.map({ now.timeIntervalSince($0) >= 3600 || now < $0 }) ?? true {
            lastExpiryCheck = now
            expiryDaysLeft = profile.flatMap { ProvisioningProfile.warningDaysLeft(expiration: $0.expiration, now: now) }
        }
    }

    private func evaluate(now: Date) {
        let output = state.step(now: now, touched: pendingTouch)
        pendingTouch = false
        isNightDimmed = output.dimmed
        applyBrightness(dim: output.dimmed && isActive)
        if !output.isNight { savedBrightness = nil }
    }

    private func applyBrightness(dim: Bool) {
        if dim, !dimApplied {
            if savedBrightness == nil { savedBrightness = UIScreen.main.brightness }
            UIScreen.main.brightness = 0
            dimApplied = true
        } else if !dim, dimApplied {
            if let savedBrightness { UIScreen.main.brightness = savedBrightness }
            dimApplied = false
        }
    }

    private func didEnterBackground() {
        isActive = false
        applyBrightness(dim: false)
    }

    private func willEnterForeground() {
        isActive = true
        UIApplication.shared.isIdleTimerDisabled = true
        evaluate(now: clock.now())
        evaluateGuidedAccess()
    }

    private func evaluateGuidedAccess() {
        guard GuidedAccessReminder.isEnabled, let profile else { return }
        let seen = store.settings().lastSeenProfileCreation
        if seen == nil {
            store.setLastSeenProfileCreation(profile.creation)
        } else if seen != profile.creation {
            showsGuidedAccessBanner = true
        }
    }
}
