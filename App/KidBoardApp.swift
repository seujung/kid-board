import SwiftUI
import SwiftData
import KidBoardCore

@main
struct KidBoardApp: App {
    let container: ModelContainer
    @StateObject private var store: BoardStore

    init() {
        let schema = Schema([
            ChildModel.self, TaskModel.self, TaskScheduleModel.self, DailyTimesModel.self,
            CompletionModel.self, AppSettingsModel.self, WeatherCacheModel.self,
        ])
        let container = try! ModelContainer(for: schema)
        self.container = container
        _store = StateObject(wrappedValue: BoardStore(context: container.mainContext))
    }

    var body: some Scene {
        WindowGroup {
            BoardView(store: store)
        }
        .modelContainer(container)
    }
}
