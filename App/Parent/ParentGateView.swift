import SwiftUI
import KidBoardCore

/// PIN을 확인하는 화면입니다. 맞으면 `onSuccess`를 부릅니다.
///
/// 5회 연속 틀리면 `BoardStore.verifyPin`이 잠금을 돌려주고, 이 화면은 남은 초를 세며 입력을 막습니다.
struct ParentGateView: View {
    let store: BoardStore
    let clock: BoardClock
    let title: String
    let onSuccess: () -> Void
    /// `nil`이면 "PIN을 잊었어요" 버튼을 숨깁니다.
    var onForgot: (() -> Void)?
    var onCancel: (() -> Void)?

    @State private var entry = ""
    @State private var message: String?
    @State private var shakes = 0
    @State private var lockedUntil: Date?

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            let remaining = remainingSeconds(now: clock.now())
            VStack(spacing: 28) {
                Spacer(minLength: 0)
                Text(title)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                PinDots(count: entry.count, shakes: shakes)
                Group {
                    if let remaining {
                        Text("잠시 후 다시 해 주세요 (\(remaining)초)")
                            .foregroundStyle(.red)
                    } else {
                        Text(message ?? " ")
                            .foregroundStyle(.red)
                    }
                }
                .font(.system(size: 20, weight: .semibold, design: .rounded))
                PinPad(entry: $entry, isDisabled: remaining != nil, onComplete: submit)
                if let onForgot {
                    Button("PIN을 잊었어요", action: onForgot)
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .overlay(alignment: .topLeading) {
            if let onCancel {
                Button("닫기", action: onCancel)
                    .font(.system(size: 20, weight: .semibold))
                    .padding(24)
            }
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .onAppear { lockedUntil = store.pinLockedUntil(now: clock.now()) }
    }

    private func remainingSeconds(now: Date) -> Int? {
        guard let lockedUntil, now < lockedUntil else { return nil }
        return Int(lockedUntil.timeIntervalSince(now).rounded(.up))
    }

    private func submit(_ pin: String) {
        switch store.verifyPin(pin, now: clock.now()) {
        case .ok:
            message = nil
            onSuccess()
        case .wrong:
            message = "PIN이 맞지 않아요"
            withAnimation(.default) { shakes += 1 }
        case .locked(let until):
            message = nil
            lockedUntil = until
            withAnimation(.default) { shakes += 1 }
        }
        entry = ""
    }
}

/// 입력한 자릿수를 동그라미 4개로 보여 줍니다.
struct PinDots: View {
    let count: Int
    var shakes = 0

    var body: some View {
        HStack(spacing: 22) {
            ForEach(0..<4, id: \.self) { index in
                Circle()
                    .fill(index < count ? Color.primary : Color.clear)
                    .overlay(Circle().strokeBorder(Color.primary, lineWidth: 2))
                    .frame(width: 22, height: 22)
            }
        }
        .modifier(ShakeEffect(shakes: CGFloat(shakes)))
        .accessibilityLabel("\(count)자리 입력함")
    }
}

/// 숫자 키패드입니다. 4자리가 차면 `onComplete`를 부릅니다.
struct PinPad: View {
    @Binding var entry: String
    var isDisabled = false
    let onComplete: (String) -> Void

    private let rows: [[String]] = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "⌫"]]

    var body: some View {
        VStack(spacing: 14) {
            ForEach(rows, id: \.self) { row in
                HStack(spacing: 14) {
                    ForEach(row, id: \.self) { key in
                        keyButton(key)
                    }
                }
            }
        }
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.35 : 1)
    }

    @ViewBuilder
    private func keyButton(_ key: String) -> some View {
        if key.isEmpty {
            Color.clear.frame(width: 84, height: 68)
        } else {
            Button {
                press(key)
            } label: {
                Text(key)
                    .font(.system(size: 30, weight: .semibold, design: .rounded))
                    .frame(width: 84, height: 68)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Color(.secondarySystemGroupedBackground)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(key == "⌫" ? "지우기" : key)
        }
    }

    private func press(_ key: String) {
        if key == "⌫" {
            if !entry.isEmpty { entry.removeLast() }
            return
        }
        guard entry.count < 4 else { return }
        entry.append(key)
        if entry.count == 4 { onComplete(entry) }
    }
}
