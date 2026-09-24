import SwiftUI

/// Everything that happened to you, newest first. Opening it marks the
/// notices read; tapping one opens the event (or the club).
struct InboxView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss

    @State private var feed = InboxFeed(items: [], unread: 0)
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
                if isLoading && feed.items.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear)
                } else if feed.items.isEmpty {
                    ContentUnavailableView(
                        "Nothing yet",
                        systemImage: "bell",
                        description: Text("When a club you follow posts, a host confirms your spot, or a spot opens up, it lands here."))
                        .listRowBackground(Color.clear)
                }
                ForEach(DayBucket.group(feed.items)) { bucket in
                    Section(bucket.label) {
                        ForEach(bucket.items) { notice in
                            Button { open(notice) } label: { row(notice) }
                                .buttonStyle(.plain)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Inbox")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func row(_ notice: Notice) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: notice.symbol)
                .font(.inter(size: 16, .semibold))
                .foregroundStyle(notice.isUnread ? Color.brand : .secondary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(notice.title).font(.inter(.body, notice.isUnread ? .semibold : .medium))
                Text(notice.body).font(.inter(.footnote)).foregroundStyle(.secondary).lineLimit(2)
                Text(notice.createdAt.formatted(.relative(presentation: .named)))
                    .font(.inter(.caption)).foregroundStyle(.tertiary)
            }
            Spacer(minLength: 0)
            if notice.eventId != nil || notice.clubId != nil {
                Image(systemName: "chevron.right").font(.inter(.caption)).foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            feed = try await model.api.inbox()
            errorMessage = nil
            // Seen is read.
            if feed.unread > 0 {
                model.unreadCount = try await model.api.markRead()
            } else {
                model.unreadCount = 0
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func open(_ notice: Notice) {
        if let eventId = notice.eventId {
            dismiss()
            router.openGuestEvent(eventId)
        }
    }
}

/// Notices bucketed by day, newest first.
private struct DayBucket: Identifiable {
    let id: String
    let label: String
    var items: [Notice]

    static func group(_ items: [Notice]) -> [DayBucket] {
        var out: [DayBucket] = []
        let calendar = Calendar.current
        for notice in items {
            let key = calendar.startOfDay(for: notice.createdAt).formatted(.iso8601)
            if let index = out.firstIndex(where: { $0.id == key }) {
                out[index].items.append(notice)
            } else {
                let label = calendar.isDateInToday(notice.createdAt)
                    ? "Today"
                    : calendar.isDateInYesterday(notice.createdAt)
                        ? "Yesterday"
                        : notice.createdAt.formatted(.dateTime.weekday(.wide).month().day())
                out.append(DayBucket(id: key, label: label, items: [notice]))
            }
        }
        return out
    }
}
