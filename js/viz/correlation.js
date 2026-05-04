// Phase correlation meter: -1 (out of phase) to +1 (mono).
// corr = sum(L*R) / sqrt(sum(L^2) * sum(R^2))

import { fitCanvas } from "./canvas.js";
import { subscribe } from "./raf.js";

export function attachCorrelation(canvas, analyserPair, captionEl) {
  const ctx = canvas.getContext("2d");
  const bufL = new Float32Array(analyserPair.L.fftSize);
  const bufR = new Float32Array(analyserPair.R.fftSize);

  let smoothed = 1;

  const draw = () => {
    const { dpr, w, h } = fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    analyserPair.L.getFloatTimeDomainData(bufL);
    analyserPair.R.getFloatTimeDomainData(bufR);

    let dot = 0, sl = 0, sr = 0;
    for (let i = 0; i < bufL.length; i++) {
      dot += bufL[i] * bufR[i];
      sl += bufL[i] * bufL[i];
      sr += bufR[i] * bufR[i];
    }
    const denom = Math.sqrt(sl * sr) || 1e-9;
    let corr = dot / denom;
    if (sl + sr < 1e-6) corr = 1; // silence → treat as mono
    if (!isFinite(corr)) corr = 0;
    corr = Math.max(-1, Math.min(1, corr));
    smoothed = smoothed + (corr - smoothed) * 0.15;

    // bar background
    const barH = 14;
    const padY = (h - barH) / 2;
    ctx.fillStyle = "#1c232d";
    ctx.fillRect(0, padY, w, barH);

    // zero line
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(w / 2, padY); ctx.lineTo(w / 2, padY + barH);
    ctx.stroke();

    // fill from center
    const half = w / 2;
    const fillW = Math.abs(smoothed) * half;
    let color;
    if (smoothed > 0.1) color = "#3fb950";
    else if (smoothed > -0.2) color = "#d29922";
    else color = "#f85149";
    ctx.fillStyle = color;
    if (smoothed >= 0) ctx.fillRect(half, padY, fillW, barH);
    else ctx.fillRect(half - fillW, padY, fillW, barH);

    // labels
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillText("−1", 4, padY - 3);
    ctx.fillText("0", w / 2 - 4, padY - 3);
    ctx.fillText("+1", w - 18, padY - 3);

    if (captionEl) {
      const v = smoothed.toFixed(2);
      let label = "wide";
      if (smoothed > 0.85) label = "near-mono";
      else if (smoothed > 0.4) label = "narrow";
      else if (smoothed > 0) label = "balanced";
      else if (smoothed > -0.5) label = "very wide";
      else label = "out-of-phase risk";
      captionEl.textContent = `${v} (${label})`;
    }
  };

  return subscribe(draw);
}
