import SwiftUI
import KidBoardCore

/// 야간에 보드 전체를 덮는 검은 막입니다. 시계만 어둡게 크게 보이고, 누르면 `onWake`를 부릅니다.
struct NightOverlayView: View {
    let now: Date
    let calendar: Calendar
    let onWake: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.92)
            Text(BoardFormat.format(now, "HH:mm", calendar: calendar))
                .font(.system(size: 160, weight: .thin, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Color.white.opacity(0.22))
        }
        .ignoresSafeArea()
        .contentShape(Rectangle())
        .onTapGesture(perform: onWake)
        .accessibilityLabel("야간 모드. 화면을 누르면 30초 동안 켜집니다.")
    }
}
