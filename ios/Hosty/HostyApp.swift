import SwiftUI

@main
struct HostyApp: App {
    @UIApplicationDelegateAdaptor(PushRegistration.self) private var pushRegistration
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
