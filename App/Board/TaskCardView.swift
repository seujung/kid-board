import SwiftUI
import KidBoardCore

/// 할 일 카드 하나입니다. 순서 번호, 이모지 아이콘, 제목을 표시합니다.
struct TaskCardView: View {
    let number: Int
    let task: TaskInfo
    let isDone: Bool
    let isNow: Bool
    let theme: ChildTheme
    /// 방금 완료한 카드이면 도장 애니메이션을 재생합니다.
    var animateStamp = false
    /// 바꿀 수 없는 카드를 눌렀을 때 흔들기 위한 값입니다. 값이 바뀔 때마다 한 번 흔듭니다.
    var shakes = 0
    /// 카드 높이입니다. 패널이 남은 높이에 맞춰 정합니다.
    var height: CGFloat = 146
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            card
        }
        .buttonStyle(PressableCardStyle())
        .modifier(ShakeEffect(shakes: CGFloat(shakes)))
        .animation(.linear(duration: 0.4), value: shakes)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(number)번 \(task.title)\(isDone ? ", 완료" : "")\(isNow ? ", 지금 하자" : "")")
    }

    private var card: some View {
        VStack(spacing: 6) {
            HStack {
                Text("\(number)")
                    .font(.system(size: 17, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(theme.accent))
                Spacer()
            }
            Text(task.icon)
                .font(.system(size: min(44, height * 0.3)))
            Text(task.title)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(BoardPalette.ink)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity)
            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, minHeight: height, maxHeight: height)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(isDone ? theme.soft : Color.white)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .strokeBorder(isNow ? Color(red: 1, green: 0.78, blue: 0.1) : theme.accent.opacity(0.35),
                              lineWidth: isNow ? 4 : 2)
        )
        .overlay(alignment: .topTrailing) {
            if isDone {
                StampView(kind: .wellDone, size: min(84, height * 0.62), animateIn: animateStamp)
                    .id(animateStamp)
                    .offset(x: 2, y: -6)
                    .allowsHitTesting(false)
            }
        }
        .overlay(alignment: .top) {
            if isNow {
                NowBadge().offset(y: -14)
            }
        }
        .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
    }
}

/// 누르는 동안 살짝 작아지는 카드 버튼 모양입니다.
struct PressableCardStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// 좌우로 살짝 흔드는 효과입니다.
struct ShakeEffect: GeometryEffect {
    var shakes: CGFloat
    var animatableData: CGFloat {
        get { shakes }
        set { shakes = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 8 * sin(shakes * .pi * 4), y: 0))
    }
}

#Preview("할 일 카드") {
    let childID = UUID()
    let task = TaskInfo(id: UUID(), childID: childID, title: "내일 준비물 챙기기", icon: "✏️", order: 0)
    return HStack(spacing: 16) {
        TaskCardView(number: 1, task: task, isDone: true, isNow: false, theme: .named("coral"))
        TaskCardView(number: 2, task: task, isDone: false, isNow: true, theme: .named("coral"))
        TaskCardView(number: 3, task: task, isDone: false, isNow: false, theme: .named("sky"))
    }
    .padding(30)
    .frame(width: 600)
    .background(BoardPalette.background)
}
