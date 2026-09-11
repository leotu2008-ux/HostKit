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
