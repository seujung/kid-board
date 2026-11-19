import Foundation
import SwiftData
import Testing
@testable import KidBoard

private func temporaryStoreURL() -> URL {
    FileManager.default.temporaryDirectory
        .appendingPathComponent("SchemaMigrationTests-\(UUID().uuidString)")
        .appendingPathComponent("default.store")
}

/// 버전 없이 만든 V1 모양의 저장소(첫 시험 설치의 저장소)를 현재 스키마로 옮길 수 있어야 합니다.
@MainActor @Test func unversionedV1StoreMigratesToCurrentSchema() throws {
    let url = temporaryStoreURL()
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
    do {
        let legacy = try ModelContainer(
            for: Schema(KidBoardSchemaV1.models),
            configurations: ModelConfiguration(url: url))
        let context = ModelContext(legacy)
        context.insert(ChildModel(name: "첫째", avatar: "🐰", themeColor: "coral", order: 0))
        let settings = KidBoardSchemaV1.AppSettingsModel()
        settings.pinHash = "hash"
        context.insert(settings)
        try context.save()
    }
    let container = try KidBoardContainer.make(url: url)
    let context = ModelContext(container)
    #expect(try context.fetch(FetchDescriptor<ChildModel>()).map(\.name) == ["첫째"])
    let settings = try context.fetch(FetchDescriptor<AppSettingsModel>())
    #expect(settings.count == 1)
    #expect(settings.first?.pinHash == "hash")
    #expect(settings.first?.didSeed == false)
}

/// Task 8 시험 설치 때의 모양입니다. `locationAdmin1`이 없습니다. 이전 계획에 없는 버전입니다.
private enum LegacyTrialSchema {
    @Model
    final class AppSettingsModel {
        var pinHash: String?
        var pinSalt: Data?
        var lockoutFailures: Int
        var lockoutUntil: Date?
        var locationName: String?
        var latitude: Double?
        var longitude: Double?
        var lastSeenProfileCreation: Date?

        init() {
            lockoutFailures = 0
        }
    }
}

/// 이전 계획이 모르는 모양의 저장소도 자동 경량 이전으로 엽니다. 데이터를 잃지 않습니다.
@MainActor @Test func unknownLightweightCompatibleStoreStillOpens() throws {
    let url = temporaryStoreURL()
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
    do {
        let legacy = try ModelContainer(
            for: Schema([
                ChildModel.self, TaskModel.self, TaskScheduleModel.self, DailyTimesModel.self,
                CompletionModel.self, LegacyTrialSchema.AppSettingsModel.self, WeatherCacheModel.self,
            ]),
            configurations: ModelConfiguration(url: url))
        let context = ModelContext(legacy)
        context.insert(ChildModel(name: "둘째", avatar: "🐻", themeColor: "sky", order: 0))
        let settings = LegacyTrialSchema.AppSettingsModel()
        settings.locationName = "서울"
        context.insert(settings)
        try context.save()
    }
    let container = try KidBoardContainer.make(url: url)
    let context = ModelContext(container)
    #expect(try context.fetch(FetchDescriptor<ChildModel>()).map(\.name) == ["둘째"])
    #expect(try context.fetch(FetchDescriptor<AppSettingsModel>()).first?.locationName == "서울")
    // 한 번 연 저장소는 현재 버전이 되어 이전 계획만으로 다시 열립니다.
    _ = try ModelContainer(for: KidBoardContainer.schema, migrationPlan: KidBoardMigrationPlan.self,
                           configurations: ModelConfiguration(url: url))
}
