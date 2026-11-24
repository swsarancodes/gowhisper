import AppIntents
import Foundation

/// Action Button, Back Tap, Siri, and Shortcuts entry point.
/// Conforms to `AudioRecordingIntent` + `LiveActivityIntent` so iOS permits
/// starting or stopping background microphone dictation with a Live Activity.
nonisolated struct DictateWithGoSpellIntent: AudioRecordingIntent, LiveActivityIntent {
    static let title: LocalizedStringResource = "Dictate with GoSpell"
    static let description = IntentDescription(
        "Press once to record, again to transcribe on device and copy the text."
    )

    init() {}

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let output = await GoSpellSystemCommandBus.shared.dispatch(.toggleDictation) ?? ""
        return .result(value: output)
    }
}

nonisolated struct WarmGoSpellKeyboardIntent: AppIntent {
    static let title: LocalizedStringResource = "Warm GoSpell Keyboard"
    static let description = IntentDescription(
        "Lets the keyboard dictate without opening GoSpell."
    )
    @available(iOS 26.0, *)
    static let supportedModes: IntentModes = .foreground

    init() {}

    func perform() async throws -> some IntentResult {
        await GoSpellSystemCommandBus.shared.dispatch(.warmSession)
        return .result()
    }
}

nonisolated struct GoSpellShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: DictateWithGoSpellIntent(),
            phrases: [
                "Dictate with \(.applicationName)",
                "Start \(.applicationName) dictation",
            ],
            shortTitle: "Dictate",
            systemImageName: "mic.fill"
        )
        AppShortcut(
            intent: WarmGoSpellKeyboardIntent(),
            phrases: [
                "Warm \(.applicationName) keyboard",
                "Start \(.applicationName) session",
            ],
            shortTitle: "Warm keyboard",
            systemImageName: "keyboard"
        )
    }
}
