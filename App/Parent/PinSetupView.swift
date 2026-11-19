import SwiftUI
import KidBoardCore

/// 새 PIN 4자리를 두 번 입력받아 저장합니다.
struct PinSetupView: View {
    let store: BoardStore
    let title: String
    let onDone: () -> Void
    var onCancel: (() -> Void)?

    @State private var first: String?
    @State private var entry = ""
    @State private var message: String?
    @State private var shakes = 0

    var body: some View {
        VStack(spacing: 28) {
            Spacer(minLength: 0)
            Text(title)
                .font(.system(size: 32, weight: .bold, design: .rounded))
            Text(first == nil ? "PIN 4자리를 입력해 주세요" : "한 번 더 입력해 주세요")
                .font(.system(size: 22, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
            PinDots(count: entry.count, shakes: shakes)
            Text(message ?? " ")
                .font(.system(size: 20, weight: .semibold, design: .rounded))
                .foregroundStyle(.red)
            PinPad(entry: $entry, onComplete: submit)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay(alignment: .topLeading) {
            if let onCancel {
                Button("닫기", action: onCancel)
                    .font(.system(size: 20, weight: .semibold))
                    .padding(24)
            }
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
    }

    private func submit(_ pin: String) {
        defer { entry = "" }
        guard PinHasher.isValidFormat(pin) else { return }
        guard let first else {
            self.first = pin
            message = nil
            return
        }
        if first == pin {
            store.setPin(pin)
            onDone()
        } else {
            self.first = nil
            message = "두 PIN이 달라요. 처음부터 다시 입력해 주세요"
            withAnimation(.default) { shakes += 1 }
        }
    }
}

/// PIN 변경입니다. 지금 PIN을 먼저 확인한 뒤 새 PIN을 받습니다.
struct PinChangeView: View {
    let store: BoardStore
    let clock: BoardClock
    let onDone: () -> Void

    @State private var verified = false

    var body: some View {
        Group {
            if verified {
                PinSetupView(store: store, title: "새 PIN을 정해 주세요", onDone: onDone)
            } else {
                ParentGateView(store: store, clock: clock, title: "지금 쓰는 PIN을 입력해 주세요",
                               onSuccess: { verified = true })
            }
        }
        .navigationTitle(ParentScreen.changePin.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
