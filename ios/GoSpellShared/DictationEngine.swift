import Foundation

/// The speech engine GoSpell dictates with. Display copy lives in `displayName`; every decision
/// switches on the enum instead of comparing display strings.
nonisolated enum DictationEngine: Equatable, Sendable {
    /// Launch hasn't resolved the engine yet.
    case undecided
    /// iOS 26+ `SpeechAnalyzer` (`SpeechTranscriber` or `DictationTranscriber`).
    case appleSpeech
    /// Pre-iOS 26 on-device `SFSpeechRecognizer` (model managed by iOS, never downloaded by GoSpell).
    case onDeviceRecognizer
    /// FluidAudio Parakeet V2 (English).
    case parakeetV2
    /// FluidAudio Parakeet Ultra (multilingual).
    case parakeetUltra

    var displayName: String {
        switch self {
        case .undecided: "Local speech"
        case .appleSpeech, .onDeviceRecognizer: "Apple Speech"
        case .parakeetV2: "Parakeet V2"
        case .parakeetUltra: "Parakeet Ultra"
        }
    }

    var isAppleSpeech: Bool {
        self == .appleSpeech || self == .onDeviceRecognizer
    }

    /// Whether getting this engine ready downloads a model in GoSpell (not `SFSpeechRecognizer`,
    /// whose model iOS keeps).
    var downloads: Bool {
        self != .onDeviceRecognizer
    }

    /// Whether the keyboard's own speech preparation simply follows GoSpell's app engine:
    /// Parakeet Ultra hands dictations to GoSpell, and Apple Speech shares the same on-device
    /// model unless the keyboard is currently handing off to GoSpell (`keyboardNeedsGoSpell`).
    func keyboardSpeechFollowsApp(keyboardNeedsGoSpell: Bool) -> Bool {
        switch self {
        case .parakeetUltra:
            true
        case .appleSpeech, .onDeviceRecognizer:
            !keyboardNeedsGoSpell
        case .undecided, .parakeetV2:
            false
        }
    }
}
