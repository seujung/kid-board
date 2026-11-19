import SwiftUI
import KidBoardCore

/// PIN을 잊었을 때 두 자리 수 곱셈 3문제를 냅니다. 모두 맞히면 `onSuccess`를 부릅니다.
struct PinRecoveryView: View {
    let onSuccess: () -> Void
    let onCancel: () -> Void

    @State private var quiz: RecoveryQuiz
    @State private var answers: [String] = ["", "", ""]
    @State private var message: String?
    @FocusState private var focused: Int?

    init(quiz: RecoveryQuiz? = nil, onSuccess: @escaping () -> Void, onCancel: @escaping () -> Void) {
        self.onSuccess = onSuccess
        self.onCancel = onCancel
        _quiz = State(initialValue: quiz ?? Self.makeQuiz())
    }

    private static func makeQuiz() -> RecoveryQuiz {
        var generator = SystemRandomNumberGenerator()
        return RecoveryQuiz.make(using: &generator)
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer(minLength: 0)
            Text("PIN 찾기")
                .font(.system(size: 32, weight: .bold, design: .rounded))
            Text("세 문제를 모두 맞히면 새 PIN을 정할 수 있어요")
                .font(.system(size: 20, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
            VStack(spacing: 16) {
                ForEach(0..<quiz.questions.count, id: \.self) { index in
                    row(index)
                }
            }
            Text(message ?? " ")
                .font(.system(size: 20, weight: .semibold, design: .rounded))
                .foregroundStyle(.red)
            Button(action: check) {
                Text("확인")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .frame(width: 200, height: 54)
            }
            .buttonStyle(.borderedProminent)
            .disabled(answers.contains { Int($0) == nil })
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay(alignment: .topLeading) {
            Button("돌아가기", action: onCancel)
                .font(.system(size: 20, weight: .semibold))
                .padding(24)
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .onAppear { focused = 0 }
    }

    private func row(_ index: Int) -> some View {
        let question = quiz.questions[index]
        return HStack(spacing: 16) {
            Text("\(question.a) × \(question.b) =")
                .font(.system(size: 30, weight: .semibold, design: .rounded))
                .monospacedDigit()
            TextField("답", text: $answers[index])
                .keyboardType(.numberPad)
                .font(.system(size: 30, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .frame(width: 140)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemGroupedBackground)))
                .focused($focused, equals: index)
        }
    }

    private func check() {
        let values = answers.compactMap { Int($0) }
        if quiz.check(values) {
            onSuccess()
        } else {
            message = "맞지 않는 답이 있어요. 새 문제로 다시 해 주세요"
            quiz = Self.makeQuiz()
            answers = ["", "", ""]
            focused = 0
        }
    }
}
