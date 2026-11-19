import SwiftUI

/// 서명 만료가 가까울 때 보드 오른쪽 위에 작게 보이는 배지입니다.
struct ExpiryBadgeView: View {
    let daysLeft: Int

    var body: some View {
        Text("앱 다시 설치 필요 (\(daysLeft)일 남음)")
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Capsule().fill(Color.red.opacity(0.85)))
            .accessibilityLabel("앱 다시 설치 필요, \(daysLeft)일 남음")
    }
}

/// 재설치 뒤 유도 접근을 다시 켜라고 알리는 배너입니다. 누르면 닫힙니다.
struct GuidedAccessBannerView: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(GuidedAccessReminder.message)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 10)
                .background(Capsule().fill(Color.orange.opacity(0.95)))
        }
        .buttonStyle(.plain)
    }
}
