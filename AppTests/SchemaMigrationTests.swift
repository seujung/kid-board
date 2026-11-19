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
