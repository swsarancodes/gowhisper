import SwiftUI
import WidgetKit

@main
struct GoSpellWidgetsBundle: WidgetBundle {
    var body: some Widget {
        GoSpellDictationLiveActivity()
        if #available(iOS 18.0, *) {
            GoSpellDictationControl()
        }
    }
}
