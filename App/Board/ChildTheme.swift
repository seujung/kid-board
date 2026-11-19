import SwiftUI

/// 보드 전체에서 쓰는 기본 색입니다.
enum BoardPalette {
    static let background = Color(red: 1.0, green: 0.97, blue: 0.91)
    static let ink = Color(red: 0.2, green: 0.16, blue: 0.14)
}

/// 자녀 테마 색 이름을 화면 색으로 바꿉니다. 테마 색 이름은 이곳에서만 해석합니다.
struct ChildTheme: Hashable {
    let accent: Color
    let soft: Color
    let panel: Color

    static func named(_ name: String) -> ChildTheme {
        switch name {
        case "coral": ChildTheme(accent: rgb(0xE8_5A_4F), soft: rgb(0xFF_E3_DC), panel: rgb(0xFF_EF_EA))
        case "sky": ChildTheme(accent: rgb(0x2F_86_D1), soft: rgb(0xDB_EE_FC), panel: rgb(0xEA_F5_FD))
        case "mint": ChildTheme(accent: rgb(0x1F_9E_7A), soft: rgb(0xD8_F4_EA), panel: rgb(0xE9_F9_F3))
        case "lavender": ChildTheme(accent: rgb(0x80_5C_D6), soft: rgb(0xE9_E1_FB), panel: rgb(0xF3_EF_FD))
        default: ChildTheme(accent: rgb(0xE0_9A_10), soft: rgb(0xFF_F0_C8), panel: rgb(0xFF_F7_E0))
        }
    }

    private static func rgb(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255,
              blue: Double(hex & 0xFF) / 255)
    }
}
