import Foundation

/// Whether the keyboard dictates by itself, in its own process with GoSpell closed (iOS 26,
/// `KeyboardLocalDictation`), so GoSpell needn't keep the mic warm for it: there Keep mic warm
/// defaults to Off and its row hides (`KeyboardBridge.warmDuration`). Not before iOS 26, and
/// not while the keyboard hands its dictations to GoSpell: it couldn't get its speech model
/// (`LanguageSettings.keyboardNeedsGoSpell`), Experiments › Multilingual model takes the language
/// and only GoSpell loads it, or the keyboard opened GoSpell for a dictation in the last
/// `recentWindow` (recorded by the keyboard, and by GoSpell whatever the reason), until the
/// keyboard next finishes a dictation by itself.
nonisolated struct KeyboardSelfDictation {
    enum Reason: String {
        case memory
        case speechModel
        case multilingual
        /// GoSpell saw the keyboard open it for a dictation, whatever the keyboard's reason.
        case openedGoSpell
    }

    static let handedToGoSpellKey = "keyboard.handedDictationToGoSpell"
    static let handedToGoSpellAtKey = "keyboard.handedDictationToGoSpellAt"
    /// How long one dictation the keyboard handed to GoSpell keeps the warm mic's default, unless
    /// the keyboard dictates by itself sooner: a week, as memory runs short with how the iPhone
    /// is used (older 4 GB models, many apps open), which comes back from one day to the next.
    static let recentWindow: TimeInterval = 7 * 24 * 60 * 60
    static let firstVersion = 26

    private let defaults: UserDefaults?

    init(defaults: UserDefaults? = UserDefaults(suiteName: KeyboardBridge.appGroup)) {
        self.defaults = defaults
    }

    /// Written by the keyboard as Dictate opens GoSpell because it can't dictate by itself.
    func recordHandedToGoSpell(_ reason: Reason, at now: Date = Date()) {
        defaults?.set(reason.rawValue, forKey: Self.handedToGoSpellKey)
        defaults?.set(now.timeIntervalSince1970, forKey: Self.handedToGoSpellAtKey)
    }

    /// Written by GoSpell as the keyboard opens it for a dictation, for any reason (one the keyboard
    /// didn't record, such as a dictation it couldn't start), keeping the keyboard's reason.
    func recordOpenedGoSpell(at now: Date = Date()) {
        recordHandedToGoSpell(handedToGoSpell?.reason ?? .openedGoSpell, at: now)
    }

    /// The keyboard finished a dictation by itself again.
    func clearHandedToGoSpell() {
        guard defaults?.object(forKey: Self.handedToGoSpellKey) != nil else { return }
        defaults?.removeObject(forKey: Self.handedToGoSpellKey)
        defaults?.removeObject(forKey: Self.handedToGoSpellAtKey)
    }

    var handedToGoSpell: (reason: Reason, at: Date)? {
        guard let raw = defaults?.string(forKey: Self.handedToGoSpellKey), let reason = Reason(rawValue: raw),
              let at = defaults?.object(forKey: Self.handedToGoSpellAtKey) as? Double else { return nil }
        return (reason, Date(timeIntervalSince1970: at))
    }

    /// Why the keyboard hands dictation to GoSpell instead of dictating in its own process, or nil
    /// when the keyboard dictates by itself.
    func handoffReason(
        osMajorVersion: Int = ProcessInfo.processInfo.operatingSystemVersion.majorVersion,
        now: Date = Date(),
        hasMultilingualModelInKeyboard: Bool? = nil,
        hasMemoryToStart: Bool = true,
        includeRecentHandoff: Bool = true
    ) -> Reason? {
        guard osMajorVersion >= Self.firstVersion else { return .openedGoSpell }
        if includeRecentHandoff,
           let handed = handedToGoSpell,
           now.timeIntervalSince(handed.at) < Self.recentWindow {
            return handed.reason
        }
        let languages = LanguageSettings(defaults: defaults)
        // Speech model in keyboard (on unless turned off) dictates the multilingual model's
        // language in the keyboard only once the keyboard has that model loaded; until then
        // Dictate opens GoSpell for it.
        let multilingual = MultilingualParakeetSettings(defaults: defaults)
        let language = multilingual.language(
            set: languages.dictationLanguage,
            keyboard: languages.keyboardDictationLanguage()
        )
        let keyboardHasMultilingual = hasMultilingualModelInKeyboard
            ?? KeyboardParakeetSettings(defaults: defaults).keyboardHasMultilingualModel
        if multilingual.keyboardOpensGoSpell(language: language) && !keyboardHasMultilingual {
            return .multilingual
        }
        if languages.keyboardNeedsGoSpell(now: now) {
            return .speechModel
        }
        if !hasMemoryToStart {
            return .memory
        }
        return nil
    }

    func dictatesItself(
        osMajorVersion: Int = ProcessInfo.processInfo.operatingSystemVersion.majorVersion,
        now: Date = Date()
    ) -> Bool {
        handoffReason(osMajorVersion: osMajorVersion, now: now) == nil
    }
}
