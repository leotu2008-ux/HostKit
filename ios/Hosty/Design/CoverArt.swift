import SwiftUI

/// The host's photo when they've added one, over the generated cover
/// (which also shows while the photo loads). The art sets the size and the
/// photo fills it: as an overlay it can't grow the layout, so a big photo
/// never spills past its tile.
struct EventCover: View {
    let event: HostEvent

    var body: some View {
        CoverArt(seed: event.id)
            .overlay {
                if let url = event.coverURL {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Color.clear
                    }
                }
            }
            .clipped()
    }
}

/// The photo at its own shape, for the event page: a wide poster stays
/// wide, a tall one tall, with nothing cropped away. The box is sized from
/// the picture's real dimensions (kept between 4:5 and 2:1 so a very tall
/// or very wide one doesn't take over the screen; past that the photo is
/// fitted over a blurred copy of itself rather than cut). The generated
/// cover shows while it loads, or if it can't.
struct CoverPhoto: View {
    let url: URL
    let seed: String
    @State private var image: UIImage?
    @State private var failed = false

    private static let narrowest = 4.0 / 5.0
    private static let widest = 2.0

    var body: some View {
        Group {
            if let image {
                let ratio = image.size.width / max(image.size.height, 1)
                let box = min(max(ratio, Self.narrowest), Self.widest)
                Color.clear
                    .aspectRatio(box, contentMode: .fit)
                    .overlay {
                        if box != ratio {
                            Image(uiImage: image).resizable().scaledToFill()
                                .blur(radius: 24)
                                .opacity(0.8)
                        }
                    }
                    .overlay {
                        Image(uiImage: image).resizable().scaledToFit()
                    }
                    .clipped()
            } else {
                CoverArt(seed: seed)
                    .aspectRatio(failed ? 1 : 16 / 10, contentMode: .fit)
            }
        }
        .task(id: url) {
            failed = false
            image = await Self.load(url)
            failed = image == nil
        }
    }

    private static func load(_ url: URL) async -> UIImage? {
        guard let (data, _) = try? await URLSession.shared.data(from: url) else { return nil }
        return UIImage(data: data)
    }
}

/// Event cover artwork, generated from the event id exactly like
/// `components/cover-art.tsx`, so a night has the same cover on the website
/// and on the phone.
struct CoverArt: View {
    let seed: String

    var body: some View {
        let colors = CoverPalette.colors(for: seed)
        let angle = Double(CoverPalette.angle(for: seed)) * .pi / 180

        Canvas { context, size in
            let rect = CGRect(origin: .zero, size: size)
            context.fill(
                Path(rect),
                with: .linearGradient(
                    Gradient(colors: [colors.from, colors.to]),
                    startPoint: .zero,
                    endPoint: CGPoint(x: cos(angle) * size.width, y: sin(angle) * size.height)))
            context.fill(
                Path(rect),
                with: .radialGradient(
                    Gradient(colors: [.white.opacity(0.34), .white.opacity(0)]),
                    center: CGPoint(x: size.width * 0.3, y: size.height * 0.2),
                    startRadius: 0,
                    endRadius: max(size.width, size.height) * 0.7))

            // The web SVG is 400×225, drawn with "slice" (aspect fill).
            let scale = max(size.width / 400, size.height / 225)
            let offsetX = (size.width - 400 * scale) / 2
            let offsetY = (size.height - 225 * scale) / 2
            func circle(_ cx: Double, _ cy: Double, _ r: Double) -> Path {
                Path(ellipseIn: CGRect(
                    x: offsetX + (cx - r) * scale, y: offsetY + (cy - r) * scale,
                    width: 2 * r * scale, height: 2 * r * scale))
            }
            context.fill(circle(320, 48, 56), with: .color(.white.opacity(0.12)))
            context.fill(circle(40, 180, 70), with: .color(.black.opacity(0.08)))
        }
        .accessibilityHidden(true)
    }
}

nonisolated enum CoverPalette {
    private static let palettes: [(String, String)] = [
        ("#c4502e", "#e8a87c"),
        ("#2a4a40", "#7ba394"),
        ("#9a6b10", "#e3c07b"),
        ("#6b4a7a", "#c4a3d4"),
        ("#1f4b63", "#83b4c9"),
        ("#8e3a4a", "#d99aa6"),
        ("#4a5a2a", "#adc17f"),
        ("#a0522d", "#e0b08a"),
    ]

    /// FNV-1a over UTF-16 code units with 32-bit wraparound, matching the
    /// JavaScript `hash` (charCodeAt + Math.imul + Math.abs).
    static func hash(_ input: String) -> Int {
        guard !input.isEmpty else { return 2_166_136_261 }
        var h = UInt32(2_166_136_261)
        for unit in input.utf16 {
            h ^= UInt32(unit)
            h = h &* 16_777_619
        }
        return abs(Int(Int32(bitPattern: h)))
    }

    static func colors(for seed: String) -> (from: Color, to: Color) {
        let pair = palettes[hash(seed) % palettes.count]
        return (Color(hex: pair.0), Color(hex: pair.1))
    }

    /// Gradient direction in degrees, as `rotate(angle + 45)` on the web.
    static func angle(for seed: String) -> Int {
        (hash(seed + "cover") % 60) - 30 + 45
    }
}

extension Color {
    nonisolated init(hex: String) {
        let value = UInt64(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0
        self.init(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255)
    }
}
