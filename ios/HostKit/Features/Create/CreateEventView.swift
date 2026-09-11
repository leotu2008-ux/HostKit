import SwiftUI

struct CreateEventView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var onCreated: ((HostEvent) -> Void)?

    @State private var title = ""
    /// The planner template behind every night. There's no picker any more;
    /// the dinner-party plan is a sensible split for a typical night out.
    private let kind: EventKind = .dinnerParty
    @State private var start = Calendar.current.date(
        bySettingHour: 19, minute: 0, second: 0,
        of: .now.addingTimeInterval(7 * 86_400)) ?? .now
    @State private var hours = 4
    @State private var city = Cities.all[0]
    @State private var address = ""
    @State private var venue: VenuePick?
    @State private var isPickingVenue = false
    @State private var details = ""
    @State private var capacity = 40
    @State private var ticketType: TicketType = .free
    @State private var price = ""
    @State private var visibility: EventVisibility = .unlisted
    @State private var budget = ""
    @State private var publishNow = false

    @State private var isSaving = false
    @State private var isDrafting = false
    @State private var errorMessage: String?

    private var coverSeed: String {
        let cleaned = title.filter { $0.isLetter || $0.isNumber }
        return cleaned.isEmpty ? "new-night" : cleaned
    }

    // No account needed to build a night; publishing is the step that asks.
    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving
            && (ticketType == .free || cents(price) ?? 0 > 0)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(alignment: .center, spacing: 16) {
                        CoverArt(seed: coverSeed)
                            .frame(width: 88, height: 88)
                            .clipShape(.rect(cornerRadius: 18))
                        TextField("Event name", text: $title, axis: .vertical)
                            .font(.event(26))
                            .lineLimit(1...3)
                    }
                    .padding(.vertical, 6)
                }

                Section("When") {
                    DatePicker("Starts", selection: $start)
                    Stepper("Lasts \(hours) hour\(hours == 1 ? "" : "s")", value: $hours, in: 1...24)
                }

                Section {
                    Picker("City", selection: $city) {
                        ForEach(Cities.all, id: \.self) { Text($0).tag($0) }
                    }
                    if let venue {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "mappin.circle.fill").foregroundStyle(.tint)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(venue.name).font(.inter(.body, .medium))
                                if let address = venue.address {
                                    Text(address).font(.inter(.footnote)).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Button("Change") { isPickingVenue = true }
                                .font(.inter(.footnote, .semibold))
                        }
                        Button("Remove venue", role: .destructive) {
                            self.venue = nil
                            if address == venue.address { address = "" }
                        }
                    } else {
                        Button {
                            isPickingVenue = true
                        } label: {
                            Label("Find a venue near \(Cities.short(city))", systemImage: "magnifyingglass")
                        }
                        TextField("Or type the address", text: $address)
                            .textContentType(.fullStreetAddress)
                    }
                } header: {
                    Text("Where")
                } footer: {
                    Text(venue == nil
                        ? "Optional. Picking a venue adds it to your outreach list so you can contact them about booking."
                        : "The venue is on your outreach list — reach them from the event dashboard.")
                }

                Section {
                    TextField("What should guests expect?", text: $details, axis: .vertical)
                        .lineLimit(4...10)
                    if let reason = DescriptionWriter.unavailableReason {
                        Label(reason, systemImage: "apple.intelligence")
                            .font(.inter(.footnote))
                            .foregroundStyle(.secondary)
                    } else {
                        Button {
                            Task { await draftDescription() }
                        } label: {
                            if isDrafting {
                                HStack {
                                    ProgressView()
                                    Text("Writing…")
                                }
                            } else {
                                Label(
                                    details.isEmpty ? "Write with Apple Intelligence" : "Rewrite with Apple Intelligence",
                                    systemImage: "apple.intelligence")
                            }
                        }
                        .disabled(isDrafting || title.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                } header: {
                    Text("Description")
                } footer: {
                    Text("Drafted on this iPhone — your notes never leave the device. Add a few words above and it’ll use them.")
                }

                Section {
                    HStack {
                        Text("Capacity")
                        Spacer()
                        TextField("0", value: $capacity, format: .number)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 72)
                            .onChange(of: capacity) { _, value in
                                capacity = min(max(value, 1), 100_000)
                            }
                        Stepper("Capacity", value: $capacity, in: 1...100_000)
                            .labelsHidden()
                    }
                    Picker("Tickets", selection: $ticketType) {
                        Text("Free").tag(TicketType.free)
                        Text("Paid").tag(TicketType.paid)
                    }
                    .pickerStyle(.segmented)
                    if ticketType == .paid {
                        TextField("Price (USD)", text: $price)
                            .keyboardType(.decimalPad)
                    }
                    Picker("Visibility", selection: $visibility) {
                        ForEach(EventVisibility.allCases) { Text($0.label).tag($0) }
                    }
                    TextField("Planning budget (optional)", text: $budget)
                        .keyboardType(.decimalPad)
                    if model.isSignedIn {
                        Toggle("Publish now", isOn: $publishNow)
                    }
                } header: {
                    Text("Options")
                } footer: {
                    Text(model.isSignedIn
                        ? "\(visibility.hint) The planning budget splits venue and vendor spend on the website’s planner."
                        : "\(visibility.hint) This saves as a draft on this iPhone — you’ll sign in when you publish it.")
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
            .sheet(isPresented: $isPickingVenue) {
                VenuePickerSheet(city: city) { picked in
                    venue = picked
                    if address.isEmpty, let full = picked.address { address = full }
                }
            }
            .navigationTitle("Create event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(model.isSignedIn ? "Create" : "Save draft") { Task { await save() } }
                        .disabled(!canSave)
                }
            }
        }
    }

    private func cents(_ raw: String) -> Int? {
        let cleaned = raw.replacingOccurrences(of: ",", with: "").replacingOccurrences(of: "$", with: "")
        guard let value = Decimal(string: cleaned.trimmingCharacters(in: .whitespaces)), value >= 0 else {
            return nil
        }
        return NSDecimalNumber(decimal: value * 100).intValue
    }

    private func draftDescription() async {
        isDrafting = true
        errorMessage = nil
        defer { isDrafting = false }
        do {
            let copy = try await DescriptionWriter.draft(
                title: title, kind: kind, city: city, place: address,
                start: EventDates.toWallClock(start), capacity: capacity, notes: details)
            details = "\(copy.tagline)\n\n\(copy.description)"
        } catch {
            errorMessage = "Couldn’t draft a description: \(error.localizedDescription)"
        }
    }

    private func save() async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        let request = NewEventRequest(
            title: title.trimmingCharacters(in: .whitespaces),
            type: kind,
            startsAt: EventDates.toWallClock(start),
            durationHours: hours,
            capacity: capacity,
            city: city,
            address: address.isEmpty ? nil : address,
            description: details.isEmpty ? nil : details,
            ticketType: ticketType,
            ticketPriceCents: ticketType == .paid ? cents(price) : nil,
            visibility: visibility,
            budgetCents: budget.isEmpty ? nil : cents(budget),
            publish: publishNow,
            venue: venue)
        do {
            let created = try await model.createEvent(request)
            onCreated?(created)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    CreateEventView()
        .environment(AppModel())
}
