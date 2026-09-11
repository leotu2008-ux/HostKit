import SwiftUI

struct RootView: View {
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router

        TabView(selection: $router.tab) {
            Tab("Discover", systemImage: "sparkles", value: Router.Tab.discover) {
                DiscoverView()
            }
            Tab("Events", systemImage: "calendar", value: Router.Tab.events) {
                MyEventsView()
            }
            Tab("Create", systemImage: "plus.circle", value: Router.Tab.create) {
                CreateTab()
            }
        }
    }
}

/// The Create tab keeps a form alive between visits; creating an event opens
/// it on the Events tab and hands the tab a fresh form.
private struct CreateTab: View {
    @Environment(Router.self) private var router
    @State private var generation = 0

    var body: some View {
        CreateEventView(inTab: true, onCancel: { generation += 1 }) { created in
            generation += 1
            router.openHostEvent(created.id)
        }
        .id(generation)
    }
}

#Preview {
    RootView()
        .environment(AppModel())
        .environment(Router.shared)
}
