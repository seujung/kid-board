import Foundation
import Testing
@testable import KidBoardCore

struct SplitMix64: RandomNumberGenerator {
    var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

@Test func pinFormat() {
    #expect(PinHasher.isValidFormat("1234"))
    #expect(!PinHasher.isValidFormat("123"))
    #expect(!PinHasher.isValidFormat("12a4"))
    #expect(!PinHasher.isValidFormat("12345"))
    #expect(!PinHasher.isValidFormat("１２３４"))
    #expect(!PinHasher.isValidFormat("١٢٣٤"))
    #expect(!PinHasher.isValidFormat(""))
}

@Test func hashIsDeterministicPerSalt() {
    let s1 = Data([1, 2, 3])
    let s2 = Data([4, 5, 6])
    let h = PinHasher.hash(pin: "1234", salt: s1)
    #expect(h == PinHasher.hash(pin: "1234", salt: s1))
    #expect(h != PinHasher.hash(pin: "1234", salt: s2))
    #expect(h != PinHasher.hash(pin: "1235", salt: s1))
    #expect(h.count == 64)
    #expect(h == h.lowercased())
    // SHA256 of empty input (known vector)
    #expect(PinHasher.hash(pin: "", salt: Data()) == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
}

@Test func makeSaltIs16RandomBytes() {
    let a = PinHasher.makeSalt()
    #expect(a.count == 16)
    #expect(a != PinHasher.makeSalt())
}

@Test func locksOnFifthFailure() {
    var l = PinLockout()
    let now = Date(timeIntervalSince1970: 1_000)
    for _ in 0..<4 { l.recordFailure(now: now) }
    #expect(!l.isLocked(now: now))
    l.recordFailure(now: now)
    #expect(l.isLocked(now: now))
    #expect(l.failures == 0)
    #expect(l.lockedUntil == now.addingTimeInterval(60))
    #expect(l.isLocked(now: now.addingTimeInterval(59)))
    #expect(!l.isLocked(now: now.addingTimeInterval(60)))
}

@Test func successResetsFailures() {
    var l = PinLockout()
    let now = Date(timeIntervalSince1970: 1_000)
    for _ in 0..<4 { l.recordFailure(now: now) }
    l.recordSuccess()
    l.recordFailure(now: now)
    #expect(!l.isLocked(now: now))
    #expect(l.failures == 1)
}

@Test func successClearsLock() {
    var l = PinLockout()
    let now = Date(timeIntervalSince1970: 1_000)
    for _ in 0..<5 { l.recordFailure(now: now) }
    l.recordSuccess()
    #expect(l.lockedUntil == nil)
    #expect(!l.isLocked(now: now))
}

@Test func lockoutIsCodable() throws {
    var l = PinLockout()
    l.recordFailure(now: Date(timeIntervalSince1970: 5))
    let d = try JSONEncoder().encode(l)
    #expect(try JSONDecoder().decode(PinLockout.self, from: d) == l)
}

@Test func quizHasThreeTwoDigitQuestions() {
    var g = SplitMix64(seed: 42)
    let quiz = RecoveryQuiz.make(using: &g)
    #expect(quiz.questions.count == 3)
    for q in quiz.questions {
        #expect((10...99).contains(q.a))
        #expect((10...99).contains(q.b))
    }
}

@Test func quizCheck() {
    let quiz = RecoveryQuiz(questions: [(a: 12, b: 34), (a: 56, b: 78), (a: 90, b: 11)])
    let right = [408, 4368, 990]
    #expect(quiz.check(right))
    #expect(!quiz.check([408, 4368, 991]))
    #expect(!quiz.check([408, 4368]))
    #expect(!quiz.check(right + [1]))
}

@Test func parentGateConstants() {
    #expect(ParentGate.longPressDuration == 3)
    #expect(ParentGate.idleTimeout == 120)
}
