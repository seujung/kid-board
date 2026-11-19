import CryptoKit
import Foundation

public enum PinHasher {
    /// Exactly four ASCII digits (0-9).
    public static func isValidFormat(_ pin: String) -> Bool {
        let scalars = Array(pin.unicodeScalars)
        return scalars.count == 4 && pin.count == 4
            && scalars.allSatisfy { $0.value >= 0x30 && $0.value <= 0x39 }
    }

    /// Lowercase hex of SHA256(salt bytes + PIN UTF-8 bytes).
    public static func hash(pin: String, salt: Data) -> String {
        var input = salt
        input.append(contentsOf: Array(pin.utf8))
        return SHA256.hash(data: input).map { String(format: "%02x", $0) }.joined()
    }

    /// 16 random bytes from the system CSPRNG.
    public static func makeSalt() -> Data {
        var rng = SystemRandomNumberGenerator()
        return Data((0..<16).map { _ in UInt8.random(in: .min ... .max, using: &rng) })
    }
}

public struct PinLockout: Codable, Sendable, Equatable {
    public static let maxFailures = 5
    public static let lockDuration: TimeInterval = 60

    public var failures: Int
    public var lockedUntil: Date?

    public init(failures: Int = 0, lockedUntil: Date? = nil) {
        self.failures = failures
        self.lockedUntil = lockedUntil
    }

    public mutating func recordFailure(now: Date) {
        failures += 1
        if failures >= Self.maxFailures {
            lockedUntil = now.addingTimeInterval(Self.lockDuration)
            failures = 0
        }
    }

    public mutating func recordSuccess() {
        failures = 0
        lockedUntil = nil
    }

    public func isLocked(now: Date) -> Bool {
        guard let lockedUntil else { return false }
        return now < lockedUntil
    }
}

public struct RecoveryQuiz: Sendable {
    public let questions: [(a: Int, b: Int)]

    public init(questions: [(a: Int, b: Int)]) {
        self.questions = questions
    }

    public static func make<G: RandomNumberGenerator>(using generator: inout G) -> RecoveryQuiz {
        let qs = (0..<3).map { _ in
            (a: Int.random(in: 10...99, using: &generator),
             b: Int.random(in: 10...99, using: &generator))
        }
        return RecoveryQuiz(questions: qs)
    }

    public func check(_ answers: [Int]) -> Bool {
        guard answers.count == 3, questions.count == 3 else { return false }
        return zip(questions, answers).allSatisfy { $0.a * $0.b == $1 }
    }
}

public enum ParentGate {
    public static let longPressDuration: TimeInterval = 3
    public static let idleTimeout: TimeInterval = 120
}
