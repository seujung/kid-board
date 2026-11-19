import Foundation
import SwiftData
import Testing
@testable import KidBoard

private func temporaryStoreURL() -> URL {
    FileManager.default.temporaryDirectory
        .appendingPathComponent("SchemaMigrationTests-\(UUID().uuidString)")
        .appendingPathComponent("default.store")
}

/// 버전 없이 만든 저장소(첫 시험 설치의 저장소)를 버전 스키마와 이전 계획으로 열 수 있어야 합니다.
@MainActor @Test func unversionedStoreOpensWithMigrationPlan() throws {
    let url = temporaryStoreURL()
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
    do {
        let legacy = try ModelContainer(
            for: Schema([
                ChildModel.self, TaskModel.self, TaskScheduleModel.self, DailyTimesModel.self,
                CompletionModel.self, AppSettingsModel.self, WeatherCacheModel.self,
            ]),
            configurations: ModelConfiguration(url: url))
        let context = ModelContext(legacy)
        context.insert(ChildModel(name: "첫째", avatar: "🐰", themeColor: "coral", order: 0))
        let settings = AppSettingsModel()
        settings.pinHash = "hash"
        context.insert(settings)
        try context.save()
    }
    let container = try KidBoardContainer.make(url: url)
    let context = ModelContext(container)
    #expect(try context.fetch(FetchDescriptor<ChildModel>()).map(\.name) == ["첫째"])
    #expect(try context.fetch(FetchDescriptor<AppSettingsModel>()).first?.pinHash == "hash")
}
