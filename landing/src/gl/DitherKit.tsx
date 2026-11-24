import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Small 2D-canvas dither pieces that share the 8x8 Bayer matrix with the
// WebGPU scenes: section seams, a dissolve-in for headlines, and the footer
// wordmark. Each canvas is drawn at one pixel per dither cell and scaled up
// by CSS with hard edges.

const BAYER = (() => {
  const m = new Float32Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = x ^ y;
    const k = ((v & 1) << 5) | ((x & 1) << 4) | ((v & 2) << 2) | ((x & 2) << 1) | ((v & 4) >> 1) | ((x & 4) >> 2);
    m[y * 8 + x] = (k + 0.5) / 64;
  }
  return m;
})();
const bayer = (x: number, y: number) => BAYER[(y & 7) * 8 + (x & 7)];

type RGBA = [number, number, number, number];
const rgba = (c: string | null): RGBA => {
  if (!c) return [0, 0, 0, 0];
  const n = parseInt(c.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255, 255];
};
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Quantize v (0..1) onto the palette through the Bayer threshold at (x, y). */
function pick(pal: RGBA[], v: number, x: number, y: number) {
  const idx = Math.min(Math.max(v, 0), 1) * (pal.length - 1);
  const i0 = Math.floor(idx);
  return pal[Math.min(pal.length - 1, i0 + (bayer(x, y) < idx - i0 ? 1 : 0))];
}

/** Runs draw(now) on every frame while the canvas is on screen, once if motion is reduced. */
function useCanvasLoop(ref: React.RefObject<HTMLCanvasElement | null>, cell: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number, now: number) => boolean | void, deps: unknown[]) {
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0, visible = false, alive = true;
    const still = reduced();
    const size = () => {
      canvas.width = Math.max(1, Math.ceil(canvas.clientWidth / cell));
      canvas.height = Math.max(1, Math.ceil(canvas.clientHeight / cell));
      drawRef.current(ctx, canvas.width, canvas.height, performance.now());
    };
    const ro = new ResizeObserver(size); ro.observe(canvas); size();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "80px" });
    io.observe(canvas);
    const loop = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (!visible || still || document.hidden) return;
      if (drawRef.current(ctx, canvas.width, canvas.height, now) === false) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Pointer in client coordinates, shared.
const ptr = { x: -1e4, y: -1e4 };
if (typeof window !== "undefined") window.addEventListener("pointermove", e => { if (e.pointerType === "mouse") { ptr.x = e.clientX; ptr.y = e.clientY; } }, { passive: true });

/**
 * A dithered seam between two sections. Colours run top to bottom; null is
 * transparent, so the section's own canvas shows through. The boundary drifts
 * slowly and leans towards the pointer.
 */
export function DitherEdge({ colors, className, cell = 4 }: { colors: (string | null)[]; className?: string; cell?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pal = colors.map(rgba);
  const lean = useRef({ x: 0, a: 0 });
  useCanvasLoop(ref, cell, (ctx, w, h, now) => {
    const t = now / 1000;
    const r = ref.current!.getBoundingClientRect();
    const near = ptr.y > r.top - 160 && ptr.y < r.bottom + 160 && ptr.x > r.left && ptr.x < r.right;
    lean.current.a += ((near ? 1 : 0) - lean.current.a) * 0.08;
    if (near) lean.current.x += ((ptr.x - r.left) / cell - lean.current.x) * 0.2;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let x = 0; x < w; x++) {
      const dx = (x - lean.current.x) / (w * 0.08);
      const off = 0.16 * Math.sin(x * 0.04 + t * 0.35) + 0.1 * Math.sin(x * 0.011 - t * 0.22 + 1.3) - 0.3 * lean.current.a * Math.exp(-dx * dx);
      for (let y = 0; y < h; y++) {
        const k = (y + 0.5) / h;
        const v = (k - 0.5) * 1.7 + 0.5 + off * 4 * k * (1 - k);
        const c = pick(pal, v, x, y);
        const i = (y * w + x) * 4;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3];
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [colors.join(), cell]);
  return <canvas ref={ref} className={`dither dither-edge ${className ?? ""}`} aria-hidden="true" />;
}

/**
 * Reveals its children through a dissolving dither mask, left to right, the
 * way a line gets typed. color must match the background behind the text.
 */
export function DitherIn({ children, color, className, cell = 4, delay = 0, duration = 1100 }: { children: ReactNode; color: string; className?: string; cell?: number; delay?: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(() => reduced());
  const start = useRef(0);
  const c = rgba(color);

  const paint = (p: number) => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const th = 0.5 * bayer(x, y) + 0.5 * (x / w) + 0.06 * Math.sin(y * 0.9 + x * 0.05);
      if (th < p) continue;
      const i = (y * w + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };

  useLayoutEffect(() => {
    if (done) return;
    const canvas = ref.current!;
    canvas.width = Math.max(1, Math.ceil(canvas.clientWidth / cell));
    canvas.height = Math.max(1, Math.ceil(canvas.clientHeight / cell));
    paint(-1);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || start.current) return;
      start.current = performance.now() + delay;
      const tick = (now: number) => {
        const k = Math.max(0, Math.min(1, (now - start.current) / duration));
        const e2 = 1 - Math.pow(1 - k, 2.2);
        paint(-0.08 + e2 * 1.2);
        if (k < 1) raf = requestAnimationFrame(tick); else setDone(true);
      };
      raf = requestAnimationFrame(tick);
      io.disconnect();
    }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(wrap.current!);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrap} className={`dither-in ${className ?? ""}`}>
      {children}
      {!done && <canvas ref={ref} className="dither dither-in-mask" aria-hidden="true" />}
    </div>
  );
}

/**
 * A wordmark set in pixels: the letters are filled with a dithered ember
 * gradient, a slow band of light passes through them, and the pointer warms
 * the cells near it.
 */
export function DitherWord({ text, palette, className, cell = 4 }: { text: string; palette: (string | null)[]; className?: string; cell?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pal = palette.map(rgba);
  const mask = useRef<{ w: number; h: number; a: Float32Array } | null>(null);
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => { document.fonts?.load("800 100px Geist").finally(() => setFontReady(true)); }, []);

  useCanvasLoop(ref, cell, (ctx, w, h, now) => {
    if (!fontReady) return;
    if (!mask.current || mask.current.w !== w || mask.current.h !== h) {
      const off = document.createElement("canvas");
      off.width = w; off.height = h;
      const o = off.getContext("2d")!;
      let size = h * 0.98;
      o.font = `800 ${size}px Geist, sans-serif`;
      o.letterSpacing = `${-size * 0.06}px`;
      size *= Math.min(1, (w * 0.995) / o.measureText(text).width);
      o.font = `800 ${size}px Geist, sans-serif`;
      o.letterSpacing = `${-size * 0.06}px`;
      const tw = o.measureText(text).width;
      o.textBaseline = "alphabetic";
      o.fillStyle = "#fff";
      o.fillText(text, (w - tw) / 2, h * 0.78);
      const src = o.getImageData(0, 0, w, h).data;
      const a = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) a[i] = src[i * 4 + 3] / 255;
      mask.current = { w, h, a };
    }
    const m = mask.current.a;
    const t = now / 1000;
    const r = ref.current!.getBoundingClientRect();
    const cx = (ptr.x - r.left) / cell, cy = (ptr.y - r.top) / cell;
    const band = ((t * 0.09) % 1.6) - 0.3;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const cov = m[i];
      if (cov <= 0.01) continue;
      const bx = x / w - band - (y / h) * 0.18;
      const lx = (x - cx) / h, ly = (y - cy) / h;
      const lit = 0.32 * Math.exp(-bx * bx * 60) + 0.28 * Math.exp(-(lx * lx + ly * ly) * 9);
      const v = cov * Math.max(0.36, Math.min(1, 0.54 + 0.34 * (y / h) - lit));
      const c = pick(pal, v, x, y);
      const j = i * 4;
      d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = c[3];
    }
    ctx.putImageData(img, 0, 0);
  }, [text, cell, palette.join(), fontReady]);

  return <canvas ref={ref} className={`dither dither-word ${className ?? ""}`} role="img" aria-label={text} />;
}
