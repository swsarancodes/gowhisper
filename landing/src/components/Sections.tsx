import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AppIcon, GomlMark } from "./Icon";
import { Dither, type Layout } from "../gl/Dither";
import { DitherEdge, DitherIn, DitherWord } from "../gl/DitherKit";
import { files, REPO_URL, useSystem, type Arch, type OS } from "../lib/download";

gsap.registerPlugin(ScrollTrigger);
const EASE = [0.22, 1, 0.36, 1] as const;
const rise = { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.8, ease: EASE } };

export function Nav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", v => setSolid(v > window.innerHeight * 0.75));
  return (
    <nav className={`nav ${solid ? "solid" : ""}`} aria-label="Main">
      <a className="nav-brand" href="#top"><AppIcon size={26} /><span>GoSpell</span></a>
      <div className="nav-links"><a href="#how">How it works</a><a href="#apps">Apps</a><a href="#private">Privacy</a><a href="#download">Download</a></div>
      <a className="btn btn-small" href="#download">Get GoSpell</a>
    </nav>
  );
}

const APPS = ["Teams", "Slack", "Cursor", "VS Code", "Claude", "ChatGPT", "Gmail", "Outlook", "Notion", "Linear", "Figma", "Terminal", "Docs", "Discord", "Jira", "Messages"];
export function Marquee() {
  return (
    <section className="marquee" aria-label="Apps GoSpell types into">
      <div className="mq-label">Types wherever your cursor is</div>
      {[0, 1].map(row => (
        <div key={row} className={`mq-row ${row ? "rev" : ""}`}>
          <div className="mq-track">{[...APPS, ...APPS].map((a, i) => <span key={i} className="mq-item">{a}</span>)}</div>
        </div>
      ))}
    </section>
  );
}

/** The three steps, scrubbed by scroll: the key goes down, the HUD listens, the text lands. */
export function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  useLayoutEffect(() => {
    if (still) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: ".hw-pin", start: "top top", end: "+=2400", scrub: 0.6, pin: true } });
      tl.to(".hw-key", { y: 14, boxShadow: "0 2px 0 #c8bdb2, 0 18px 40px rgba(60,30,10,.18), 0 0 60px rgba(255,120,30,.55)", duration: 1 }, 0)
        .to(".hw-step[data-i='0']", { opacity: 1, duration: .5 }, 0)
        .fromTo(".hw-hud", { opacity: 0, y: -16, scale: .85 }, { opacity: 1, y: 0, scale: 1, duration: 1 }, 1)
        .to(".hw-step[data-i='0']", { opacity: .28, duration: .5 }, 1.2).to(".hw-step[data-i='1']", { opacity: 1, duration: .5 }, 1.2)
        .to(".hw-bar", { scaleY: () => 0.35 + Math.random() * 1.2, stagger: { each: .05, repeat: 5, yoyo: true }, duration: .2 }, 1.4)
        .to(".hw-key", { y: 0, boxShadow: "0 14px 0 #c8bdb2, 0 30px 60px rgba(60,30,10,.22), 0 0 0 rgba(255,120,30,0)", duration: .6 }, 3.2)
        .to(".hw-step[data-i='1']", { opacity: .28, duration: .5 }, 3.2).to(".hw-step[data-i='2']", { opacity: 1, duration: .5 }, 3.2)
        .to(".hw-hud", { opacity: 0, scale: .9, duration: .5 }, 3.6).fromTo(".hw-done", { opacity: 0, scale: .4 }, { opacity: 1, scale: 1, duration: .5, ease: "back.out(2)" }, 3.6)
        .fromTo(".hw-word", { opacity: 0, y: 10, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", stagger: .06, duration: .4 }, 3.8)
        .to(".hw-done", { opacity: 0, duration: .4 }, 5);
    }, root);
    return () => ctx.revert();
  }, [still]);
  const msg = "Can we move the launch review to 3pm? I'll bring the updated numbers.".split(" ");
  const STEPS = [["Hold", "Press and hold your GoSpell key, in any app."], ["Speak", "Talk the way you would to a person. Pauses are fine."], ["Release", "Let go, and your words are typed where the cursor is."]];
  return (
    <section className="how" id="how" ref={root}>
      <div className="hw-pin">
        <div className="hw-copy">
          <DitherIn color="#fcfbf9"><h2 className="h2">One key. <span className="soft">Three moves.</span></h2></DitherIn>
          <ol className="hw-steps">{STEPS.map(([h, p], i) => (
            <li key={h} className="hw-step" data-i={i} style={{ opacity: still ? 1 : 0.28 }}><span className="hw-n">{i + 1}</span><div><b>{h}</b><p>{p}</p></div></li>))}</ol>
        </div>
        <div className="hw-stage" aria-hidden="true">
          <div className="hw-screen">
            <Dither scene={1} className="hw-wall" palette={["#6e2104", "#d4470d", "#ff7a2d", "#ffd2a6"]} px={2} sky={0.667} idle={0.35} />
            <div className="hw-menubar"><span className="hw-apple" /><b>Messages</b><span>File</span><span>Edit</span><span className="hw-mb-r"><AppIcon size={18} />9:41</span></div>
            <div className="hw-hud">{Array.from({ length: 22 }, (_, i) => <i key={i} className="hw-bar" style={{ height: `${10 + Math.sin(i * .7) * 6 + 8}px` }} />)}</div>
            <div className="hw-done"><GomlMark size={44} /></div>
            <div className="hw-chat">
              <div className="hw-bubble them">Are we still on for the review?</div>
              <div className="hw-input">{msg.map((w, i) => <span key={i} className="hw-word" style={{ opacity: still ? 1 : 0 }}>{w} </span>)}<span className="caret dark" /></div>
            </div>
          </div>
          <div className="hw-key">⌥</div>
        </div>
      </div>
    </section>
  );
}

/** Typing against talking, on the same paragraph, at four times speed. */
export function Race() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const [run, setRun] = useState(0);
  const [time, setTime] = useState(0);
  const text = "Quick summary from today: the beta is stable, signups doubled this week, and we're shipping the Windows build on Monday. Thanks, everyone.";
  const words = text.split(" ");
  const TYPE_S = text.length / (40 * 5 / 60), TALK_S = words.length / (150 / 60), SPEED = 4;
  useEffect(() => { if (inView && run === 0) setRun(1); }, [inView, run]);
  useEffect(() => {
    if (!run) return;
    const t0 = performance.now(); let raf = 0;
    const tick = (now: number) => { const s = (now - t0) / 1000 * SPEED; setTime(s); if (s < TYPE_S + 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [run, TYPE_S]);
  const typed = text.slice(0, Math.floor(Math.min(1, time / TYPE_S) * text.length));
  const spoken = words.slice(0, Math.floor(Math.min(1, time / TALK_S) * words.length)).join(" ");
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <section className="race" ref={ref}>
      <div className="race-head">
        <DitherIn color="#fcfbf9"><h2 className="h2">You speak about <span className="ember">four times</span> faster than you type.</h2></DitherIn>
        <motion.p className="lede" {...rise} transition={{ ...rise.transition, delay: 0.25 }}>Most people type around 40 words a minute and speak around 150. Here's the same note, both ways.</motion.p>
      </div>
      <div className="race-lanes">
        {[{ k: "Typing", v: typed, s: Math.min(time, TYPE_S), done: time >= TYPE_S, wpm: 40 }, { k: "Talking with GoSpell", v: spoken, s: Math.min(time, TALK_S), done: time >= TALK_S, wpm: 150 }].map((l, i) => (
          <motion.div key={l.k} className={`lane ${i ? "talk" : ""}`} {...rise} transition={{ ...rise.transition, delay: i * 0.1 }}>
            <div className="lane-top"><span>{l.k}</span><span className="mono">{l.wpm} wpm · {fmt(l.s)}{l.done ? " ✓" : ""}</span></div>
            <div className="lane-bar"><motion.i animate={{ scaleX: l.s / (i ? TALK_S : TYPE_S) || 0 }} transition={{ duration: 0.1 }} /></div>
            <p className="lane-text">{l.v}<span className={`caret ${i ? "" : "dark"}`} /></p>
          </motion.div>
        ))}
      </div>
      <div className="race-foot"><button className="btn btn-line" onClick={() => setRun(r => r + 1)}>Run it again</button><span className="mono fine">Shown at 4× speed</span></div>
    </section>
  );
}

const CARDS: { k: string; say: string; ui: string }[] = [
  { k: "Team chat", say: "Running five minutes late, start without me.", ui: "chat" },
  { k: "Code editor", say: "Refactor this to async/await and add a test.", ui: "code" },
  { k: "AI assistant", say: "Summarize this thread into three action items.", ui: "ai" },
  { k: "Email", say: "Thanks Priya, signing the contract today.", ui: "mail" },
  { k: "Docs", say: "Next quarter we focus on onboarding and retention.", ui: "doc" },
  { k: "Terminal", say: "git commit -m \"fix the failed charge path\"", ui: "term" },
];
function Card({ c, i }: { c: (typeof CARDS)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-100px" });
  const [hover, setHover] = useState(0);
  const words = c.say.split(" ");
  return (
    <motion.div ref={ref} className={`card card-${c.ui}`} {...rise} transition={{ ...rise.transition, delay: (i % 3) * 0.08 }}
      onHoverStart={() => setHover(h => h + 1)} whileHover={{ y: -6 }}>
      <div className="card-ui">
        <div className="card-chrome"><i /><i /><i /><span>{c.k}</span></div>
        <div className="card-field">
          {inView && words.map((w, j) => (
            <motion.span key={`${hover}-${j}`} initial={{ opacity: 0, filter: "blur(5px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ delay: 0.5 + j * 0.05, duration: 0.3 }}>{w} </motion.span>))}
          <span className="caret" />
        </div>
      </div>
      <div className="card-k">{c.k}</div>
    </motion.div>
  );
}
export function Everywhere() {
  return (
    <section className="apps" id="apps">
      <div className="apps-head">
        <DitherIn color="#fcfbf9"><h2 className="h2">If it has a text box, <span className="soft">GoSpell types in it.</span></h2></DitherIn>
        <motion.p className="lede" {...rise} transition={{ ...rise.transition, delay: 0.25 }}>Chat, code, email, docs, prompts and the terminal. GoSpell pastes at your cursor, so there's nothing to install in the apps you already use.</motion.p>
      </div>
      <div className="grid">{CARDS.map((c, i) => <Card key={c.k} c={c} i={i} />)}</div>
    </section>
  );
}

const pvOrb: Layout = (w, h) => (w >= 900 ? [0.84, Math.min(0.24, 270 / h), Math.min(0.13, 150 / h)] : [0.86, 84 / h, 58 / h]);
export function Private() {
  const FACTS = [["On-device", "The speech model runs on your computer's own chip."], ["Offline", "Once the model is downloaded, no connection is needed."], ["No account", "Install it and talk. There's nothing to sign up for."], ["Open source", "MIT licensed. Read every line of what runs on your Mac."]];
  return (
    <section className="private" id="private">
      <Dither scene={2} className="pv-gl" palette={["#1a0c04", "#4a1f08", "#d4500e", "#ffb36b"]} px={3} layout={pvOrb} glow={0.09} />
      <DitherEdge className="edge-top" colors={["#fcfbf9", "#ff6a13", null]} />
      <DitherEdge className="edge-bottom" colors={[null, "#ff6a13", "#fcfbf9"]} />
      <div className="pv-head">
        <DitherIn color="#1a0c04"><h2 className="h2 light">Your voice <span className="ember">never leaves</span> your computer.</h2></DitherIn>
      </div>
      <motion.div className="pv-flow" {...rise} aria-hidden="true">
        <div className="pv-node">Your voice</div>
        <div className="pv-wire"><i /></div>
        <div className="pv-node pv-main"><AppIcon size={44} /><span>Your computer</span><small>Speech model · on-device</small></div>
        <div className="pv-wire"><i /></div>
        <div className="pv-node">Text at your cursor</div>
        <div className="pv-cloud">The cloud<span>not involved</span></div>
      </motion.div>
      <div className="pv-facts">{FACTS.map(([h, p], i) => (
        <motion.div key={h} className="pv-fact" {...rise} transition={{ ...rise.transition, delay: i * 0.08 }}><b>{h}</b><p>{p}</p></motion.div>))}</div>
    </section>
  );
}

function Copy({ cmd }: { cmd: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="cmd"><code>{cmd}</code>
      <button onClick={async () => { try { await navigator.clipboard.writeText(cmd); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* the text stays selectable */ } }}>{done ? "Copied" : "Copy"}</button>
    </div>
  );
}
type Card = { os: OS; k: string; d: string; steps: string; cmd: string };
const CARDS_DL: Card[] = [
  { os: "mac", k: "Mac", d: "Apple silicon · macOS 15 or later", steps: "Open the DMG and drag GoSpell to Applications. The first time, run this once, then open it.", cmd: "xattr -dr com.apple.quarantine /Applications/GoSpell.app" },
  { os: "windows", k: "Windows", d: "Windows 10 and 11 · x64 and ARM64", steps: "Run the setup. At the SmartScreen warning choose More info, then Run anyway.", cmd: "" },
  { os: "linux", k: "Linux", d: "x86_64 and ARM64 · glibc 2.36 or later", steps: "Install the package, or run the executable directly.", cmd: "sudo apt install ./GoSpell-linux-x64.deb" },
];
export function Download() {
  const sys = useSystem();
  // A card uses the visitor's chip only when it is their system, otherwise the common 64-bit build.
  const archOf = (os: OS): Arch => (sys?.os === os ? sys.arch : "x64");
  const link = (c: Card) => {
    const arch = archOf(c.os);
    if (c.os === "mac") return { href: files.mac, b: "Download for Mac", more: [] as [string, string][] };
    if (c.os === "windows") return { href: files.windows[arch], b: "Download for Windows", more: [[arch === "x64" ? "ARM64 setup" : "64-bit setup", files.windows[arch === "x64" ? "arm64" : "x64"]]] as [string, string][] };
    const l = files.linux(arch);
    return { href: l.deb, b: "Download for Linux", more: [[".rpm", l.rpm], ["Executable", l.bin], [arch === "x64" ? "ARM64 builds" : "x86_64 builds", files.releases]] as [string, string][] };
  };
  return (
    <section className="download" id="download">
      <div className="dl-head">
        <motion.div {...rise}><AppIcon size={96} /></motion.div>
        <DitherIn color="#fcfbf9" delay={150}><h2 className="h2">Talk to your computer.</h2></DitherIn>
        <motion.p className="lede" {...rise} transition={{ ...rise.transition, delay: 0.3 }}>GoSpell is free. Pick your platform and start talking in about a minute.</motion.p>
      </div>
      <div className="dl-grid">{CARDS_DL.map((c, i) => {
        const l = link(c), mine = sys?.os === c.os;
        const cmd = c.os === "linux" ? `sudo apt install ./GoSpell-linux-${archOf("linux")}.deb` : c.cmd;
        return (
          <motion.div key={c.k} className={`dl-card ${mine ? "mine" : ""}`} {...rise} transition={{ ...rise.transition, delay: i * 0.08 }}>
            <b>{c.k}{mine && <em className="dl-you">Your system</em>}</b><span className="fine">{c.d}</span>
            <a className={`btn ${mine || (!sys && i === 0) ? "btn-ember" : "btn-line"}`} href={l.href} download>{l.b}</a>
            {l.more.length > 0 && <div className="dl-more">{l.more.map(([t, h]) => <a key={t} href={h}>{t}</a>)}</div>}
            <p className="dl-steps">{c.steps}</p>
            {cmd && <Copy cmd={cmd} />}
          </motion.div>);
      })}</div>
      <p className="dl-foot fine">Free and open source. <a href={files.releases}>All releases</a> · <a href={files.checksums}>SHA256SUMS</a> · <a href={REPO_URL}>Source on GitHub</a></p>
      <Dither scene={1} className="dl-horizon" palette={["#fcfbf9", "#f7dcc2", "#ff9a52", "#ff6a13"]} px={3} sky={0} idle={0.3} fade={0.42} />
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="ft-brand"><AppIcon size={28} /><b>GoSpell</b><span className="fine">Your voice, typed.</span></div>
      <div className="ft-by"><GomlMark size={18} /><span>Made by GoML</span></div>
      <div className="ft-links"><a href={REPO_URL}>GitHub</a><a href="#download">Download</a><a href="#private">Privacy</a></div>
      <DitherWord className="ft-word" text="GoSpell" palette={[null, "#ffc59a", "#ff6a13", "#c8410a"]} cell={typeof window !== "undefined" && window.innerWidth < 640 ? 3 : 4} />
    </footer>
  );
}
