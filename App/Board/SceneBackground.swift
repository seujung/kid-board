import SwiftUI
import KidBoardCore

/// 헤더 뒤의 낮/밤 풍경입니다. 언덕, 나무, 해/달, 별을 도형으로 그립니다.
struct SceneBackground: View {
    let scene: BoardScene

    private var isDay: Bool { scene == .day }

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            ZStack(alignment: .topLeading) {
                LinearGradient(colors: skyColors, startPoint: .top, endPoint: .bottom)
                if isDay {
                    sun(size: size)
                    cloud.frame(width: 150, height: 52).position(x: size.width * 0.34, y: size.height * 0.24)
                    cloud.frame(width: 110, height: 38).position(x: size.width * 0.68, y: size.height * 0.16)
                } else {
                    stars(size: size)
                    moon(size: size)
                }
                HillShape(crest: [0.42, 0.55, 0.38, 0.5, 0.62, 0.44, 0.5])
                    .fill(isDay ? Color(red: 0.55, green: 0.78, blue: 0.47) : Color(red: 0.14, green: 0.24, blue: 0.3))
                trees(size: size)
                HillShape(crest: [0.22, 0.3, 0.2, 0.26, 0.18, 0.28, 0.24])
                    .fill(isDay ? Color(red: 0.42, green: 0.69, blue: 0.36) : Color(red: 0.1, green: 0.18, blue: 0.23))
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }

    private var skyColors: [Color] {
        isDay
            ? [Color(red: 0.5, green: 0.78, blue: 0.98), Color(red: 0.84, green: 0.94, blue: 1.0)]
            : [Color(red: 0.07, green: 0.09, blue: 0.27), Color(red: 0.24, green: 0.2, blue: 0.45)]
    }

    private func sun(size: CGSize) -> some View {
        ZStack {
            Circle().fill(Color.yellow.opacity(0.25)).frame(width: 130, height: 130)
            Circle().fill(Color(red: 1, green: 0.84, blue: 0.25)).frame(width: 84, height: 84)
        }
        .position(x: size.width * 0.52, y: size.height * 0.3)
    }

    private func moon(size: CGSize) -> some View {
        ZStack {
            Circle().fill(Color.white.opacity(0.12)).frame(width: 120, height: 120)
            Circle()
                .fill(Color(red: 1, green: 0.96, blue: 0.78))
                .frame(width: 70, height: 70)
                .mask(
                    Rectangle()
                        .overlay(Circle().frame(width: 62, height: 62).offset(x: 22, y: -12).blendMode(.destinationOut))
                        .compositingGroup()
                )
        }
        .position(x: size.width * 0.52, y: size.height * 0.3)
    }

    private static let starSpots: [(x: CGFloat, y: CGFloat, r: CGFloat)] = [
        (0.06, 0.12, 2.5), (0.14, 0.3, 1.8), (0.22, 0.08, 2.2), (0.3, 0.22, 1.5), (0.38, 0.1, 2.8),
        (0.45, 0.38, 1.6), (0.6, 0.12, 2.0), (0.66, 0.32, 1.6), (0.72, 0.06, 2.6), (0.8, 0.24, 1.8),
        (0.86, 0.1, 2.2), (0.93, 0.3, 1.6), (0.98, 0.14, 2.0), (0.27, 0.4, 1.4), (0.76, 0.42, 1.4),
    ]

    private func stars(size: CGSize) -> some View {
        ForEach(Array(Self.starSpots.enumerated()), id: \.offset) { _, spot in
            Circle()
                .fill(Color.white.opacity(0.9))
                .frame(width: spot.r * 2, height: spot.r * 2)
                .position(x: size.width * spot.x, y: size.height * spot.y)
        }
    }

    private var cloud: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                Capsule().frame(width: w, height: h * 0.6).offset(y: h * 0.2)
                Circle().frame(width: h * 0.8).offset(x: -w * 0.15, y: -h * 0.02)
                Circle().frame(width: h).offset(x: w * 0.12, y: -h * 0.1)
            }
            .frame(width: w, height: h)
            .foregroundStyle(Color.white.opacity(0.92))
        }
    }

    private static let treeSpots: [(x: CGFloat, height: CGFloat)] = [
        (0.04, 0.34), (0.09, 0.26), (0.27, 0.3), (0.31, 0.22), (0.62, 0.32), (0.66, 0.24),
        (0.83, 0.36), (0.88, 0.28), (0.95, 0.3),
    ]

    private func trees(size: CGSize) -> some View {
        ForEach(Array(Self.treeSpots.enumerated()), id: \.offset) { _, spot in
            let h = size.height * spot.height
            PineTree(isDay: isDay)
                .frame(width: h * 0.62, height: h)
                .position(x: size.width * spot.x, y: size.height * 0.76 - h / 2)
        }
    }
}

/// 왼쪽에서 오른쪽으로 높이가 바뀌는 둥근 언덕입니다. `crest`는 아래에서 잰 높이 비율입니다.
struct HillShape: Shape {
    let crest: [CGFloat]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let points = crest.enumerated().map { index, height in
            CGPoint(x: rect.minX + rect.width * CGFloat(index) / CGFloat(max(1, crest.count - 1)),
                    y: rect.maxY - rect.height * height)
        }
        guard let first = points.first, let last = points.last else { return path }
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: first)
        for index in 1..<points.count {
            let previous = points[index - 1], point = points[index]
            path.addQuadCurve(to: CGPoint(x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2),
                              control: previous)
        }
        path.addLine(to: last)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

/// 세모 두 개를 쌓은 소나무입니다.
struct PineTree: View {
    let isDay: Bool

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack(alignment: .top) {
                Rectangle()
                    .fill(isDay ? Color(red: 0.5, green: 0.33, blue: 0.2) : Color(red: 0.2, green: 0.15, blue: 0.14))
                    .frame(width: w * 0.16, height: h * 0.25)
                    .offset(y: h * 0.75)
                Triangle().fill(leaf).frame(width: w, height: h * 0.55).offset(y: h * 0.3)
                Triangle().fill(leaf).frame(width: w * 0.78, height: h * 0.5)
            }
            .frame(width: w, height: h, alignment: .top)
        }
    }

    private var leaf: Color {
        isDay ? Color(red: 0.2, green: 0.55, blue: 0.33) : Color(red: 0.08, green: 0.2, blue: 0.2)
    }
}

struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.midX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.closeSubpath()
        }
    }
}

#Preview("낮과 밤") {
    VStack(spacing: 0) {
        SceneBackground(scene: .day)
        SceneBackground(scene: .night)
    }
    .frame(width: 1180, height: 440)
}
