import AppIntents
import SwiftUI
import WidgetKit

@available(iOS 18.0, *)
struct GoSpellDictationControl: ControlWidget {
    static let kind = "com.goml.gospell.mobile.control.dictate"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: ToggleGoSpellControlIntent()) {
                Label("Dictate", systemImage: "mic.fill")
                Text("GoSpell")
            }
        }
        .displayName("Dictate with GoSpell")
        .description("Starts or finishes on-device dictation and copies the text.")
    }
}
