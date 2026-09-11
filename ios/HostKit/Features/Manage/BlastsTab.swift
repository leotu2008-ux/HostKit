import SwiftUI

/// Email the guest list. With email configured on the server it sends;
/// otherwise HostKit records it and hands over the recipients to paste.
struct BlastsTab: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    let event: HostEvent

    @State private var feed = BlastsFeed(canSend: false, segments: [], blasts: [])
    @State private var segment = "going"
    @State private var subject: String
    @State private var message = "Hi {name},\n\n"
    @State private var isSending = false
    @State private var result: BlastsFeed?
    @State private var errorMessage: String?
    @State private var copied = false
    @State private var alsoText = false

    init(event: HostEvent) {
        self.event = event
        _subject = State(initialValue: "\(event.title): an update")
    }

    private var count: Int { feed.segments.first { $0.key == segment }?.count ?? 0 }
    private var phoneCount: Int { feed.segments.first { $0.key == segment }?.phoneCount ?? 0 }

    var body: some View {
        List {
            if let result, let recipients = result.recipients {
                Section {
                    if result.provider == "resend" {
                        Label("Sent to \(recipients.count)", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
                    }
                    if let texted = result.smsCount, texted > 0 {
                        Label("Texted \(texted)", systemImage: "message.fill").foregroundStyle(.green)
                    }
                    if result.provider != "resend" {
                        Label("Recorded for \(recipients.count) — email isn't set up on this server", systemImage: "info.circle")
                            .font(.inter(.subheadline))
                        Button(copied ? "Copied addresses" : "Copy \(recipients.count) addresses", systemImage: "doc.on.doc") {
                            UIPasteboard.general.string = recipients.map(\.email).joined(separator: ", ")
                            copied = true
                        }
                        Button("Open in Mail", systemImage: "envelope") {
                            var parts = URLComponents(string: "mailto:")
                            parts?.queryItems = [
                                URLQueryItem(name: "bcc", value: recipients.map(\.email).joined(separator: ",")),
                                URLQueryItem(name: "subject", value: subject),
                                URLQueryItem(name: "body", value: message),
                            ]
                            if let url = parts?.url { openURL(url) }
                        }
                    }
                    Button("New update") { self.result = nil; copied = false; message = "Hi {name},\n\n" }
                }
            } else {
                Section {
                    Picker("To", selection: $segment) {
                        ForEach(feed.segments) { Text("\($0.label) · \($0.count)").tag($0.key) }
                    }
                    TextField("Subject", text: $subject)
                    TextField("Message", text: $message, axis: .vertical)
                        .lineLimit(5...12)
                    if feed.canText ?? false {
                        Toggle("Also text \(phoneCount) with a verified phone", isOn: $alsoText)
                            .disabled(phoneCount == 0)
                    }
                } header: {
                    Text("Send an update")
                } footer: {
                    Text(feed.canSend
                        ? "Goes to the email each guest registered with. {name} becomes their first name. Reply-to is you."
                        : "Email sending isn't set up on this server — you'll get the addresses to paste instead.")
                }
                Section {
                    Button {
                        Task { await send() }
                    } label: {
                        HStack {
                            Text(feed.canSend ? "Send to \(count)" : "Record for \(count)")
                            if isSending { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(isSending || count == 0 || subject.isEmpty || message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }

            if let errorMessage {
                Section { Text(errorMessage).foregroundStyle(.red) }
            }

            Section("Sent") {
                if feed.blasts.isEmpty {
                    Text("Nothing sent yet.").foregroundStyle(.secondary)
                }
                ForEach(feed.blasts) { blast in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(blast.subject).font(.inter(.body, .medium))
                            Spacer()
                            StatusPill(text: blast.provider == "resend" ? "Sent" : "Copied", tint: blast.provider == "resend" ? .green : .secondary)
                        }
                        Text([
                            feed.segments.first { $0.key == blast.segment }?.label ?? blast.segment,
                            "\(blast.recipientCount) emailed",
                            (blast.smsCount ?? 0) > 0 ? "\(blast.smsCount!) texted" : nil,
                            blast.sentAt.formatted(date: .abbreviated, time: .shortened),
                        ].compactMap { $0 }.joined(separator: " · "))
                            .font(.inter(.caption)).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            feed = try await model.api.blasts(eventID: event.id)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func send() async {
        isSending = true
        defer { isSending = false }
        do {
            let outcome = try await model.api.sendBlast(
                eventID: event.id, segment: segment, subject: subject, body: message, sms: alsoText)
            feed = outcome
            result = outcome
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
