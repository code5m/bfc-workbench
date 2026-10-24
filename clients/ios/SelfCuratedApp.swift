import SwiftUI
import WebKit

@main
struct SelfCuratedApp: App {
    var body: some Scene { WindowGroup { WorkbenchView() } }
}

struct WorkbenchView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView { WKWebView() }
    func updateUIView(_ view: WKWebView, context: Context) {
        view.load(URLRequest(url: URL(string: "https://YOUR-HTTPS-DOMAIN.example.com/#topics")!))
    }
}
