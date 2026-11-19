import SwiftUI
import KidBoardCore

/// "등교까지 18분 20초" 카운트다운과 진행 막대입니다.
struct CountdownCard: View {
    let phase: BoardPhase
    let now: Date
    let remaining: Int
    let progress: Double
    let theme: ChildTheme

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if case .finished(let allDone) = phase {
                finished(allDone: allDone)
            } else {
                countdown
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 20).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(theme.accent.opacity(0.3), lineWidth: 2))
    }

    private func finished(allDone: Bool) -> some View {
        HStack(spacing: 10) {
            Text(allDone ? "🌟" : "🌙").font(.system(size: 34))
            Text(BoardCopy.finishedText(allDone: allDone))
                .font(.system(size: 28, weight: .heavy, design: .rounded))
                .foregroundStyle(BoardPalette.ink)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .frame(minHeight: 72)
    }

    private var countdown: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(BoardCopy.countdownLabel(phase) ?? "")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundStyle(BoardPalette.ink.opacity(0.75))
                Text(Self.timeText(until: deadline, now: now))
                    .font(.system(size: 32, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(theme.accent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            ProgressBar(progress: progress, tint: theme.accent)
                .frame(height: 16)
            Text(BoardCopy.remainingText(remaining))
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(BoardPalette.ink)
        }
    }

    private var deadline: Date {
        switch phase {
        case .morning(let deadline), .evening(let deadline), .allDay(let deadline): deadline
        case .finished: now
        }
    }

    /// 남은 시간을 "18분 20초"처럼 씁니다. 1시간 이상 남으면 앞에 시간을 붙입니다.
    static func timeText(until deadline: Date, now: Date) -> String {
        let total = max(0, Int(deadline.timeIntervalSince(now).rounded(.down)))
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let seconds = total % 60
        let tail = String(format: "%d분 %02d초", minutes, seconds)
        return hours > 0 ? "\(hours)시간 \(tail)" : tail
    }
}

/// 둥근 진행 막대입니다.
struct ProgressBar: View {
    let progress: Double
    let tint: Color

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(tint.opacity(0.15))
                Capsule()
                    .fill(tint)
                    .frame(width: max(0, geo.size.width * min(1, progress)))
                    .animation(.spring(response: 0.5), value: progress)
            }
        }
        .accessibilityLabel("진행 \(Int(progress * 100))%")
    }
}

#Preview("카운트다운") {
    let now = Date()
    return VStack(spacing: 20) {
        CountdownCard(phase: .morning(deadline: now.addingTimeInterval(1100)), now: now,
                      remaining: 2, progress: 0.6, theme: .named("coral"))
        CountdownCard(phase: .evening(deadline: now.addingTimeInterval(5400)), now: now,
                      remaining: 0, progress: 1, theme: .named("sky"))
        CountdownCard(phase: .finished(allDone: true), now: now, remaining: 0, progress: 1, theme: .named("sky"))
        CountdownCard(phase: .finished(allDone: false), now: now, remaining: 2, progress: 0.5, theme: .named("coral"))
    }
    .padding(30)
    .frame(width: 360)
    .background(BoardPalette.background)
}
