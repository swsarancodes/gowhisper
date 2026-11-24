import { useEffect, useRef } from "react";
import { voice } from "../lib/voice";

// GoSpell's recording HUD: embers on a turning double helix that swell with
// the voice, gather while it thinks, and collapse into a check when done.
export function Hud({ width = 340, height = 62 }: { width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d")!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = width * dpr; c.height = height * dpr;
    const glow = document.createElement("canvas"); glow.width = glow.height = 32;
    const gg = glow.getContext("2d")!; const r = gg.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, "rgba(255,246,230,1)"); r.addColorStop(0.25, "rgba(255,170,80,.65)"); r.addColorStop(1, "rgba(255,110,0,0)");
    gg.fillStyle = r; gg.fillRect(0, 0, 32, 32);
    let raf = 0;
    const loop = (now: number) => {
      const t = now / 1000, since = (now - voice.since) / 1000;
      const gather = voice.phase === "thinking" ? Math.min(1, since / 0.35) : voice.phase === "done" ? 1 : 0;
      const collapse = voice.phase === "done" ? Math.min(1, since / 0.3) : 0;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, width, height);
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 120; i++) {
        const u = (i % 60) / 60, strand = i < 60 ? 0 : 1, env = Math.pow(Math.sin(Math.PI * u), 1.2);
        const A = env * (3 + 21 * voice.level);
        const th = u * Math.PI * 3 + t * 1.7 + strand * Math.PI;
        let x = 30 + u * (width - 60), y = height / 2 + A * Math.sin(th);
        const near = (Math.cos(th) + 1) / 2;
        const gx = width / 2 + Math.cos(i * 2.4) * 14 * (1 - collapse), gy = height / 2 + Math.sin(i * 2.4) * 9 * (1 - collapse);
        x += (gx - x) * gather; y += (gy - y) * gather;
        const s = 2 + near * 2.6;
        g.globalAlpha = (0.3 + 0.7 * near) * (1 - collapse);
        g.drawImage(glow, x - s * 2, y - s * 2, s * 4, s * 4);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      if (collapse > 0) {
        const k = Math.min(1, collapse * 1.6);
        g.fillStyle = "#ff8600"; g.beginPath(); g.arc(width / 2, height / 2, 15 * k, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#fff"; g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(width / 2 - 6 * k, height / 2); g.lineTo(width / 2 - 1.5 * k, height / 2 + 5 * k); g.lineTo(width / 2 + 7 * k, height / 2 - 5 * k); g.stroke();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);
  return <canvas ref={ref} className="hud-canvas" style={{ width, height }} aria-hidden="true" />;
}
