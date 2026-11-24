// GoSpell for iPhone on the web: /gospell/iphone (what it is and how to set it up,
// and the App Store listing's support URL) and /gospell/privacy (the iPhone app's
// privacy policy, its privacy policy URL). scripts/iphone.ts writes them and
// their social cards at build, in the Labs pages' look (src/labs.ts).
//
// Every claim here is checked against ios/: GoSpell makes no network request of
// its own except FluidAudio's English model download (ParakeetTranscriber),
// GoSpell Keyboard makes none, and the Experiments that keep data are off by
// default and write only to the App Group.
import { withBase } from "./base"
import { shell } from "./labs"

export const IPHONE_PATH = withBase("/iphone")
export const PRIVACY_PATH = withBase("/privacy")
// What each page's social card says (scripts/iphone.ts draws them). Bump CARD_VERSION
// when a card changes, so link previews that cached the old one fetch it again.
export const CARDS = {
  iphone: { title: "A keyboard you talk to", line: "Dictate right inside the keyboard, in any app. Free, private, and on your iPhone." },
  privacy: { title: "Privacy policy", line: "GoSpell doesn't collect any data. What you say and type stays on your iPhone." },
}
const CARD_VERSION = 1
export const IPHONE_CARD_PATH = withBase(`/iphone.png?v=${CARD_VERSION}`)
export const PRIVACY_CARD_PATH = withBase(`/privacy.png?v=${CARD_VERSION}`)
// The date the privacy policy last changed in substance; change it with the policy.
export const PRIVACY_UPDATED = "November 20, 2026"
const ISSUES = "https://github.com/goml/gospell/issues"
const SECURITY = "https://github.com/goml/gospell/security/advisories/new"

const IPHONE = { crumb: { href: IPHONE_PATH, label: "iPhone" } }

// Long-form copy: section headings, lists, and questions, below the Labs
// pages' title and line.
const PROSE = `
.updated { margin: 14px 0 0; color: #6f7075; font-size: 14px; }
.prose { margin: 56px 0 0; }
.prose section { padding: 28px 0 0; margin: 28px 0 0; border-top: 1px solid #1d1e21; }
.prose section:first-child { margin-top: 0; }
.prose h2 { margin: 0 0 12px; font-size: 20px; font-weight: 600; letter-spacing: -0.015em; line-height: 1.3; }
.prose h3 { margin: 22px 0 6px; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.prose p, .prose li { color: #b4b5ba; max-width: 38em; text-wrap: pretty; }
.prose p { margin: 0 0 12px; }
.prose ul, .prose ol { margin: 0 0 12px; padding: 0 0 0 22px; }
.prose li { border: 0; margin: 0 0 10px; padding-left: 4px; }
.prose ul { list-style: disc; }
.prose ol { list-style: decimal; }
.prose li::marker { color: #6f7075; }
.prose strong { color: #f2f2ef; font-weight: 600; }
.prose a { text-decoration-color: #4a4b50; text-underline-offset: 3px; }
.prose a:hover { text-decoration-color: currentColor; }
`

export function renderIphone(origin: string): string {
  const body = `<p class="eyebrow">GoSpell for iPhone</p>
<h1>A keyboard you talk to</h1>
<p class="summary">Dictate right inside the keyboard, in any app. Free, private, and on your iPhone.</p>
<div class="prose">
<section>
<h2>Set up GoSpell</h2>
<ol>
<li>Open GoSpell and tap <strong>Get started</strong>.</li>
<li>Tap <strong>Allow</strong> so GoSpell can use the microphone.</li>
<li>Tap <strong>Open Settings</strong>, go to <strong>Keyboards</strong>, and turn on <strong>GoSpell Keyboard</strong> and <strong>Allow Full Access</strong>.</li>
<li>Back in GoSpell, try it: tap a text field, switch to GoSpell Keyboard with the globe key, tap <strong>Dictate</strong>, and talk.</li>
</ol>
<p>Don't see Keyboards? Go to Settings › General › Keyboard › Keyboards › Add New Keyboard and choose GoSpell. Then tap GoSpell Keyboard there and turn on Allow Full Access.</p>
</section>
<section>
<h2>Why Full Access</h2>
<p>iOS asks for Full Access for any keyboard that does more than type. GoSpell Keyboard needs it to record with the microphone you allowed for GoSpell and to share your settings and dictations with the GoSpell app.</p>
<p>GoSpell Keyboard makes no network requests, and nothing you say or type leaves your iPhone.</p>
</section>
<section>
<h2>Common questions</h2>
<h3>Does it all happen on my iPhone?</h3>
<p>Yes. GoSpell turns speech into text on your iPhone, with Apple's on-device speech recognition or its own English model, and deletes the audio as soon as it's done. There's no account and no cloud. See the <a href="${PRIVACY_PATH}">privacy policy</a>.</p>
<h3>Is GoSpell free?</h3>
<p>Yes. No subscription, no ads, and nothing to buy in the app.</p>
<h3>Which languages does GoSpell speak?</h3>
<p>On iOS 26 or later, every language Apple can transcribe on the iPhone. GoSpell picks your iPhone's language, and you can switch from the keyboard. Before iOS 26, GoSpell dictates in English.</p>
<h3>Does my music keep playing?</h3>
<p>Yes. With <strong>Always use iPhone microphone</strong> on (the default), GoSpell records with the iPhone's own microphone, so your music keeps playing.</p>
<h3>Does GoSpell work offline?</h3>
<p>Yes, once the speech model for your language has downloaded. That happens once, the first time you use a language.</p>
<h3>Why does the orange microphone dot stay on?</h3>
<p>After a dictation that goes through the GoSpell app, GoSpell keeps the microphone ready so the next one starts at once. Choose how long in GoSpell under <strong>Keep mic warm</strong>, or turn it off.</p>
</section>
<section>
<h2>Get help</h2>
<p>Something not working, or have an idea? <a href="${ISSUES}">Open an issue on GitHub</a>. Report a security problem privately through <a href="${SECURITY}">GitHub's vulnerability reporting</a>.</p>
</section>
</div>
<section class="about">
<p>GoSpell also runs on Mac, Windows, and Linux.</p>
<p><a href="${withBase("/")}">GoSpell for your computer</a> · <a href="${PRIVACY_PATH}">Privacy policy</a></p>
</section>`
  return shell(
    origin,
    {
      title: "GoSpell for iPhone",
      description: "A keyboard you talk to. Dictate right inside the keyboard, in any app: free, private, and on your iPhone. Setup, questions, and help.",
      url: IPHONE_PATH,
      image: IPHONE_CARD_PATH,
      imageAlt: "GoSpell for iPhone: a keyboard you talk to.",
    },
    body,
    { ...IPHONE, style: PROSE },
  )
}

export function renderPrivacy(origin: string): string {
  const body = `<p class="eyebrow">GoSpell for iPhone and Android</p>
<h1>Privacy policy</h1>
<p class="summary">GoSpell doesn't collect any data. What you say and type stays on your iPhone.</p>
<p class="updated">Last updated ${PRIVACY_UPDATED}</p>
<div class="prose">
<section>
<h2>The short version</h2>
<p>GoSpell for iPhone and Android is made by GoML This policy covers the GoSpell app for iPhone, GoSpell Keyboard, and GoSpell's widgets and Live Activities, and <a href="#android">GoSpell for Android</a> and its keyboard.</p>
<p>There's no account, no analytics, no advertising, and no tracking. GoSpell has no servers your words could be sent to.</p>
</section>
<section>
<h2>What happens on your iPhone</h2>
<ul>
<li><strong>Dictation.</strong> While you dictate, GoSpell records audio to a temporary file on your iPhone, turns it into text on the iPhone, and deletes the file as soon as it's done or you cancel. The text goes into the field you're typing in.</li>
<li><strong>Settings.</strong> Your choices, like style, language, and keyboard options, are stored on your iPhone and shared between the GoSpell app and GoSpell Keyboard.</li>
<li><strong>Full Access.</strong> GoSpell Keyboard asks for Full Access so it can record with the microphone you allowed for GoSpell and share settings and dictations with the GoSpell app. GoSpell Keyboard makes no network requests.</li>
<li><strong>Clean up and translation.</strong> Clean up what I say, Clean up with Apple Intelligence, and Translate what I say run on your iPhone, with GoSpell's own model or Apple's on-device models.</li>
</ul>
</section>
<section>
<h2>Features you turn on</h2>
<p>These are off until you turn them on in GoSpell's settings. What they keep stays on your iPhone.</p>
<ul>
<li><strong>Custom vocabulary</strong> keeps the names and terms you add.</li>
<li><strong>Learn how I type</strong> keeps where you tap on each key and the words you corrected, with what you changed them to. It never keeps what you write. Delete what GoSpell learned erases it.</li>
<li><strong>Record typing logs</strong> keeps a detailed log of your typing in GoSpell Keyboard, including the text around your cursor, for 14 days, for testing the keyboard. It never logs password, one-time code, or card fields. The logs leave your iPhone only if you share them yourself, and you can delete them at any time.</li>
</ul>
</section>
<section>
<h2>Downloads</h2>
<p>GoSpell downloads a speech model the first time you use a language: Apple's, through iOS, or, where Apple's isn't available (such as before iOS 26), GoSpell's own English model from Hugging Face. Apple Intelligence and translation languages also download through iOS.</p>
<p>These downloads never include your audio or text. Like any download, the server that sends it sees your IP address.</p>
</section>
<section>
<h2>Crash reports</h2>
<p>If you share analytics with app developers in iOS, Apple may share crash reports about GoSpell with us. Turn this off in Settings › Privacy &amp; Security › Analytics &amp; Improvements.</p>
</section>
<section>
<h2>Children</h2>
<p>GoSpell is suitable for all ages and collects no data from anyone, including children.</p>
</section>
<section id="android">
<h2>GoSpell for Android</h2>
<p>GoSpell for Android and its keyboard work the same way: no account, no analytics, no advertising, and no tracking.</p>
<ul>
<li><strong>Typing.</strong> GoSpell Keyboard uses the text around your cursor and where you tap to suggest and correct words on your phone, and keeps no log of what you type. In password and PIN fields it types exactly what you press, without reading the field, suggesting words, or dictating.</li>
<li><strong>Dictation.</strong> GoSpell uses the microphone only while you dictate. It turns speech into text in memory on your phone, never saves a recording, and keeps no history of what you said. Clean up and translation also run on your phone.</li>
<li><strong>The speech model.</strong> During setup, GoSpell downloads one public speech model (190 MB) from Hugging Face over HTTPS. The request carries none of your words, audio, or device identifiers; like any download, the server sees your IP address. If it fails, GoSpell uses the smaller model it comes with.</li>
<li><strong>What GoSpell keeps.</strong> Your settings, setup progress, and the speech model, in GoSpell's private storage. When you undo an autocorrection, GoSpell keeps a count against a hash of that word pair, never the words, so it doesn't make the same correction again. Clearing GoSpell's storage or uninstalling GoSpell removes all of it, and you can turn off microphone access in Android's settings.</li>
</ul>
</section>
<section>
<h2>GoSpell on your computer</h2>
<p>GoSpell for Mac, Windows, and Linux also transcribes on your computer. This policy covers only GoSpell for iPhone and Android.</p>
</section>
<section>
<h2>Changes</h2>
<p>If this policy changes, we'll update this page and the date at the top.</p>
</section>
<section>
<h2>Contact</h2>
<p>Questions about privacy? <a href="${ISSUES}">Open an issue on GitHub</a>, or report a security problem privately through <a href="${SECURITY}">GitHub's vulnerability reporting</a>.</p>
</section>
</div>
<section class="about">
<p><a href="${IPHONE_PATH}">GoSpell for iPhone</a> · <a href="${withBase("/")}">GoSpell for your computer</a></p>
</section>`
  return shell(
    origin,
    {
      title: "Privacy policy · GoSpell for iPhone",
      description: "GoSpell doesn't collect any data. What you say and type stays on your iPhone: no account, no analytics, no tracking.",
      url: PRIVACY_PATH,
      image: PRIVACY_CARD_PATH,
      imageAlt: "GoSpell for iPhone privacy policy: what you say and type stays on your iPhone.",
    },
    body,
    { ...IPHONE, style: PROSE },
  )
}