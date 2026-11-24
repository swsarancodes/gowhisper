import ActivityKit
import AppIntents
import Foundation

nonisolated struct GoSpellDictationActivityAttributes: ActivityAttributes {
    nonisolated enum Stage: String, Codable, Hashable, Sendable {
        case recording
        case transcribing
        case copied
    }

    nonisolated struct ContentState: Codable, Hashable, Sendable {
        var stage: Stage
        var startedAt: Date
        var subtitle: String
    }

    var sessionID: String
}

nonisolated enum GoSpellSystemCommand: String, Codable, Sendable {
    case toggleDictation
    case stopDictation
    case cancelDictation
    case warmSession
}

/// Bridges Live Activity and Control Center intents back into the main app's controller.
actor GoSpellSystemCommandBus {
    static let shared = GoSpellSystemCommandBus()

    private var handler: (@MainActor @Sendable (GoSpellSystemCommand) async -> String?)?

    func register(_ handler: @escaping @MainActor @Sendable (GoSpellSystemCommand) async -> String?) {
        self.handler = handler
    }

    @discardableResult
    func dispatch(_ command: GoSpellSystemCommand) async -> String? {
        guard let handler else { return nil }
        return await handler(command)
    }
}

nonisolated struct StopGoSpellDictationIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Finish dictation"
    static let description = IntentDescription("Stops recording, transcribes on device and copies the text.")
    static let isDiscoverable = false

    init() {}

    func perform() async throws -> some IntentResult {
        await GoSpellSystemCommandBus.shared.dispatch(.stopDictation)
        return .result()
    }
}

nonisolated struct CancelGoSpellDictationIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Cancel dictation"
    static let description = IntentDescription("Discards the recording.")
    static let isDiscoverable = false

    init() {}

    func perform() async throws -> some IntentResult {
        await GoSpellSystemCommandBus.shared.dispatch(.cancelDictation)
        return .result()
    }
}
