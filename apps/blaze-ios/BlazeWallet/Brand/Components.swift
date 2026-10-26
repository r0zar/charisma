import SwiftUI

// The wallet's look: flat screens on `bg`, hairline rows instead of cards, numbers in DM Mono, one crimson action per
// screen, and Blaze in the logo's flame. Every screen builds from these.

/// An uppercase mono label above a figure or a group (the brand's `label` style)
struct Eyebrow: View {
    let text: LocalizedStringKey

    init(_ text: LocalizedStringKey) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .textCase(.uppercase)
            .monoFont(.caption)
            .tracking(1.4)
            .foregroundStyle(.brand("ink-muted"))
    }
}

/// A 1-point line between rows; `strong` at a group's edges
struct Hairline: View {
    var strong = false

    var body: some View {
        Rectangle().fill(Color.brand(strong ? "line" : "line-soft")).frame(height: 1)
    }
}

extension View {
    /// A list row: the screen's side margins, a little air above and below, and a hairline under it
    func ledgerRow(vertical: CGFloat = 11) -> some View {
        padding(.horizontal, 20)
            .padding(.vertical, vertical)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .bottom) { Hairline() }
    }

    /// The tab bar on the ground colour, flat, under every tab
    func ledgerTabBar() -> some View {
        toolbarBackground(Color.brand("bg"), for: .tabBar)
            .toolbarBackground(.visible, for: .tabBar)
    }
}

/// A 40-point icon button with its name for VoiceOver (Settings and Lock in the screens' headers)
struct IconButton: View {
    let systemImage: String
    let label: LocalizedStringKey
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.brand("ink-body"))
                .frame(width: 40, height: 40)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(label))
    }
}

/// Text tabs on a hairline, a crimson underline under the chosen one
struct UnderlineTabs<Value: Hashable>: View {
    let options: [(value: Value, title: LocalizedStringKey)]
    @Binding var selection: Value

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 24) {
                ForEach(options.indices, id: \.self) { index in
                    let option = options[index]
                    let chosen = option.value == selection
                    Button {
                        selection = option.value
                    } label: {
                        Text(option.title)
                            .brandFont(.subheadline, weight: chosen ? .bold : .semibold)
                            .foregroundStyle(.brand(chosen ? "ink" : "ink-muted"))
                            .padding(.top, 14)
                            .padding(.bottom, 11)
                            .overlay(alignment: .bottom) {
                                Rectangle().fill(chosen ? Color.brand("accent-text") : .clear).frame(height: 2)
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(chosen ? .isSelected : [])
                }
                Spacer()
            }
            .padding(.horizontal, 20)
            Hairline()
        }
    }
}

/// The home's row of actions: icon over label, flat, divided by hairlines
struct ActionStrip<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            Hairline(strong: true)
            HStack(spacing: 0) { content }.frame(height: 62)
            Hairline(strong: true)
        }
    }
}

/// One action of an `ActionStrip`; `divider` draws the hairline after it
struct StripButton: View {
    let title: LocalizedStringKey
    let systemImage: String
    var tint = AnyShapeStyle(Color.brand("ink"))
    var divider = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 5) {
                Image(systemName: systemImage).font(.system(size: 18, weight: .semibold))
                Text(title).brandFont(.footnote, weight: .semibold)
            }
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(alignment: .trailing) {
            if divider { Rectangle().fill(Color.brand("line-soft")).frame(width: 1) }
        }
    }
}

/// The screen's one crimson action: full width, white label, the brand's bloom
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .brandFont(.headline, weight: .heavy)
            .foregroundStyle(.brand("on-accent"))
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(Color.brand(configuration.isPressed ? "accent-hover" : "accent"), in: RoundedRectangle(cornerRadius: 14))
            .shadow(color: Color.brand("accent").opacity(isEnabled ? 0.35 : 0), radius: 16, y: 8)
            .opacity(isEnabled ? 1 : 0.45)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

/// A quiet action beside the crimson one: a hairline outline, ink label
struct SecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .brandFont(.subheadline, weight: .bold)
            .foregroundStyle(.brand("ink"))
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(Color.brand(configuration.isPressed ? "surface-hover" : "surface"), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.brand("line"), lineWidth: 1))
            .opacity(isEnabled ? 1 : 0.45)
    }
}

/// A label on the left and its value on the right, on a hairline: reviews, Status and Settings
struct DetailRow<Value: View>: View {
    let label: LocalizedStringKey
    @ViewBuilder let value: Value

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            Text(label).brandFont(.subheadline).foregroundStyle(.brand("ink-muted"))
            Spacer(minLength: 8)
            value.multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) { Hairline() }
    }
}

/// A group's heading on a Ledger page: its eyebrow with room above
struct SectionHeading: View {
    let title: LocalizedStringKey

    init(_ title: LocalizedStringKey) {
        self.title = title
    }

    var body: some View {
        Eyebrow(title)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 26)
            .padding(.bottom, 4)
    }
}

/// The Blaze flame on a token's logo: a white flame on the logo's gradient, ringed in the ground colour
struct BlazeBadge: View {
    var size: CGFloat = 16

    var body: some View {
        Image(systemName: "flame.fill")
            .font(.system(size: size * 0.55, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Theme.blaze, in: Circle())
            .overlay(Circle().stroke(Color.brand("bg"), lineWidth: 2))
            .accessibilityHidden(true)
    }
}

/// Standard or Blaze for one side of a trade, as a two-part capsule. Blaze, when chosen, takes the flame's colours.
struct NetworkCapsule: View {
    @Binding var blaze: Bool

    var body: some View {
        HStack(spacing: 0) {
            option(false) { Text("Standard") }
            option(true) {
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill").font(.system(size: 12, weight: .bold))
                    Text("Blaze")
                }
            }
        }
        .padding(3)
        .frame(width: 210, height: 40)
        .background(Color.brand("surface-sunken"), in: Capsule())
        .overlay(Capsule().stroke(Color.brand("line"), lineWidth: 1))
    }

    private func option<Label: View>(_ value: Bool, @ViewBuilder label: () -> Label) -> some View {
        let chosen = blaze == value
        return Button {
            blaze = value
        } label: {
            label()
                .brandFont(.subheadline, weight: .bold)
                .foregroundStyle(chosen ? (value ? AnyShapeStyle(Theme.blazeText) : AnyShapeStyle(Color.brand("ink"))) : AnyShapeStyle(Color.brand("ink-muted")))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background {
                    if chosen {
                        Capsule()
                            .fill(Color.brand(value ? "surface-raised" : "surface-selected"))
                            .overlay { if value { Capsule().strokeBorder(Theme.blaze, lineWidth: 1.5) } }
                    }
                }
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }
}

/// The Trade screen's number pad: digits, the locale's decimal mark and delete, so no keyboard covers the trade
struct Keypad: View {
    enum Key: Hashable {
        case digit(Int), decimal, delete
    }

    let decimalMark: String
    let press: (Key) -> Void

    private let rows: [[Key]] = [
        [.digit(1), .digit(2), .digit(3)],
        [.digit(4), .digit(5), .digit(6)],
        [.digit(7), .digit(8), .digit(9)],
        [.decimal, .digit(0), .delete],
    ]

    var body: some View {
        Grid(horizontalSpacing: 4, verticalSpacing: 2) {
            ForEach(rows.indices, id: \.self) { row in
                GridRow {
                    ForEach(rows[row], id: \.self) { key in
                        Button {
                            press(key)
                        } label: {
                            label(for: key)
                                .foregroundStyle(.brand("ink"))
                                .frame(maxWidth: .infinity, minHeight: 52)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(KeyStyle())
                    }
                }
            }
        }
    }

    @ViewBuilder private func label(for key: Key) -> some View {
        switch key {
        case .digit(let digit):
            Text(verbatim: "\(digit)").monoFont(size: 26, relativeTo: .title)
        case .decimal:
            Text(verbatim: decimalMark).monoFont(size: 26, relativeTo: .title)
        case .delete:
            Image(systemName: "delete.left")
                .font(.system(size: 22, weight: .medium))
                .accessibilityLabel(Text("Delete"))
        }
    }

    private struct KeyStyle: ButtonStyle {
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .background(configuration.isPressed ? Color.brand("surface-hover") : .clear, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
