import Foundation
import FoundationModels

/// Listing copy the on-device model writes for a new event.
@Generable(description: "Copy for an in-person event listing")
nonisolated struct EventCopy {
    @Guide(description: "A one-line hook for the event, under 12 words, no emoji")
    var tagline: String

    @Guide(description: "Two short paragraphs for guests: the atmosphere and what happens, then practical notes. Under 110 words. Plain text, no markdown, no emoji.")
    var description: String
}

/// A short promo post for a story or group chat.
@Generable(description: "A short, punchy post inviting people to an event")
nonisolated struct PromoCopy {
    @Guide(description: "Three to five short lines: a hook, when and where, and a nudge to register. Plain text, no hashtags, no emoji, no link.")
    var text: String
}

/// Drafts an event description with Apple's on-device Foundation Model.
/// Nothing leaves the phone, and the feature hides itself on devices without
/// Apple Intelligence.
enum DescriptionWriter {
    /// Nil when the model is ready; otherwise why the button isn't offered.
    static var unavailableReason: String? {
        switch SystemLanguageModel.default.availability {
        case .available:
            return nil
        case .unavailable(.deviceNotEligible):
            return "This device doesn’t support Apple Intelligence."
        case .unavailable(.appleIntelligenceNotEnabled):
            return "Turn on Apple Intelligence in Settings to draft descriptions."
        case .unavailable(.modelNotReady):
            return "Apple Intelligence is still getting ready. Try again soon."
        case .unavailable:
            return "Apple Intelligence isn’t available right now."
        }
    }

    /// A promo post for an existing event, with the registration link added
    /// at the end (the model never writes the link itself).
    static func promo(event: HostEvent, link: String) async throws -> String {
        let session = LanguageModelSession(instructions: """
            You write short social posts inviting people to in-person events. Warm, specific, no hype.
            Only use the details given. Never invent facts. No hashtags, no emoji, no links.
            """)
        let when = event.startsAt.map { "\(EventDates.longDay($0)) at \(EventDates.time($0))" } ?? "date not set yet"
        let prompt = """
            Write a post for this event.
            Name: \(event.title)
            Kind: \(event.typeLabel)
            When: \(when)
            Where: \(event.place)
            Tickets: \(event.ticketLabel)
            Description: \(event.description ?? "none")
            """
        let response = try await session.respond(to: prompt, generating: PromoCopy.self,
                                                 options: GenerationOptions(temperature: 0.8))
        return response.content.text.trimmingCharacters(in: .whitespacesAndNewlines) + "\n\nRegister: \(link)"
    }

    static func draft(
        title: String,
        kind: EventKind,
        city: String,
        place: String?,
        start: Date?,
        capacity: Int,
        notes: String
    ) async throws -> EventCopy {
        let session = LanguageModelSession(instructions: """
            You write event listings for HostKit, an app for hosting and discovering in-person events.
            Write warm, specific, inviting copy in plain language that makes someone want to come.
            Only use the details you are given. Never invent prices, performers, sponsors, menus, or other facts.
            """)

        let when = start.map { "\(EventDates.longDay($0)) at \(EventDates.time($0))" } ?? "date not set yet"
        let prompt = """
            Write a listing for this event.
            Name: \(title)
            Kind: \(kind.label)
            City: \(city)
            Place: \(place?.isEmpty == false ? place! : "not given")
            When: \(when)
            Capacity: \(capacity) guests
            Host's notes: \(notes.isEmpty ? "none" : notes)
            """

        let response = try await session.respond(
            to: prompt,
            generating: EventCopy.self,
            options: GenerationOptions(temperature: 0.7))
        return response.content
    }
}
