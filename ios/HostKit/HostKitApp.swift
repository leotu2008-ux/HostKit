import SwiftUI

@main
struct HostKitApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(Router.shared)
                .tint(.accentColor)
        }
    }
}
