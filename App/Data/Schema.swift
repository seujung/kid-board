import Foundation
import SwiftData

/// 첫 번째 저장소 스키마입니다. 버전 없이 만든 첫 시험 설치의 저장소와 모양이 같습니다.
///
/// 바뀐 모델은 그때 모양 그대로 여기에 얼려 둡니다. 바뀌지 않은 모델은 현재 형식을 씁니다.
enum KidBoardSchemaV1: VersionedSchema {
    static let versionIdentifier = Schema.Version(1, 0, 0)

    static var models: [any PersistentModel.Type] {
        [
            ChildModel.self, TaskModel.self, TaskScheduleModel.self, DailyTimesModel.self,
            CompletionModel.self, KidBoardSchemaV1.AppSettingsModel.self, WeatherCacheModel.self,
        ]
    }

    @Model
    final class AppSettingsModel {
        var pinHash: String?
        var pinSalt: Data?
        var lockoutFailures: Int
        var lockoutUntil: Date?
        var locationName: String?
        var locationAdmin1: String?
        var latitude: Double?
        var longitude: Double?
        var lastSeenProfileCreation: Date?

        init() {
            lockoutFailures = 0
        }
    }
}

/// 두 번째 저장소 스키마입니다. `AppSettingsModel`에 `didSeed`를 더했습니다.
enum KidBoardSchemaV2: VersionedSchema {
    static let versionIdentifier = Schema.Version(2, 0, 0)

    static var models: [any PersistentModel.Type] {
        [
            ChildModel.self, TaskModel.self, TaskScheduleModel.self, DailyTimesModel.self,
            CompletionModel.self, AppSettingsModel.self, WeatherCacheModel.self,
        ]
    }
}

/// 저장소 스키마의 이전 계획입니다. 모델을 바꾸면 새 버전과 단계를 여기에 더합니다.
enum KidBoardMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] { [KidBoardSchemaV1.self, KidBoardSchemaV2.self] }

    static var stages: [MigrationStage] {
        [.lightweight(fromVersion: KidBoardSchemaV1.self, toVersion: KidBoardSchemaV2.self)]
    }
}

/// 앱과 테스트가 같은 스키마와 이전 계획으로 저장소를 엽니다.
enum KidBoardContainer {
    /// 현재 스키마입니다.
    static var schema: Schema { Schema(versionedSchema: KidBoardSchemaV2.self) }

    /// 기본 위치의 저장소를 엽니다. `inMemory`가 `true`이면 메모리 전용 저장소를 엽니다.
    static func make(inMemory: Bool = false) throws -> ModelContainer {
        try ModelContainer(for: schema, migrationPlan: KidBoardMigrationPlan.self,
                           configurations: ModelConfiguration(isStoredInMemoryOnly: inMemory))
    }

    /// `url`의 저장소를 엽니다. 이전 테스트에서 씁니다.
    static func make(url: URL) throws -> ModelContainer {
        try ModelContainer(for: schema, migrationPlan: KidBoardMigrationPlan.self,
                           configurations: ModelConfiguration(url: url))
    }
}
