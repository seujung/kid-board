import Foundation
import Testing
@testable import KidBoardCore

@Test func nightModeBoundaries() {
    #expect(DisplayPolicy.isNightMode(at(2026, 11, 19, 21, 59), calendar: seoul) == false)
    #expect(DisplayPolicy.isNightMode(at(2026, 11, 19, 22, 0), calendar: seoul) == true)
    #expect(DisplayPolicy.isNightMode(at(2026, 11, 19, 5, 59), calendar: seoul) == true)
    #expect(DisplayPolicy.isNightMode(at(2026, 11, 19, 6, 0), calendar: seoul) == false)
}

@Test func sceneBoundaries() {
    #expect(DisplayPolicy.scene(at(2026, 11, 19, 5, 59), calendar: seoul) == .night)
    #expect(DisplayPolicy.scene(at(2026, 11, 19, 6, 0), calendar: seoul) == .day)
    #expect(DisplayPolicy.scene(at(2026, 11, 19, 17, 59), calendar: seoul) == .day)
    #expect(DisplayPolicy.scene(at(2026, 11, 19, 18, 0), calendar: seoul) == .night)
}

@Test func umbrellaRules() {
    let school = at(2026, 11, 19, 8, 20)
    let seven = at(2026, 11, 19, 7, 0)
    #expect(DisplayPolicy.showsUmbrella(precipitationProbability: 50, now: seven, latestSchoolTime: school))
    #expect(!DisplayPolicy.showsUmbrella(precipitationProbability: 49, now: seven, latestSchoolTime: school))
    #expect(!DisplayPolicy.showsUmbrella(precipitationProbability: 80, now: school, latestSchoolTime: school))
    #expect(!DisplayPolicy.showsUmbrella(precipitationProbability: 80, now: seven, latestSchoolTime: nil))
}
