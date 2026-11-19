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
            PlaceholderBoardView(store: store)
        }
        .modelContainer(container)
    }
}

/// Task 9에서 보드 화면으로 바꿀 임시 화면입니다.
struct PlaceholderBoardView: View {
    @ObservedObject var store: BoardStore

    var body: some View {
        let calendar = store.calendar
        let today = DayDate(Date(), calendar: calendar)
        let data = store.snapshot()
        let engine = ScheduleEngine(calendar: calendar)
        List(data.children) { child in
            HStack {
                Text("\(child.avatar) \(child.name)")
                Spacer()
                Text("\(engine.tasks(childID: child.id, on: today, data: data).count)개")
            }
        }
        .onAppear { store.seedIfEmpty(today: today) }
    }
}
