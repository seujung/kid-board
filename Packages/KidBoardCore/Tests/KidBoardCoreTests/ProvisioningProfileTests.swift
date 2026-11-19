import Foundation
import Testing
@testable import KidBoardCore

@Test func parsesProfileDates() throws {
    let url = try #require(Bundle.module.url(forResource: "sample", withExtension: "mobileprovision", subdirectory: "Fixtures"))
    let dates = try #require(ProvisioningProfile.dates(from: try Data(contentsOf: url)))
    #expect(dates.creation == Date(timeIntervalSince1970: 1_795_046_400))
    #expect(dates.expiration == dates.creation.addingTimeInterval(7 * 86400))
}

@Test func garbageProfileIsNil() {
    #expect(ProvisioningProfile.dates(from: Data("hello".utf8)) == nil)
}

@Test func warningDaysLeft() {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    #expect(ProvisioningProfile.warningDaysLeft(expiration: now.addingTimeInterval(3 * 86400), now: now) == nil)
    #expect(ProvisioningProfile.warningDaysLeft(expiration: now.addingTimeInterval(2 * 86400), now: now) == 2)
    #expect(ProvisioningProfile.warningDaysLeft(expiration: now.addingTimeInterval(36 * 3600), now: now) == 2)
    #expect(ProvisioningProfile.warningDaysLeft(expiration: now.addingTimeInterval(3600), now: now) == 1)
}
