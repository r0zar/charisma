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

extension Theme {
    /// Blaze, the instant subnet, in the Blaze Wallet logo's flame: orange at the top to crimson at the bottom. For
    /// fills, icons and marks; Blaze words use `blazeText`.
    static var blaze: LinearGradient {
        LinearGradient(colors: [rgb(0xff7a45), rgb(0xec3d03), rgb(0xc1121f)], startPoint: .top, endPoint: .bottom)
    }

    /// Blaze as words: the flame's orange into the brand's accent text, both readable on the ground in either theme
    /// (dark ≥5.8:1, light ≥4.9:1)
    static var blazeText: LinearGradient {
        LinearGradient(
            colors: [adaptive(dark: 0xff7a45, light: 0xc2410c), adaptive(dark: 0xff4d6d, light: 0xb8410f)],
            startPoint: .leading, endPoint: .trailing
        )
    }

    private static func rgb(_ hex: UInt32) -> Color {
        Color(red: Double(hex >> 16 & 0xff) / 255, green: Double(hex >> 8 & 0xff) / 255, blue: Double(hex & 0xff) / 255)
    }

    private static func adaptive(dark: UInt32, light: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(rgb(dark)) : UIColor(rgb(light)) })
    }
}

extension View {
    /// Words: Ysabeau Infant in Dark · RPG, Matter in Light · Bitcoin
    func brandFont(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> some View {
        modifier(BrandFont(style: style, size: nil, weight: weight, mono: false))
    }

    /// Words at an exact size, scaling with the person's text size as `style` does
    func brandFont(size: CGFloat, weight: Font.Weight = .regular, relativeTo style: Font.TextStyle) -> some View {
        modifier(BrandFont(style: style, size: size, weight: weight, mono: false))
    }

    /// Numbers, addresses and seed words: DM Mono in both themes
    func monoFont(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> some View {
        modifier(BrandFont(style: style, size: nil, weight: weight, mono: true))
    }

    /// DM Mono at an exact size (the big balance and the trade amount), scaling as `style` does
    func monoFont(size: CGFloat, weight: Font.Weight = .regular, relativeTo style: Font.TextStyle) -> some View {
        modifier(BrandFont(style: style, size: size, weight: weight, mono: true))
    }
}

private struct BrandFont: ViewModifier {
    let style: Font.TextStyle
    let size: CGFloat?
    let weight: Font.Weight
    let mono: Bool
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        let points = size ?? Self.size(style)
        if mono {
            content.font(.custom(weight == .regular ? "DMMono-Regular" : "DMMono-Medium", size: points, relativeTo: style))
        } else if scheme == .dark {
            content.font(.custom("Ysabeau Infant", size: points, relativeTo: style).weight(weight))
        } else {
            // Matter has two files and no synthesized weights (tokens.json): any other weight is the brand's 500 file,
            // which is Matter SQ, as on the web
            content.font(.custom(weight == .regular ? "Matter-Regular" : "MatterSQ-Regular", size: points, relativeTo: style))
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
