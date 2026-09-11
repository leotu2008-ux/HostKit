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
            Tab("You", systemImage: "person.crop.circle", value: Router.Tab.profile) {
                ProfileView()
            }
        }
    }
}

#Preview {
    RootView()
        .environment(AppModel())
        .environment(Router.shared)
}
