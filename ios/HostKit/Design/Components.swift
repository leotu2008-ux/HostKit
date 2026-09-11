import SwiftUI

extension Font {
    /// Event titles: Inter, a touch heavier than body text (`.font-event` on the website).
    static func event(_ size: CGFloat) -> Font {
        .inter(size: size, .semibold)
    }
}

/// The HostKit mark in a navigation bar's leading slot. Tapping it opens the
/// account menu: profile, past events, settings, sign out.
struct LogoMark: View {
    @State private var isOpen = false

    var body: some View {
        Button {
            isOpen = true
        } label: {
            Image("Logo")
                .resizable()
                .frame(width: 28, height: 28)
                .clipShape(.rect(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(.quaternary))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Account menu")
        .sheet(isPresented: $isOpen) {
            AccountMenu()
        }
    }
}

/// A little calendar leaf: month on top, day below.
struct DateTile: View {
    let date: Date?

    var body: some View {
        VStack(spacing: 0) {
            Text(date.map(EventDates.monthAbbreviation) ?? "TBA")
                .font(.inter(size: 9, .bold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 2)
                .background(.quaternary.opacity(0.6))
            Text(date.map(EventDates.dayNumber) ?? "–")
                .font(.inter(size: 17, .semibold))
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
            .font(.inter(size: 17, .medium))
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
                Text(title).font(.inter(.body, .medium))
                if let detail {
                    Text(detail).font(.inter(.subheadline)).foregroundStyle(.secondary)
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
            .font(.inter(.caption, .medium))
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tint.opacity(0.12), in: .capsule)
    }
}

/// A person: their photo when they've added one, otherwise initials on the
/// brand gradient (also shown while the photo loads).
struct HostAvatar: View {
    let name: String
    var imageURL: URL? = nil
    var size: CGFloat = 32

    private var initials: String {
        name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }

    var body: some View {
        ZStack {
            Text(initials.isEmpty ? "?" : initials)
                .font(.inter(size: size * 0.38, .semibold))
                .foregroundStyle(.white)
                .frame(width: size, height: size)
                .background(
                    LinearGradient(
                        colors: [.accentColor, Color(hex: "#986000")],
                        startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: .circle)
            if let imageURL {
                AsyncImage(url: imageURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.clear
                }
                .frame(width: size, height: size)
                .clipShape(.circle)
            }
        }
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
            .font(.inter(.footnote))
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
