import SwiftUI

struct RootView: View {
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router

        TabView(selection: $router.tab) {
            Tab("Home", systemImage: "house", value: Router.Tab.home) {
                HomeView()
            }
            Tab("Discover", systemImage: "sparkles", value: Router.Tab.discover) {
                DiscoverView()
            }
            Tab("Events", systemImage: "calendar", value: Router.Tab.events) {
                MyEventsView()
            }
            Tab("Profile", systemImage: "person.crop.circle", value: Router.Tab.profile) {
                AccountMenu(inTab: true)
            }
        }
        // Creating an event is a sheet over any tab (the + buttons and
        // "Create an event" call router.startCreate()); a new event then
        // opens on the Events tab.
        .sheet(isPresented: $router.isCreating) {
            CreateEventView(onCreated: { created in router.openHostEvent(created.id) })
        }
        // Once per launch, over everything, like the website's splash.
        .overlay { LaunchSplash() }
    }
}

#Preview {
    RootView()
        .environment(AppModel())
        .environment(Router.shared)
}
