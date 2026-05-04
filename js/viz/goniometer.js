// XY (Lissajous) goniometer. Mid axis = up/down, Side axis = left/right.
// Plotted as M = (L+R)/sqrt(2) on Y, S = (L-R)/sqrt(2) on X for the classic
// "vertical line = mono, horizontal cloud = wide" look.

import { fitCanvas } from "./canvas.js";
import { subscribe } from "./raf.js";

export function attachGoniometer(canvas, analyserPair) {
  const ctx = canvas.getContext("2d");
  const buf = new Float32Array(analyserPair.L.fftSize);
  const buf2 = new Float32Array(analyserPair.R.fftSize);

  const draw = () => {
    const { dpr, w, h } = fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // trail
    ctx.fillStyle = "rgba(10, 13, 18, 0.45)";
    ctx.fillRect(0, 0, w, h);

    // axes
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.stroke();

    // diagonal labels (L/R axes)
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0);
    ctx.moveTo(0, 0); ctx.lineTo(w, h);
    ctx.stroke();

    analyserPair.L.getFloatTimeDomainData(buf);
    analyserPair.R.getFloatTimeDomainData(buf2);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.45;

    ctx.fillStyle = "rgba(88, 166, 255, 0.85)";
    for (let i = 0; i < buf.length; i += 2) {
      const L = buf[i];
      const R = buf2[i];
      const M = (L + R) * Math.SQRT1_2;
      const S = (L - R) * Math.SQRT1_2;
      const x = cx + S * radius;
      const y = cy - M * radius;
      ctx.fillRect(x, y, 1.2, 1.2);
    }

    // labels
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillText("M+", w / 2 + 4, 12);
    ctx.fillText("M−", w / 2 + 4, h - 4);
    ctx.fillText("S+", w - 16, h / 2 - 4);
    ctx.fillText("S−", 4, h / 2 - 4);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillText("L", 6, 12);
    ctx.fillText("R", w - 12, 12);
  };

  return subscribe(draw);
}
