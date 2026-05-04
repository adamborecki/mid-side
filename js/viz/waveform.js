// Time-domain strips. Mode 'lr' draws L (top) and R (bottom).
// Mode 'ms' draws M (top) and S (bottom).

import { fitCanvas } from "./canvas.js";
import { subscribe } from "./raf.js";

export function attachWaveform(canvas, analyserPair, { mode = "lr" } = {}) {
  const ctx = canvas.getContext("2d");
  const buf1 = new Float32Array(analyserPair.L.fftSize);
  const buf2 = new Float32Array(analyserPair.R.fftSize);

  const draw = () => {
    const { dpr, w, h } = fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    analyserPair.L.getFloatTimeDomainData(buf1);
    analyserPair.R.getFloatTimeDomainData(buf2);

    const half = h / 2;

    // top channel
    ctx.strokeStyle = mode === "ms" ? "#58a6ff" : "rgba(230, 237, 243, 0.7)";
    ctx.lineWidth = 1;
    drawStrip(ctx, buf1, 0, half, w);
    // divider
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, half, w, 1);
    // bottom channel
    ctx.strokeStyle = mode === "ms" ? "#f78166" : "rgba(230, 237, 243, 0.7)";
    drawStrip(ctx, buf2, half, half, w);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillText(mode === "ms" ? "M" : "L", 4, 12);
    ctx.fillText(mode === "ms" ? "S" : "R", 4, half + 12);
  };

  return subscribe(draw);
}

function drawStrip(ctx, buf, yOffset, h, w) {
  ctx.beginPath();
  const mid = yOffset + h / 2;
  for (let i = 0; i < w; i++) {
    const idx = Math.floor((i / w) * buf.length);
    const v = buf[idx];
    const y = mid - v * (h / 2 - 2);
    if (i === 0) ctx.moveTo(i, y);
    else ctx.lineTo(i, y);
  }
  ctx.stroke();
}
