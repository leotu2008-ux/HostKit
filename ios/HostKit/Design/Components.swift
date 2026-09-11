import SwiftUI

extension Font {
    /// Event titles are the one serif moment, as on the website.
    static func event(_ size: CGFloat) -> Font {
        .system(size: size, weight: .semibold, design: .serif)
    }
}

/// A little calendar leaf: month on top, day below.
struct DateTile: View {
    let date: Date?

    var body: some View {
        VStack(spacing: 0) {
            Text(date.map(EventDates.monthAbbreviation) ?? "TBA")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 2)
                .background(.quaternary.opacity(0.6))
            Text(date.map(EventDates.dayNumber) ?? "–")
                .font(.system(size: 17, weight: .semibold))
                .frame(maxHeight: .infinity)
        }
        .frame(width: 44, height: 44)
        .background(.background)
        .clipShape(.rect(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(.quaternary))
        .accessibilityHidden(true)
    }
}

/// Same footprint as DateTile, holding an SF Symbol.
struct IconTile: View {
    let systemName: String

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: 17, weight: .medium))
            .foregroundStyle(.secondary)
            .frame(width: 44, height: 44)
            .background(.background, in: .rect(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(.quaternary))
            .accessibilityHidden(true)
    }
}

struct InfoRow<Tile: View>: View {
    @ViewBuilder let tile: Tile
    let title: String
    var detail: String?

    var body: some View {
        HStack(spacing: 14) {
            tile
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.medium))
                if let detail {
                    Text(detail).font(.subheadline).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }
}

struct StatusPill: View {
    let text: String
    var tint: Color = .secondary

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tint.opacity(0.12), in: .capsule)
    }
}

struct HostAvatar: View {
    let name: String
    var size: CGFloat = 32

    private var initials: String {
        name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }

    var body: some View {
        Text(initials.isEmpty ? "?" : initials)
            .font(.system(size: size * 0.38, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(
                LinearGradient(
                    colors: [.accentColor, Color(hex: "#986000")],
                    startPoint: .topLeading, endPoint: .bottomTrailing),
                in: .circle)
            .accessibilityHidden(true)
    }
}

/// The cover, blown up and blurred behind a screen, the way the website's
/// event page is tinted by its artwork.
struct AmbientBackground: View {
    let seed: String

    var body: some View {
        CoverArt(seed: seed)
            .scaleEffect(1.6)
            .blur(radius: 70)
            .opacity(0.5)
            .mask(LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .center))
            .ignoresSafeArea()
            .allowsHitTesting(false)
    }
}

/// A soft wash of the brand colours behind a tab's header.
struct BrandWash: View {
    var body: some View {
        ZStack {
            RadialGradient(
                colors: [Color.accentColor.opacity(0.18), .clear],
                center: .init(x: 0.15, y: 0), startRadius: 0, endRadius: 320)
            RadialGradient(
                colors: [Color(hex: "#986000").opacity(0.14), .clear],
                center: .init(x: 0.9, y: 0), startRadius: 0, endRadius: 280)
        }
        .frame(height: 360)
        .frame(maxHeight: .infinity, alignment: .top)
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

struct NoticeBanner: View {
    let text: String

    var body: some View {
        Label(text, systemImage: "wifi.exclamationmark")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.quaternary.opacity(0.5), in: .rect(cornerRadius: 12))
    }
}

/// Nights bucketed by calendar day, in the order given.
struct DayGroup: Identifiable {
    let id: String
    let date: Date?
    var events: [HostEvent]

    var label: String { date.map(EventDates.longDay) ?? "Date to be announced" }
    var relative: String? { EventDates.relativeDay(date) }

    static func group(_ events: [HostEvent]) -> [DayGroup] {
        var groups: [DayGroup] = []
        for event in events {
            let key = EventDates.dayKey(event.startsAt)
            if let index = groups.firstIndex(where: { $0.id == key }) {
                groups[index].events.append(event)
            } else {
                groups.append(DayGroup(id: key, date: event.startsAt, events: [event]))
            }
        }
        return groups
    }
}
