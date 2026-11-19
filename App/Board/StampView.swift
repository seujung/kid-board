import SwiftUI
import KidBoardCore

/// 완료 카드의 "참 잘했어요" 도장과 요일 칸의 별 도장입니다.
struct StampView: View {
    enum Kind {
        case wellDone
        case star
    }

    let kind: Kind
    var size: CGFloat = 76
    /// `true`이면 처음 나타날 때 위에서 꾹 찍히는 애니메이션을 재생합니다.
    var animateIn = false

    @State private var landed = false

    var body: some View {
        stamp
            .scaleEffect(animateIn && !landed ? 2.2 : 1)
            .opacity(animateIn && !landed ? 0 : 1)
            .onAppear {
                guard animateIn else { return }
                withAnimation(.spring(response: 0.35, dampingFraction: 0.55)) { landed = true }
            }
            .accessibilityLabel(kind == .wellDone ? "참 잘했어요" : "별 도장")
    }

    @ViewBuilder private var stamp: some View {
        switch kind {
        case .wellDone: wellDone
        case .star: star
        }
    }

    private static let stampRed = Color(red: 0.86, green: 0.16, blue: 0.18)

    private var wellDone: some View {
        ZStack {
            Circle()
                .fill(Self.stampRed.opacity(0.08))
            Circle()
                .strokeBorder(Self.stampRed, lineWidth: size * 0.06)
            Circle()
                .strokeBorder(Self.stampRed.opacity(0.85), lineWidth: size * 0.02)
                .padding(size * 0.1)
            VStack(spacing: 0) {
                Text("참")
                Text("잘했어요")
            }
            .font(.system(size: size * 0.17, weight: .black, design: .rounded))
            .foregroundStyle(Self.stampRed)
            .minimumScaleFactor(0.5)
            .padding(size * 0.17)
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(-14))
    }

    private var star: some View {
        Image(systemName: "star.fill")
            .resizable()
            .scaledToFit()
            .foregroundStyle(
                LinearGradient(colors: [Color(red: 1, green: 0.86, blue: 0.3), Color(red: 0.96, green: 0.64, blue: 0.05)],
                               startPoint: .top, endPoint: .bottom)
            )
            .overlay(
                Image(systemName: "star")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(Color(red: 0.8, green: 0.5, blue: 0.0))
            )
            .shadow(color: .orange.opacity(0.4), radius: 2, y: 1)
            .frame(width: size, height: size)
            .rotationEffect(.degrees(-8))
    }
}

/// 지금 할 카드에 붙는 노란 알약 모양 표시입니다.
struct NowBadge: View {
    var body: some View {
        Text("지금 하자!")
            .font(.system(size: 17, weight: .heavy, design: .rounded))
            .foregroundStyle(Color(red: 0.35, green: 0.22, blue: 0.0))
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(Capsule().fill(Color(red: 1, green: 0.85, blue: 0.2)))
            .overlay(Capsule().strokeBorder(Color(red: 0.93, green: 0.65, blue: 0.0), lineWidth: 2))
            .shadow(color: .black.opacity(0.15), radius: 2, y: 1)
    }
}

/// 보이는 할 일을 모두 끝냈을 때 2초 동안 재생하는 축하 애니메이션입니다.
struct CelebrationView: View {
    static let duration: Duration = .seconds(2)

    private static let pieces: [(emoji: String, x: CGFloat, y: CGFloat, spin: Double)] = [
        ("🎉", -0.34, -0.3, -40), ("⭐️", 0.32, -0.32, 50), ("🌟", -0.36, 0.18, 30),
        ("✨", 0.36, 0.2, -30), ("🎊", -0.08, -0.36, 20), ("💖", 0.12, 0.34, -20),
        ("⭐️", -0.24, 0.32, 60), ("🎉", 0.26, -0.12, -50), ("✨", -0.2, -0.14, 40),
    ]

    @State private var burst = false

    var body: some View {
        GeometryReader { geo in
            ZStack {
                RoundedRectangle(cornerRadius: 28).fill(Color.white.opacity(burst ? 0.55 : 0))
                ForEach(Array(Self.pieces.enumerated()), id: \.offset) { _, piece in
                    Text(piece.emoji)
                        .font(.system(size: 54))
                        .offset(x: burst ? piece.x * geo.size.width : 0,
                                y: burst ? piece.y * geo.size.height : 0)
                        .rotationEffect(.degrees(burst ? piece.spin : 0))
                        .scaleEffect(burst ? 1 : 0.2)
                }
                Text(BoardCopy.remainingText(0))
                    .font(.system(size: 40, weight: .black, design: .rounded))
                    .foregroundStyle(Color(red: 0.86, green: 0.16, blue: 0.18))
                    .padding(.horizontal, 28)
                    .padding(.vertical, 14)
                    .background(Capsule().fill(Color.white))
                    .shadow(color: .black.opacity(0.2), radius: 8, y: 3)
                    .scaleEffect(burst ? 1 : 0.3)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) { burst = true }
        }
        .transition(.opacity)
    }
}

#Preview("도장") {
    HStack(spacing: 40) {
        StampView(kind: .wellDone)
        StampView(kind: .wellDone, animateIn: true)
        StampView(kind: .star, size: 40)
        NowBadge()
    }
    .padding(40)
}

#Preview("축하") {
    CelebrationView()
        .frame(width: 560, height: 500)
        .background(Color(red: 1, green: 0.94, blue: 0.92))
}
