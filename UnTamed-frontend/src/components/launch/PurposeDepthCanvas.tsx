import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "motion/react";
import styles from "../../style/launch.module.css";

function seededUnit(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export default function PurposeDepthCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const prefersReduced = useReducedMotion();

  const stars = useMemo(() => {
    return Array.from({ length: 90 }, (_, i) => ({
      x: seededUnit(i, 0),
      y: seededUnit(i, 1) * 0.45,
      r: seededUnit(i, 2) * 1.1 + 0.3,
      phase: seededUnit(i, 3) * Math.PI * 2,
    }));
  }, []);

  const fireflies = useMemo(() => {
    return Array.from({ length: 22 }, (_, i) => ({
      x: seededUnit(i, 10),
      y: 0.42 + seededUnit(i, 11) * 0.48,
      speed: 0.00012 + seededUnit(i, 12) * 0.00018,
      phase: seededUnit(i, 13) * Math.PI * 2,
      amp: 0.04 + seededUnit(i, 14) * 0.06,
      r: seededUnit(i, 15) * 1.4 + 0.8,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const layers = [
      {
        color: "#1a4a26",
        speed: 0.18,
        opacity: 1,
        peaks: [0, 0.72, 0.14, 0.52, 0.28, 0.60, 0.42, 0.45, 0.56, 0.58, 0.70, 0.54, 0.84, 0.63, 1.0, 0.72],
      },
      {
        color: "#245c30",
        speed: 0.40,
        opacity: 0.97,
        peaks: [0, 0.76, 0.10, 0.60, 0.22, 0.52, 0.36, 0.66, 0.50, 0.56, 0.64, 0.70, 0.78, 0.62, 0.92, 0.75, 1.0, 0.76],
      },
      {
        color: "#2d6b39",
        speed: 0.72,
        opacity: 0.94,
        peaks: [0, 0.80, 0.12, 0.68, 0.26, 0.60, 0.40, 0.72, 0.54, 0.64, 0.68, 0.74, 0.82, 0.68, 0.96, 0.78, 1.0, 0.80],
      },
      {
        color: "#377a42",
        speed: 1.10,
        opacity: 0.92,
        peaks: [0, 0.84, 0.16, 0.74, 0.32, 0.68, 0.48, 0.78, 0.64, 0.72, 0.80, 0.80, 1.0, 0.84],
      },
      {
        color: "#3f8a4a",
        speed: 1.60,
        opacity: 0.88,
        peaks: [0, 0.88, 0.20, 0.80, 0.40, 0.76, 0.60, 0.84, 0.80, 0.88, 1.0, 0.88],
      },
    ];

    let t = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      w = canvas.offsetWidth || 800;
      h = canvas.offsetHeight || 500;
      const ratio = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawLayer = (layer: typeof layers[0], offset: number) => {
      const { peaks, color, opacity } = layer;
      const wrapOffset = ((offset % w) + w) % w;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;

      for (let pass = 0; pass < 2; pass += 1) {
        const ox = wrapOffset - w * pass;
        ctx.beginPath();
        ctx.moveTo(ox + peaks[0] * w, h);

        for (let i = 0; i < peaks.length - 2; i += 2) {
          const x0 = ox + peaks[i] * w;
          const y0 = peaks[i + 1] * h;
          const x1 = ox + peaks[i + 2] * w;
          const y1 = peaks[i + 3] * h;
          const mx = (x0 + x1) / 2;
          const my = (y0 + y1) / 2;
          const sway = Math.sin(t * 0.4 + i * 0.7 + pass) * (h * 0.008);
          ctx.quadraticCurveTo(x0, y0 + sway, mx, my);
        }

        const lastPeakX = ox + peaks[peaks.length - 2] * w;
        ctx.lineTo(lastPeakX, h);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#020805");
      sky.addColorStop(0.5, "#050e07");
      sky.addColorStop(1, "#080f09");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const moonX = w * 0.82;
      const moonY = h * 0.18;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, h * 0.22);
      moonGlow.addColorStop(0, `rgba(255,200,100,${0.055 + Math.sin(t * 0.3) * 0.015})`);
      moonGlow.addColorStop(1, "rgba(255,200,100,0)");
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, w, h);

      stars.forEach((s) => {
        const flicker = prefersReduced ? 0.55 : 0.3 + Math.sin(t * 1.2 + s.phase) * 0.25;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,248,230,${flicker})`;
        ctx.fill();
      });

      layers.forEach((layer) => {
        const offset = prefersReduced ? 0 : -((t * layer.speed * 18) % w);
        drawLayer(layer, offset);
      });

      const fireX = w * 0.5;
      const fireY = h * 0.96;
      const fireGlow = ctx.createRadialGradient(fireX, fireY, 0, fireX, fireY, w * 0.28);
      const pulseIntensity = prefersReduced ? 0.18 : 0.14 + Math.sin(t * 2.2) * 0.05;
      fireGlow.addColorStop(0, `rgba(255,140,66,${pulseIntensity})`);
      fireGlow.addColorStop(0.5, `rgba(255,100,30,${pulseIntensity * 0.4})`);
      fireGlow.addColorStop(1, "rgba(255,140,66,0)");
      ctx.fillStyle = fireGlow;
      ctx.fillRect(0, 0, w, h);

      if (!prefersReduced) {
        fireflies.forEach((ff) => {
          ff.x = (ff.x + ff.speed) % 1;
          const px = ff.x * w;
          const py = ff.y * h + Math.sin(t * 1.1 + ff.phase) * ff.amp * h;
          const alpha = 0.35 + Math.sin(t * 1.8 + ff.phase) * 0.3;
          ctx.beginPath();
          ctx.arc(px, py, ff.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,200,80,${Math.max(0, alpha)})`;
          ctx.fill();
        });
      }

      t += 0.016;
      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [stars, fireflies, prefersReduced]);

  return <canvas ref={canvasRef} className={styles.purposeDepthCanvas} aria-hidden="true" />;
}
