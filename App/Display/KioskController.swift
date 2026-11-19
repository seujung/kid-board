import Foundation
import KidBoardCore
import UIKit

/// 화면 밝기를 읽고 바꾸는 곳입니다. 테스트에서 가짜로 바꿉니다.
@MainActor
protocol ScreenBrightness: AnyObject {
    var brightness: CGFloat { get set }
}

/// 기기의 실제 화면 밝기입니다.
@MainActor
final class MainScreenBrightness: ScreenBrightness {
    var brightness: CGFloat {
        get { UIScreen.main.brightness }
        set { UIScreen.main.brightness = newValue }
    }
}

/// 야간에 어둡게 하기 전의 화면 밝기를 `UserDefaults`에 저장합니다.
///
/// 03:00 재설치는 앱을 백그라운드 알림 없이 끝냅니다. 그러면 화면 밝기가 0으로 남습니다.
/// 값을 저장해 두면 새로 실행한 앱이 0 대신 원래 밝기로 되돌릴 수 있습니다.
struct PreDimBrightnessStore {
    static let key = "KidBoard.preDimBrightness"
    let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    /// 저장한 밝기입니다. 어둡게 하지 않은 상태이면 `nil`입니다.
    var value: Double? {
        get { defaults.object(forKey: Self.key) as? Double }
        nonmutating set {
            if let newValue { defaults.set(newValue, forKey: Self.key) } else { defaults.removeObject(forKey: Self.key) }
        }
    }
}

/// 화면을 계속 켜 두고, 야간에 어둡게 하며, 서명 만료와 유도 접근 안내를 관리합니다.
@MainActor
final class KioskController: ObservableObject {
    /// 되돌릴 밝기가 이 값보다 낮으면 `fallbackBrightness`로 되돌립니다. 화면이 너무 어두운 채로 남지 않게 합니다.
    static let minimumRestoredBrightness = 0.1
    static let fallbackBrightness = 0.5

    @Published private(set) var isNightDimmed = false
    /// 만료가 2일 이내일 때 남은 일수입니다. 프로파일이 없으면(시뮬레이터) `nil`입니다.
    @Published private(set) var expiryDaysLeft: Int?
    @Published private(set) var showsGuidedAccessBanner = false

    private let store: BoardStore
    private let clock: BoardClock
    private let profile: (creation: Date, expiration: Date)?
    /// 설치마다 바뀌는 값입니다. 유도 접근 안내를 띄울지 정합니다. 프로파일이 없으면(시뮬레이터) `nil`입니다.
    private let installID: String?
    private var state: NightDimState
    private let screen: ScreenBrightness
    private let brightnessStore: PreDimBrightnessStore
    private var pendingTouch = false
    /// 화면을 어둡게 해 둔 상태이면 `true`입니다.
    private var dimApplied: Bool
    private var isActive = true
    /// 부모 모드가 열려 있으면 `true`입니다. 그동안 어둡게 하지 않습니다.
    private var isSuspended = false
    private var timer: Timer?
    private var lastExpiryCheck: Date?
    private var observers: [NSObjectProtocol] = []

    init(store: BoardStore, clock: BoardClock = .live,
         profile: (creation: Date, expiration: Date)? = KioskController.loadProfile(),
         installID: String? = KioskController.loadInstallID(),
         screen: ScreenBrightness? = nil,
         brightnessStore: PreDimBrightnessStore = PreDimBrightnessStore()) {
        self.store = store
        self.clock = clock
        self.profile = profile
        self.installID = installID
        self.screen = screen ?? MainScreenBrightness()
        self.brightnessStore = brightnessStore
        self.state = NightDimState(calendar: store.calendar)
        // 저장한 밝기가 있으면 이전 프로세스가 어둡게 한 채로 끝났습니다. 화면은 아직 어둡습니다.
        // 어둡게 한 상태로 시작해야 낮이면 바로, 밤이면 06:00에 저장한 밝기로 되돌립니다.
        self.dimApplied = brightnessStore.value != nil
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

    /// 지금 설치의 ID를 만듭니다. 프로파일이 없으면 `nil`입니다.
    ///
    /// 재설치가 프로파일을 새로 받지 않아도(Xcode가 캐시한 무료 프로파일을 다시 써도) ID가 바뀌어야 합니다.
    /// 그래서 세 값을 잇습니다. 하나라도 바뀌면 새 설치로 봅니다.
    /// - 프로파일 생성일: Xcode가 프로파일을 새로 받으면 바뀝니다.
    /// - 실행 파일 수정 시각: 빌드가 다시 서명하면 codesign이 실행 파일을 고쳐 씁니다.
    /// - 번들 컨테이너 이름: iOS는 앱을 설치하거나 갱신할 때마다 새 컨테이너 UUID에 번들을 둡니다.
    nonisolated static func loadInstallID() -> String? {
        guard let profile = loadProfile() else { return nil }
        let bundle = Bundle.main
        let modified = bundle.executableURL
            .flatMap { try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate }
        return installID(profileCreation: profile.creation, executableModified: modified,
                         bundleContainer: bundle.bundleURL.deletingLastPathComponent().lastPathComponent)
    }

    nonisolated static func installID(profileCreation: Date, executableModified: Date?, bundleContainer: String) -> String {
        let modified = executableModified.map { String($0.timeIntervalSince1970) } ?? "-"
        return "\(profileCreation.timeIntervalSince1970)|\(modified)|\(bundleContainer)"
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
    /// 깨어 있는 동안 누르면 깨어 있는 시간을 다시 `nightWakeDuration`으로 늘립니다.
    func userTouched(now: Date) {
        pendingTouch = true
        evaluate(now: now)
    }

    /// 부모 모드를 열고 닫을 때 부릅니다. 열려 있는 동안 어둡게 하지 않습니다.
    /// 닫으면 화면을 누른 것으로 보고 `nightWakeDuration` 동안 밝게 둡니다.
    func setSuspended(_ suspended: Bool, now: Date) {
        if isSuspended && !suspended { pendingTouch = true }
        isSuspended = suspended
        evaluate(now: now)
    }

    /// 지금 시각으로 야간 판정과 밝기를 다시 맞춥니다. 타이머가 매초 부릅니다.
    func evaluate(now: Date) {
        let output = state.step(now: now, touched: pendingTouch, suspended: isSuspended)
        pendingTouch = false
        isNightDimmed = output.dimmed
        applyBrightness(dim: output.dimmed && isActive)
    }

    func dismissGuidedAccessBanner() {
        showsGuidedAccessBanner = false
        if let installID { store.setLastSeenInstallID(installID) }
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

    private func applyBrightness(dim: Bool) {
        if dim, !dimApplied {
            if brightnessStore.value == nil { brightnessStore.value = Double(screen.brightness) }
            screen.brightness = 0
            dimApplied = true
        } else if !dim, dimApplied {
            if let saved = brightnessStore.value {
                screen.brightness = CGFloat(saved < Self.minimumRestoredBrightness ? Self.fallbackBrightness : saved)
            }
            brightnessStore.value = nil
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

    /// 지난번에 본 설치 ID와 지금 설치 ID가 다르면 유도 접근 안내를 띄웁니다. 첫 실행이면 ID만 기록합니다.
    func evaluateGuidedAccess() {
        guard GuidedAccessReminder.isEnabled, let installID else { return }
        let seen = store.settings().lastSeenInstallID
        if seen == nil {
            store.setLastSeenInstallID(installID)
        } else if seen != installID {
            showsGuidedAccessBanner = true
        }
    }
}
