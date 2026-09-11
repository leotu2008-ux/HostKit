import SwiftUI

/// Everyone the host needs to reach — venue, speakers, vendors, cohosts —
/// each with a first message drafted and one-tap call / email.
struct OutreachTab: View {
    @Environment(AppModel.self) private var model
    let event: HostEvent

    @State private var rows: [OutreachRow] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var drafting: OutreachRow?
    @State private var isAdding = false

    private static let order = ["VENUE", "SPEAKER", "VENDOR", "COHOST"]
    private static let titles = ["VENUE": "Venue", "SPEAKER": "Speakers", "VENDOR": "Vendors", "COHOST": "Cohosts"]

    var body: some View {
        List {
            if isLoading && rows.isEmpty {
                ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear)
            } else if rows.isEmpty {
                ContentUnavailableView(
                    "Nobody lined up yet",
                    systemImage: "person.2.badge.plus",
                    description: Text("Add the venue, speakers or cohosts and HostKit drafts the first message for each."))
                    .listRowBackground(Color.clear)
            }
            ForEach(Self.order, id: \.self) { kind in
                let group = rows.filter { $0.kind == kind }
                if !group.isEmpty {
                    Section(Self.titles[kind] ?? kind) {
                        ForEach(group) { row in
                            rowView(row)
                        }
                    }
                }
            }
            if let errorMessage {
                Section { Text(errorMessage).foregroundStyle(.red) }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .safeAreaInset(edge: .bottom) {
            Button {
                isAdding = true
            } label: {
                Label("Add someone", systemImage: "plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .padding()
        }
        .sheet(item: $drafting) { row in
            DraftMessageSheet(row: row)
        }
        .sheet(isPresented: $isAdding) {
            AddCollaboratorSheet(eventID: event.id) { updated in rows = updated }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func rowView(_ row: OutreachRow) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.name).font(.inter(.body, .medium))
                    if let detail = row.detail {
                        Text(detail).font(.inter(.footnote)).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                StatusPill(text: row.statusLabel, tint: row.isConfirmed ? .green : row.status == "DECLINED" ? .red : .secondary)
            }
            HStack(spacing: 10) {
                Button("Message", systemImage: "text.bubble") { drafting = row }
                if let phone = row.phone, let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                    Link(destination: url) { Label("Call", systemImage: "phone") }
                }
                if let website = row.website, let url = URL(string: website) {
                    Link(destination: url) { Label("Site", systemImage: "safari") }
                }
            }
            .font(.inter(.footnote, .medium))
            .buttonStyle(.borderless)
            .labelStyle(.titleAndIcon)
        }
        .padding(.vertical, 2)
        .swipeActions(edge: .trailing) {
            if row.isCollaborator {
                Button("Remove", role: .destructive) { Task { await remove(row) } }
                if row.isConfirmed {
                    Button("Pending") { Task { await setStatus(row, "PENDING") } }.tint(.orange)
                } else {
                    Button("Confirm") { Task { await setStatus(row, "CONFIRMED") } }.tint(.green)
                }
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            rows = try await model.api.outreach(eventID: event.id)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setStatus(_ row: OutreachRow, _ status: String) async {
        do {
            rows = try await model.api.setCollaboratorStatus(eventID: event.id, rowID: row.id, status: status)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func remove(_ row: OutreachRow) async {
        do {
            rows = try await model.api.removeCollaborator(eventID: event.id, rowID: row.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// The drafted first message, editable, with copy and send-by-email.
private struct DraftMessageSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    let row: OutreachRow
    @State private var message: String
    @State private var copied = false

    init(row: OutreachRow) {
        self.row = row
        _message = State(initialValue: row.message)
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 10) {
                Text("Subject: \(row.subject)")
                    .font(.inter(.footnote))
                    .foregroundStyle(.secondary)
                TextEditor(text: $message)
                    .font(.system(.footnote, design: .monospaced))
                    .padding(8)
                    .background(.background, in: .rect(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(.quaternary))
                HStack(spacing: 10) {
                    Button(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc") {
                        UIPasteboard.general.string = message
                        copied = true
                    }
                    .buttonStyle(.glass)
                    Button("Email", systemImage: "envelope") {
                        var parts = URLComponents(string: "mailto:\(row.email ?? "")")
                        parts?.queryItems = [
                            URLQueryItem(name: "subject", value: row.subject),
                            URLQueryItem(name: "body", value: message),
                        ]
                        if let url = parts?.url { openURL(url) }
                    }
                    .buttonStyle(.glassProminent)
                }
                .controlSize(.large)
            }
            .padding()
            .navigationTitle(row.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}

private struct AddCollaboratorSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let eventID: String
    let onSaved: ([OutreachRow]) -> Void

    @State private var kind = "SPEAKER"
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var website = ""
    @State private var detail = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Picker("Who", selection: $kind) {
                    Text("Venue").tag("VENUE")
                    Text("Speaker").tag("SPEAKER")
                    Text("Cohost").tag("COHOST")
                }
                .pickerStyle(.segmented)
                Section {
                    TextField("Name", text: $name)
                    TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                    TextField("Phone", text: $phone).keyboardType(.phonePad)
                    TextField("Website", text: $website).keyboardType(.URL).textInputAutocapitalization(.never)
                    TextField(kind == "VENUE" ? "Address or note" : kind == "SPEAKER" ? "Talk title or role" : "How they're helping", text: $detail)
                } footer: {
                    Text("Only the name is required. HostKit drafts the first message from what you fill in.")
                }
                if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
            }
            .navigationTitle("Add someone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", role: .cancel) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            let rows = try await model.api.addCollaborator(
                eventID: eventID,
                NewCollaborator(
                    kind: kind,
                    name: name.trimmingCharacters(in: .whitespaces),
                    email: email.isEmpty ? nil : email,
                    phone: phone.isEmpty ? nil : phone,
                    website: website.isEmpty ? nil : website,
                    detail: detail.isEmpty ? nil : detail))
            onSaved(rows)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
