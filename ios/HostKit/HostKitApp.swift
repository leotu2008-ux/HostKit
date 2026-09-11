import SwiftUI

@main
struct HostKitApp: App {
    @State private var model = AppModel()

    init() {
        Inter.applyAppearance()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(Router.shared)
                .font(.inter(.body))
                .tint(.accentColor)
        }
    }
}
