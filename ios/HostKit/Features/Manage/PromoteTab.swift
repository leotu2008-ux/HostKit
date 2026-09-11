import CoreImage.CIFilterBuiltins
import SwiftUI

/// Get the word out: publish and choose who can find it, share the link,
/// a QR code for posters and the door, and paste-ready copy.
struct PromoteTab: View {
    @Environment(AppModel.self) private var model
    @Binding var event: HostEvent
    let onChange: (HostEvent) -> Void
    let requestSignIn: () -> Void

    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var blurb = ""
    @State private var isWriting = false
    @State private var copiedLink = false
    @State private var copiedBlurb = false

    private var link: URL { model.api.webURL(for: event) }

    var body: some View {
        List {
            Section {
                Toggle("Published", isOn: Binding(
                    get: { event.published },
                    set: { value in Task { await setPublished(value) } }))
                    .disabled(isSaving)
                Picker("Who can find it", selection: Binding(
                    get: { event.visibility },
                    set: { value in Task { await setVisibility(value) } })) {
                    ForEach(EventVisibility.allCases) { Text($0.label).tag($0) }
                }
                .disabled(isSaving)
            } header: {
                Text("Status")
            } footer: {
                Text(event.published
                    ? "Live. \(event.visibility.hint)\(event.school.map { " Shown first to \($0.short) students." } ?? "")"
                    : "A draft — guests can't see it or register until you publish.")
            }

            Section {
                HStack {
                    Text(link.absoluteString).font(.inter(.footnote)).foregroundStyle(.secondary).lineLimit(1).truncationMode(.middle)
                    Spacer()
                    Button(copiedLink ? "Copied" : "Copy") {
                        UIPasteboard.general.string = link.absoluteString
                        copiedLink = true
                    }
                    .font(.inter(.footnote, .semibold))
                }
                ShareLink(item: link, subject: Text(event.title)) {
                    Label("Share the link", systemImage: "square.and.arrow.up")
                }
                if let qr = Self.qrImage(for: link.absoluteString) {
                    Image(uiImage: qr)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 220)
                        .padding(12)
                        .background(.white, in: .rect(cornerRadius: 12))
                        .frame(maxWidth: .infinity)
                        .listRowBackground(Color.clear)
                    ShareLink(item: Image(uiImage: qr), preview: SharePreview("QR code for \(event.title)", image: Image(uiImage: qr))) {
                        Label("Save or share the QR code", systemImage: "qrcode")
                    }
                }
            } header: {
                Text("Share")
            } footer: {
                Text("The QR code scans straight to the event page — put it on a poster or at the door.")
            }

            Section {
                TextField("Paste-ready copy", text: $blurb, axis: .vertical)
                    .lineLimit(4...10)
                HStack {
                    Button(copiedBlurb ? "Copied" : "Copy text", systemImage: copiedBlurb ? "checkmark" : "doc.on.doc") {
                        UIPasteboard.general.string = blurb
                        copiedBlurb = true
                    }
                    Spacer()
                    if DescriptionWriter.unavailableReason == nil {
                        Button {
                            Task { await writeBlurb() }
                        } label: {
                            if isWriting { ProgressView() } else { Label("Rewrite with Apple Intelligence", systemImage: "apple.intelligence") }
                        }
                        .disabled(isWriting)
                    }
                }
                .font(.inter(.footnote, .medium))
                .buttonStyle(.borderless)
            } header: {
                Text("For a story or group chat")
            }

            if let errorMessage {
                Section { Text(errorMessage).foregroundStyle(.red) }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .onAppear { if blurb.isEmpty { blurb = Self.defaultBlurb(for: event, link: link) } }
    }

    private func setPublished(_ value: Bool) async {
        guard model.isSignedIn else {
            requestSignIn()
            return
        }
        isSaving = true
        defer { isSaving = false }
        do {
            event = try await model.setPublished(event, value)
            onChange(event)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setVisibility(_ value: EventVisibility) async {
        guard model.isSignedIn else {
            requestSignIn()
            return
        }
        isSaving = true
        defer { isSaving = false }
        do {
            event = try await model.api.setPublished(eventID: event.id, published: event.published, visibility: value)
            onChange(event)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func writeBlurb() async {
        isWriting = true
        defer { isWriting = false }
        do {
            blurb = try await DescriptionWriter.promo(event: event, link: link.absoluteString)
            copiedBlurb = false
        } catch {
            errorMessage = "Couldn't write that: \(error.localizedDescription)"
        }
    }

    /// Same shape as `promoBlurb` in lib/promote.ts.
    static func defaultBlurb(for event: HostEvent, link: URL) -> String {
        let when = event.startsAt.map { "\(EventDates.shortDay($0)) · \(EventDates.time($0))" } ?? "Date to be announced"
        var lines = [event.title, "\(when) · \(event.place)"]
        if let first = event.description?.split(separator: "\n").first {
            lines += ["", String(first)]
        }
        lines += ["", "\(event.ticketType == .free ? "Free" : "Tickets") · register: \(link.absoluteString)"]
        return lines.joined(separator: "\n")
    }

    static func qrImage(for text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        guard let cg = CIContext().createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
