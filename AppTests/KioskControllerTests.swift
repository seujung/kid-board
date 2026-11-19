import Foundation
import SwiftData
import Testing
import KidBoardCore
@testable import KidBoard

private let seoul: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
    return calendar
}()

private func at(_ hour: Int, _ minute: Int = 0, _ second: Int = 0, day: Int = 19) -> Date {
    seoul.date(from: DateComponents(year: 2026, month: 11, day: day, hour: hour, minute: minute, second: second))!
}

@MainActor
private final class FakeScreen: ScreenBrightness {
    var brightness: CGFloat
    init(_ brightness: CGFloat) { self.brightness = brightness }
}

@MainActor
private struct Fixture {
    let store: BoardStore
    let defaults: UserDefaults

    init() throws {
        let container = try ModelContainer(
            for: Schema([
                ChildModel.self, TaskModel.self, TaskScheduleModel.self, DailyTimesModel.self,
                CompletionModel.self, AppSettingsModel.self, WeatherCacheModel.self,
            ]),
            configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        store = BoardStore(context: ModelContext(container), calendar: seoul)
        defaults = UserDefaults(suiteName: "KioskControllerTests-\(UUID().uuidString)")!
    }

    func kiosk(_ screen: FakeScreen) -> KioskController {
        KioskController(store: store, profile: nil, screen: screen,
                        brightnessStore: PreDimBrightnessStore(defaults: defaults))
    }
}

@MainActor @Test func dimsAtNightAndRestoresInTheMorning() throws {
    let fixture = try Fixture()
    let screen = FakeScreen(0.7)
    let kiosk = fixture.kiosk(screen)
    kiosk.evaluate(now: at(23))
    #expect(screen.brightness == 0)
    #expect(kiosk.isNightDimmed)
    kiosk.evaluate(now: at(6, day: 20))
    #expect(screen.brightness == 0.7)
    #expect(PreDimBrightnessStore(defaults: fixture.defaults).value == nil)
}

@MainActor @Test func launchAtNightAfterKillRestoresPersistedBrightness() throws {
    let fixture = try Fixture()
    let screen = FakeScreen(0.7)
    fixture.kiosk(screen).evaluate(now: at(23))
    #expect(screen.brightness == 0)
    // 03:00 재설치가 앱을 죽입니다. 밝기는 0으로 남고 새 프로세스가 뜹니다.
    let relaunched = fixture.kiosk(screen)
    relaunched.evaluate(now: at(3, 1, day: 20))
    #expect(screen.brightness == 0)
    relaunched.evaluate(now: at(6, day: 20))
    #expect(screen.brightness == 0.7)
}

@MainActor @Test func launchInDaytimeAfterKillRestoresPersistedBrightness() throws {
    let fixture = try Fixture()
    let screen = FakeScreen(0.6)
    fixture.kiosk(screen).evaluate(now: at(5, 59, day: 20))
    #expect(screen.brightness == 0)
    fixture.kiosk(screen).evaluate(now: at(6, 1, day: 20))
    #expect(screen.brightness == 0.6)
}

@MainActor @Test func restoreFloorsVeryLowBrightness() throws {
    let fixture = try Fixture()
    let screen = FakeScreen(0.05)
    let kiosk = fixture.kiosk(screen)
    kiosk.evaluate(now: at(23))
    kiosk.evaluate(now: at(6, day: 20))
    #expect(screen.brightness == 0.5)
}

@MainActor @Test func parentModeSuspendsDimmingAndWakesOnClose() throws {
    let fixture = try Fixture()
    let screen = FakeScreen(0.7)
    let kiosk = fixture.kiosk(screen)
    kiosk.evaluate(now: at(23))
    #expect(screen.brightness == 0)
    kiosk.setSuspended(true, now: at(23, 1))
    #expect(screen.brightness == 0.7)
    #expect(!kiosk.isNightDimmed)
    kiosk.evaluate(now: at(23, 10))
    #expect(screen.brightness == 0.7)
    kiosk.setSuspended(false, now: at(23, 20))
    kiosk.evaluate(now: at(23, 20, 29))
    #expect(!kiosk.isNightDimmed)
    kiosk.evaluate(now: at(23, 20, 30))
    #expect(kiosk.isNightDimmed)
    #expect(screen.brightness == 0)
}

@MainActor @Test func boardTouchesExtendTheWake() throws {
    let fixture = try Fixture()
    let screen = FakeScreen(0.7)
    let kiosk = fixture.kiosk(screen)
    kiosk.evaluate(now: at(23))
    kiosk.userTouched(now: at(23, 0, 10))
    kiosk.userTouched(now: at(23, 0, 35))
    kiosk.evaluate(now: at(23, 1, 0))
    #expect(!kiosk.isNightDimmed)
    kiosk.evaluate(now: at(23, 1, 5))
    #expect(kiosk.isNightDimmed)
}
