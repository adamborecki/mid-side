// Overlaid M vs S spectrum on a log frequency axis.

import { fitCanvas } from "./canvas.js";
import { subscribe } from "./raf.js";

const MIN_FREQ = 30;
const MAX_FREQ_DEFAULT = 18000;

export function attachSpectrum(canvas, msAnalyserPair) {
  const ctx = canvas.getContext("2d");
  const N = msAnalyserPair.L.frequencyBinCount;
  const bufM = new Uint8Array(N);
  const bufS = new Uint8Array(N);

  const draw = () => {
    const { dpr, w, h } = fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach((f) => {
      const x = freqToX(f, w);
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      ctx.stroke();
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
      ctx.fillText(label, x + 2, h - 2);
    });

    msAnalyserPair.L.getByteFrequencyData(bufM);
    msAnalyserPair.R.getByteFrequencyData(bufS);

    const sampleRate = msAnalyserPair.L.context.sampleRate;
    const nyquist = sampleRate / 2;

    drawCurve(ctx, w, h, bufS, nyquist, "#f78166", 0.18);
    drawCurve(ctx, w, h, bufM, nyquist, "#58a6ff", 0.10);

    // legend
    ctx.fillStyle = "#58a6ff"; ctx.fillRect(8, 8, 10, 10);
    ctx.fillStyle = "#f78166"; ctx.fillRect(8, 22, 10, 10);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText("Mid", 22, 17);
    ctx.fillText("Side", 22, 31);
  };

  return subscribe(draw);
}

function freqToX(f, w) {
  const minLog = Math.log10(MIN_FREQ);
  const maxLog = Math.log10(MAX_FREQ_DEFAULT);
  return ((Math.log10(Math.max(MIN_FREQ, f)) - minLog) / (maxLog - minLog)) * w;
}

function drawCurve(ctx, w, h, data, nyquist, color, fillAlpha) {
  ctx.beginPath();
  let started = false;
  for (let i = 1; i < data.length; i++) {
    const f = (i / data.length) * nyquist;
    if (f < MIN_FREQ || f > MAX_FREQ_DEFAULT) continue;
    const x = freqToX(f, w);
    const y = h - (data[i] / 255) * (h - 4);
    if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
  }
  ctx.lineTo(w, h);
  ctx.lineTo(freqToX(MIN_FREQ, w), h);
  ctx.closePath();
  ctx.fillStyle = hexAlpha(color, fillAlpha);
  ctx.fill();

  ctx.beginPath();
  let s2 = false;
  for (let i = 1; i < data.length; i++) {
    const f = (i / data.length) * nyquist;
    if (f < MIN_FREQ || f > MAX_FREQ_DEFAULT) continue;
    const x = freqToX(f, w);
    const y = h - (data[i] / 255) * (h - 4);
    if (!s2) { ctx.moveTo(x, y); s2 = true; } else { ctx.lineTo(x, y); }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function hexAlpha(hex, a) {
  const v = Math.round(a * 255).toString(16).padStart(2, "0");
  return hex + v;
}
