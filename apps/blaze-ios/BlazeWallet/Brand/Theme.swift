import SwiftUI

/// Blaze Wallet on the Charisma brand (@repo/brand): Dark · RPG by night, Light · Bitcoin by day, following the phone
/// until the person picks one. Colours are the brand tokens in Brand.xcassets, named as in tokens.json.
enum Theme {
    static let storageKey = "blaze-theme"

    enum Choice: String, CaseIterable, Identifiable {
        case system, light, dark

        var id: Self { self }

        var colorScheme: ColorScheme? {
            switch self {
            case .system: nil
            case .light: .light
            case .dark: .dark
            }
        }
    }
}

extension View {
    /// Words: Ysabeau Infant in Dark · RPG, the system font in Light · Bitcoin (Matter waits on its licence)
    func brandFont(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> some View {
        modifier(BrandFont(style: style, weight: weight, mono: false))
    }

    /// Numbers, addresses and seed words: DM Mono in both themes
    func monoFont(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> some View {
        modifier(BrandFont(style: style, weight: weight, mono: true))
    }
}

private struct BrandFont: ViewModifier {
    let style: Font.TextStyle
    let weight: Font.Weight
    let mono: Bool
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        if mono {
            content.font(.custom(weight == .regular ? "DMMono-Regular" : "DMMono-Medium", size: Self.size(style), relativeTo: style))
        } else if scheme == .dark {
            content.font(.custom("Ysabeau Infant", size: Self.size(style), relativeTo: style).weight(weight))
        } else {
            content.font(.system(style, weight: weight))
        }
    }

    /// iOS's default sizes at the standard Dynamic Type setting; `relativeTo` scales them with the person's setting
    private static func size(_ style: Font.TextStyle) -> CGFloat {
        switch style {
        case .largeTitle: 34
        case .title: 28
        case .title2: 22
        case .title3: 20
        case .headline, .body: 17
        case .callout: 16
        case .subheadline: 15
        case .footnote: 13
        case .caption: 12
        case .caption2: 11
        default: 17
        }
    }
}

extension ShapeStyle where Self == Color {
    /// A brand colour token from Brand.xcassets, such as `.brand("ink-muted")`
    static func brand(_ token: String) -> Color { Color(token) }
}
