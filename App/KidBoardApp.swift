import SwiftUI
import SwiftData
import KidBoardCore

@main
struct KidBoardApp: App {
    let container: ModelContainer
    @StateObject private var store: BoardStore
    @StateObject private var kiosk: KioskController

    init() {
        let schema = Schema([
            ChildModel.self, TaskModel.self, TaskScheduleModel.self, DailyTimesModel.self,
            CompletionModel.self, AppSettingsModel.self, WeatherCacheModel.self,
        ])
        let container = try! ModelContainer(for: schema)
        self.container = container
        let store = BoardStore(context: container.mainContext)
        _store = StateObject(wrappedValue: store)
        _kiosk = StateObject(wrappedValue: KioskController(store: store))
    }

    var body: some Scene {
        WindowGroup {
            BoardView(store: store, kiosk: kiosk)
                .onAppear { kiosk.start() }
        }
        .modelContainer(container)
    }
}
