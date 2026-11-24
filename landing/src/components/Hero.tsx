import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dither, type Layout } from "../gl/Dither";
import { DitherEdge } from "../gl/DitherKit";
import { Hud } from "./Hud";
import { setPhase, enableMicrophone, voice } from "../lib/voice";
import { primaryFor, useSystem } from "../lib/download";

const LINES = [
  "Ship the new onboarding on Friday, then celebrate with the whole team.",
  "Running five minutes late. Start without me and I'll catch up on the notes.",
  "Refactor checkout to async/await and add a test for the failed charge.",
  "Thanks Priya! I'm signing the contract today and looping in finance.",
];
type Demo = "ready" | "listening" | "thinking" | "pasted" | "settled" | "short";

/** Hold the key (or Space), talk, let go: the demo does what GoSpell does. */
function TryIt() {
  const [state, setState] = useState<Demo>("ready");
  const [n, setN] = useState(-1);
  const [mic, setMic] = useState<"off" | "on" | "refused">("off");
  const down = useRef(0);
  const holding = useRef(false);

  const start = useCallback(() => {
    if (holding.current || state === "thinking") return;
    holding.current = true; down.current = performance.now();
    setPhase("listening"); setState("listening");
  }, [state]);
  const stop = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    if (performance.now() - down.current < 450) { setPhase("idle"); setState("short"); return; }
    setPhase("thinking"); setState("thinking");
    window.setTimeout(() => { setPhase("done"); setN(i => (i + 1) % LINES.length); setState("pasted"); }, 650);
    window.setTimeout(() => { if (voice.phase === "done") setPhase("idle"); setState(s => (s === "pasted" ? "settled" : s)); }, 1700);
  }, []);

  useEffect(() => {
    const isField = (e: KeyboardEvent) => (e.target as HTMLElement)?.closest?.("input, textarea, [contenteditable]");
    const kd = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === "Alt") && !e.repeat && !isField(e) && window.scrollY < window.innerHeight * 0.8) { e.preventDefault(); start(); }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space" || e.key === "Alt") stop(); };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [start, stop]);

  const words = n >= 0 ? LINES[n].split(" ") : [];
  const status = { ready: "Hold the key and talk", listening: "Listening…", thinking: "Transcribing on your computer…", pasted: "Pasted into Notes", settled: "Pasted into Notes. Hold again for another", short: "Hold a little longer, then let go" }[state];

  return (
    <div className="try">
      <div className="try-win">
        <div className="try-bar"><i /><i /><i /><span>Notes</span></div>
        <div className={`try-hud ${state === "listening" || state === "thinking" || state === "pasted" ? "on" : ""}`}><Hud width={300} height={56} /></div>
        <div className="try-doc">
          <div className="try-title">Today</div>
          <p className="try-text" aria-live="polite">
            {n < 0 && <span className="try-ph">Your words land here.</span>}
            {words.map((w, i) => (
              <motion.span key={`${n}-${i}`} initial={{ opacity: 0, y: 8, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: i * 0.035, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>{w} </motion.span>
            ))}
            <span className="caret" />
          </p>
        </div>
      </div>
      <div className="try-controls">
        <motion.button className={`keycap ${state === "listening" ? "down" : ""}`}
          onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); start(); }}
          onPointerUp={stop} onPointerCancel={stop} onContextMenu={e => e.preventDefault()}
          whileHover={{ y: -2 }} aria-label="Hold to talk">
          <span className="keycap-glyph">⌥</span><span className="keycap-label">Hold to talk</span>
        </motion.button>
        <div className="try-meta">
          <AnimatePresence mode="wait"><motion.div key={state} className="try-status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>{status}</motion.div></AnimatePresence>
          <div className="try-hint">Or hold <kbd>Space</kbd>. The text appears when you let go, the way GoSpell works.</div>
          <button className="try-mic" disabled={mic === "on"} onClick={async () => setMic((await enableMicrophone()) ? "on" : "refused")}>
            {mic === "on" ? "Your voice is moving the orb" : mic === "refused" ? "Microphone not available here" : "Let my voice move the orb"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const still = useReducedMotion();
  const cta = useRef<HTMLDivElement>(null);
  const sys = useSystem();
  const pick = sys ? primaryFor(sys) : null;
  // The orb rises like a sun over the demo window on desktop. On phones it sits
  // in the empty space to the right of the buttons.
  const heroOrb: Layout = (w, h) => {
    if (w >= 980) return [0.82, Math.min(0.27, 250 / h), Math.min(0.34, 300 / h)];
    const el = cta.current, sec = el?.closest(".hero");
    if (!el || !sec) return [0.88, 0.3, 64 / h];
    const a = el.getBoundingClientRect(), b = sec.getBoundingClientRect();
    const r = Math.min(76, w * 0.18);
    return [(w - r * 0.55) / w, (a.top - b.top + a.height / 2) / h, r / h];
  };
  const lead = (d: number) => ({ initial: { opacity: 0, y: still ? 0 : 24, filter: still ? "none" : "blur(10px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { delay: d, duration: 0.9, ease: [0.22, 1, 0.36, 1] as const } });
  const typed = "It's typed.".split(" ");
  return (
    <section className="hero" id="top">
      <Dither scene={0} className="hero-gl" palette={["#3a1204", "#c8410a", "#ff6a13", "#ffe4c8"]} px={typeof window !== "undefined" && window.innerWidth < 640 ? 2 : 3} layout={heroOrb} glow={0.04} />
      <DitherEdge className="edge-bottom" colors={[null, "#fcfbf9"]} />
      <div className="hero-inner">
        <div className="hero-copy">
          <h1 className="hero-h1">
            <motion.span className="h1-line" {...lead(0.25)}>Say it.</motion.span>
            <span className="h1-line h1-typed">
              {typed.map((w, i) => (
                <motion.span key={w} initial={{ opacity: 0, filter: still ? "none" : "blur(14px)", y: still ? 0 : 18 }} animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                  transition={{ delay: 1.0 + i * 0.32, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>{w}{i < typed.length - 1 ? " " : ""}</motion.span>
              ))}
              <motion.span className="h1-caret" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ delay: 1.1, duration: 1.1, repeat: Infinity, repeatDelay: 0.1 }} />
            </span>
          </h1>
          <motion.p className="hero-sub" {...lead(1.5)}>GoSpell turns your voice into text in any app. Hold a key, talk, let go. It runs on your computer, so what you say never leaves it.</motion.p>
          <motion.div ref={cta} className="hero-cta" {...lead(1.7)}>
            {pick
              ? <a className="btn btn-dark" href={pick.href} download>{pick.label}</a>
              : <a className="btn btn-dark" href="#download">{sys ? "Get GoSpell for your computer" : "Download GoSpell"}</a>}
            <a className="btn btn-ghost" href="#download">All downloads</a>
          </motion.div>
          <motion.div className="hero-fine" {...lead(1.9)}>Free · Open source · No account</motion.div>
        </div>
        <motion.div className="hero-demo" initial={{ opacity: 0, y: still ? 0 : 40, rotateX: still ? 0 : 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.6, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}>
          <TryIt />
        </motion.div>
      </div>
    </section>
  );
}
