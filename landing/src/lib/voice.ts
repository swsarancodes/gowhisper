// One shared voice for the page: the shader, the HUD and the demo all read
// it every frame, so nothing re-renders React at 60 Hz.

export type Phase = "idle" | "listening" | "thinking" | "done";

export const voice = {
  /** Smoothed 0–1 loudness. */
  level: 0,
  phase: "idle" as Phase,
  /** performance.now() when the phase began, ms. */
  since: 0,
  /** A live microphone, when the visitor allowed one. */
  analyser: null as AnalyserNode | null,
};

const buf = new Float32Array(1024);

/** A speaking voice: syllables about four and a half a second, breaths between. */
function synthetic(t: number): number {
  const ph = t % 2.2;
  if (ph > 1.75) return 0.06;
  const shape = Math.pow(Math.max(0, Math.sin((Math.PI * ph) / 1.75)), 0.4);
  const syl = 0.5 + 0.5 * Math.sin(6.283 * 4.4 * ph + Math.floor(t / 2.2));
  return Math.min(1, 0.1 + 0.85 * shape * Math.pow(syl, 1.5));
}

export function setPhase(p: Phase) {
  voice.phase = p;
  voice.since = performance.now();
}

let started = false;
/** Starts the one ticker that moves `voice.level`. */
export function startVoice() {
  if (started) return;
  started = true;
  const tick = (now: number) => {
    let target = 0;
    if (voice.analyser) {
      voice.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      target = Math.min(1, Math.sqrt(sum / buf.length) * 9);
    } else if (voice.phase === "listening") {
      target = synthetic(now / 1000);
    }
    const k = target > voice.level ? 0.35 : 0.08;
    voice.level += (target - voice.level) * k;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Lets the visitor's own microphone drive the waves. Resolves false when refused. */
export async function enableMicrophone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser();
    an.fftSize = 2048;
    src.connect(an);
    voice.analyser = an;
    return true;
  } catch {
    return false;
  }
}
