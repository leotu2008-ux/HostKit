import SwiftUI
import UIKit

/// Inter everywhere, the same face as the website. The four static weights
/// are bundled (Resources/Fonts) and listed in Info.plist.
extension Font {
    /// Inter at a text style's size, still scaling with Dynamic Type.
    static func inter(_ style: Font.TextStyle, _ weight: Font.Weight = .regular) -> Font {
        .custom(Inter.face(weight), size: Inter.size(of: style), relativeTo: style)
    }

    /// Inter at a fixed size.
    static func inter(size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom(Inter.face(weight), size: size)
    }
}

enum Inter {
    static func face(_ weight: Font.Weight) -> String {
        switch weight {
        case .bold, .heavy, .black: "Inter-Bold"
        case .semibold: "Inter-SemiBold"
        case .medium: "Inter-Medium"
        default: "Inter-Regular"
        }
    }

    static func uiFont(_ weight: Font.Weight, size: CGFloat) -> UIFont {
        UIFont(name: face(weight), size: size) ?? .systemFont(ofSize: size)
    }

    static func size(of style: Font.TextStyle) -> CGFloat {
        UIFont.preferredFont(forTextStyle: uiStyle(style)).pointSize
    }

    private static func uiStyle(_ style: Font.TextStyle) -> UIFont.TextStyle {
        switch style {
        case .largeTitle: .largeTitle
        case .title: .title1
        case .title2: .title2
        case .title3: .title3
        case .headline: .headline
        case .subheadline: .subheadline
        case .footnote: .footnote
        case .caption: .caption1
        case .caption2: .caption2
        case .callout: .callout
        default: .body
        }
    }

    /// UIKit-drawn chrome (navigation titles, tab labels, segmented controls)
    /// doesn't read SwiftUI's font environment, so it's set once at launch.
    static func applyAppearance() {
        let nav = UINavigationBar.appearance()
        nav.titleTextAttributes = [.font: uiFont(.semibold, size: 17)]
        nav.largeTitleTextAttributes = [.font: uiFont(.bold, size: 34)]
        UITabBarItem.appearance().setTitleTextAttributes([.font: uiFont(.medium, size: 10)], for: .normal)
        UISegmentedControl.appearance().setTitleTextAttributes([.font: uiFont(.medium, size: 13)], for: .normal)
        UISegmentedControl.appearance().setTitleTextAttributes([.font: uiFont(.semibold, size: 13)], for: .selected)
    }
}
