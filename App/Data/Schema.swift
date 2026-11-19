import Foundation
import SwiftData

/// 첫 번째 저장소 스키마입니다. 버전 없이 만든 첫 시험 설치의 저장소와 모양이 같습니다.
enum KidBoardSchemaV1: VersionedSchema {
    static let versionIdentifier = Schema.Version(1, 0, 0)

    static var models: [any PersistentModel.Type] {
        [
            ChildModel.self, TaskModel.self, TaskScheduleModel.self, DailyTimesModel.self,
            CompletionModel.self, AppSettingsModel.self, WeatherCacheModel.self,
        ]
    }
}

/// 저장소 스키마의 이전 계획입니다. 모델을 바꾸면 새 버전과 단계를 여기에 더합니다.
enum KidBoardMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] { [KidBoardSchemaV1.self] }
    static var stages: [MigrationStage] { [] }
}

/// 앱과 테스트가 같은 스키마와 이전 계획으로 저장소를 엽니다.
enum KidBoardContainer {
    /// 현재 스키마입니다.
    static var schema: Schema { Schema(versionedSchema: KidBoardSchemaV1.self) }

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
