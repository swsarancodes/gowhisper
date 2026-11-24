import SafariServices
import UIKit

/// GoSpell's web pages for the iPhone app, under one base so they can move to
/// `https://gospell.goml.io` once the site's production deploy serves them (it 404s until then).
enum GoSpellLinks {
    static let site = URL(string: "https://dev.gospell.goml.io")!
    static let privacyPolicy = site.appending(path: "privacy")
    static let support = site.appending(path: "iphone")
}

/// Opens a web page in Safari inside GoSpell (`SFSafariViewController`), over whatever is showing.
@MainActor
enum SafariSheet {
    static func present(_ url: URL) {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        guard var top = scene?.keyWindow?.rootViewController else { return }
        while let presented = top.presentedViewController, !presented.isBeingDismissed {
            top = presented
        }
        let controller = SFSafariViewController(url: url)
        controller.overrideUserInterfaceStyle = .dark
        top.present(controller, animated: true)
    }
}
