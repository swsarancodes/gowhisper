import UIKit

/// Recording in and out: the GoSpell key hands its spot to the recording panel, and the words and
/// the dots trade places behind one soft edge. Moved out of FullKeyboardView.swift unchanged.
@MainActor
extension FullKeyboardView {
    /// Recording in and out with no shape between: the GoSpell key hands its spot to ✓ (the key
    /// leaving as ✓ arrives, on the same frame), ✕ slides out from under ✓, and the dots come
    /// out of the key behind a soft edge that runs across the bar, wiping the words as it goes.
    /// Going back, the edge runs home into the key, the words return behind it, ✕ tucks under
    /// ✓ and the key takes its spot back. Reduce Motion crossfades instead.
    func setRecording(_ recording: Bool) {
        showsRecording = recording
        dismissStyleMenu()
        if recording { closeEmojiPanel(); hideModelNotice() }
        let animated = window != nil
        let travels = animated && !StripMotion.reduced && engine.layout.key(.gospell).map { $0.row < 0 } == true
        stripView.holdsStill = recording || recordingPanel != nil
        if recording {
            plane.cancelAllTouches()
            hideUndo()
            let panel = recordingPanel ?? makeRecordingPanel()
            panel.palette = palette
            panel.frame = recordingPanelFrame
            refreshRecordingPanel()
            panel.isHidden = false
            panel.layoutIfNeeded()
            guard travels else {
                endReveal(panel)
                panel.setControls(shown: true)
                fade(in: [panel], out: [stripView, gospellKey], duration: animated ? StripMotion.reducedFade : 0)
                return
            }
            panel.alpha = 1
            let fresh = beginReveal(panel)
            if fresh {
                UIView.performWithoutAnimation { panel.setControls(shown: false) }
            }
            StripMotion.animate(StripMotion.grow, fresh: fresh, {
                self.placeReveal(open: true, panel: panel)
            }, completion: { [weak self] _ in
                // Masked away, the words would still take touches.
                guard let self, self.showsRecording else { return }
                self.stripView.isHidden = true
            })
            StripMotion.animate(StripMotion.settle, fresh: fresh) { panel.setControls(shown: true) }
            StripMotion.animate(StripMotion.settleExit, {
                self.gospellKey.alpha = 0
                self.gospellKey.transform = self.gospellKeyTucked
            }, completion: { [weak self] _ in
                // A GoSpell key still held for push to talk stays in the window (at alpha 0), so its
                // touch keeps arriving and lifting the finger finishes the dictation.
                guard let self, self.showsRecording, !self.gospellKey.isTracking else { return }
                self.gospellKey.isHidden = true
            })
        } else if let panel = recordingPanel {
            let finish = { [weak self, weak panel] in
                guard let self, !self.showsRecording, let panel, panel === self.recordingPanel else { return }
                self.stripView.holdsStill = false
                self.endReveal(panel)
                panel.tearDown()
                panel.removeFromSuperview()
                self.recordingPanel = nil
            }
            guard travels else {
                endReveal(panel)
                fade(in: [stripView, gospellKey], out: [panel], duration: animated ? StripMotion.reducedFade : 0, after: finish)
                return
            }
            stripView.isHidden = false
            stripView.alpha = 1
            let fresh = beginReveal(panel)
            if fresh {
                UIView.performWithoutAnimation { placeReveal(open: true, panel: panel) }
            }
            if gospellKey.isHidden || gospellKey.alpha == 0 {
                gospellKey.isHidden = false
                gospellKey.transform = gospellKeyTucked
            }
            StripMotion.animate(StripMotion.shrink, fresh: fresh, {
                self.placeReveal(open: false, panel: panel)
            }, completion: { _ in finish() })
            StripMotion.animate(StripMotion.settleExit) { panel.setControls(shown: false) }
            StripMotion.animate(StripMotion.settle) {
                self.gospellKey.alpha = 1
                self.gospellKey.transform = .identity
            }
        }
    }

    /// The GoSpell key a little smaller about its keycap's centre, as it leaves and returns.
    private var gospellKeyTucked: CGAffineTransform {
        let s = StripMotion.controlScale
        let cap = gospellKey.keycapFrame
        let dx = cap.midX - gospellKey.bounds.midX
        let dy = cap.midY - gospellKey.bounds.midY
        return CGAffineTransform(translationX: dx, y: dy).scaledBy(x: s, y: s).translatedBy(x: -dx, y: -dy)
    }

    /// Masks the words and the dots on the two sides of one soft edge. True when they were
    /// unmasked, so the edge starts at home in the GoSpell key; false mid-flight, where it carries on.
    private func beginReveal(_ panel: GoSpellKeyRecordingPanel) -> Bool {
        let dotsAfter = !engine.layout.gospellOnLeading
        if let wordsMask, wordsMask.opaqueAfter == !dotsAfter, panel.dotsMask?.opaqueAfter == dotsAfter {
            return false
        }
        let words = StripRevealMask(opaqueAfter: !dotsAfter)
        let dots = StripRevealMask(opaqueAfter: dotsAfter)
        stripView.mask = words
        wordsMask = words
        panel.dotsMask = dots
        UIView.performWithoutAnimation { placeReveal(open: false, panel: panel) }
        return true
    }

    private func endReveal(_ panel: GoSpellKeyRecordingPanel) {
        stripView.mask = nil
        wordsMask = nil
        panel.dotsMask = nil
    }

    /// Where the edge's band starts (it is `StripRevealMask.feather` wide): home, at the GoSpell key's
    /// side of the bar with every dot gathered in and every word shown, or across the bar.
    private func placeReveal(open: Bool, panel: GoSpellKeyRecordingPanel) {
        let well = panel.convert(panel.wellFrame, to: self)
        let words = stripView.frame
        let feather = StripRevealMask.feather
        let band: CGFloat = if engine.layout.gospellOnLeading {
            open ? max(well.maxX, words.maxX) : min(well.minX, words.minX) - feather
        } else {
            open ? min(well.minX, words.minX) - feather : max(well.maxX, words.maxX)
        }
        wordsMask?.place(bandStart: band - words.minX)
        panel.dotsMask?.place(bandStart: band - well.minX)
    }

    /// Where the recording panel sits: the suggestion strip, full width and its height, so
    /// neither the keyboard nor the keys move.
    var recordingPanelFrame: CGRect {
        let m = engine.layout.metrics
        return CGRect(x: 0, y: m.stripTop + appliedLift, width: bounds.width, height: m.stripHeight)
    }

    private func fade(
        in shown: [UIView],
        out hidden: [UIView],
        duration requested: TimeInterval = 0.2,
        delay: TimeInterval = 0,
        after: (() -> Void)? = nil
    ) {
        shown.forEach { $0.isHidden = false }
        let globeHidden = engine.layout.key(.globe) == nil
        let accentHidden = engine.activeAccentMenu == nil
        let duration = window == nil ? 0 : requested
        if duration == 0 {
            shown.forEach { $0.alpha = 1 }
            hidden.forEach {
                $0.alpha = 0
                $0.isHidden = true
            }
            if globeHidden { globeButton.isHidden = true }
            if accentHidden { accentCallout.isHidden = true }
            after?()
            return
        }
        UIView.animate(springDuration: duration, bounce: 0, initialSpringVelocity: 0, delay: delay * MotionDebug.slow, options: [.beginFromCurrentState, .allowUserInteraction]) {
            shown.forEach { $0.alpha = 1 }
            hidden.forEach { $0.alpha = 0 }
        } completion: { _ in
            // A GoSpell key still held for push to talk stays in the window (at alpha 0), so its
            // touch keeps arriving and lifting the finger finishes the dictation.
            for view in hidden where view.alpha == 0 && (view as? UIControl)?.isTracking != true {
                view.isHidden = true
            }
            if globeHidden { self.globeButton.isHidden = true }
            if accentHidden { self.accentCallout.isHidden = true }
            after?()
        }
    }
}
