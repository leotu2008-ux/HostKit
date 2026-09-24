import SwiftUI

/// What you host and what you're going to, soonest first — a horizontal
/// strip of tiles. Signed out it's the nudge to create or sign in.
struct YourEventsSection: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router

    let events: [HostEvent]
    let isLoading: Bool
    let onSignIn: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Your events").font(.inter(.title3, .semibold))
                Spacer()
                if model.isSignedIn {
                    Button("See all") { router.tab = .events }
                        .font(.inter(.subheadline, .medium))
                }
            }
            if !model.isSignedIn {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Create your first event").font(.inter(.headline, .semibold))
                    Text("Name, time, place — no account needed until you publish. Sign in to see the events you host and the ones you’re going to.")
                        .font(.inter(.footnote))
                        .foregroundStyle(.secondary)
                    HStack(spacing: 8) {
                        Button("Create event") { router.startCreate() }
                            .buttonStyle(.prominent)
                        Button("Sign in", action: onSignIn)
                            .buttonStyle(.glass)
                    }
                    .padding(.top, 4)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.background, in: .rect(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(.quaternary))
            } else if events.isEmpty {
                HStack(spacing: 12) {
                    Text(isLoading ? "Loading…" : "Nothing coming up. Create an event and it shows up here — so does anything you register for.")
                        .font(.inter(.subheadline))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button("Create") { router.startCreate() }
                        .font(.inter(.footnote, .semibold))
                        .buttonStyle(.glass)
                }
                .padding(14)
                .background(.quaternary.opacity(0.4), in: .rect(cornerRadius: 14))
            } else {
                ScrollView(.horizontal) {
                    HStack(alignment: .top, spacing: 12) {
                        ForEach(events) { event in
                            if event.isOwner {
                                Button { router.openHostEvent(event.id) } label: { EventTile(event: event) }
                                    .buttonStyle(.plain)
                            } else {
                                NavigationLink(value: event) { EventTile(event: event) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.horizontal)
                }
                .scrollIndicators(.hidden)
                .padding(.horizontal, -16)
            }
        }
    }
}
