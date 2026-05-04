// Top-down "stereo image" diagram: a head facing forward, two speakers,
// and an arc that shrinks (mono) / expands (wide) based on the current
// correlation + side-vs-mid energy ratio.

import { fitCanvas } from "./canvas.js";
import { subscribe } from "./raf.js";

export function attachImageArc(canvas, msAnalyserPair) {
  const ctx = canvas.getContext("2d");
  const bufM = new Float32Array(msAnalyserPair.L.fftSize);
  const bufS = new Float32Array(msAnalyserPair.R.fftSize);
  let smoothedRatio = 0.5;

  const draw = () => {
    const { dpr, w, h } = fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    msAnalyserPair.L.getFloatTimeDomainData(bufM);
    msAnalyserPair.R.getFloatTimeDomainData(bufS);

    let mEnergy = 0, sEnergy = 0;
    for (let i = 0; i < bufM.length; i++) {
      mEnergy += bufM[i] * bufM[i];
      sEnergy += bufS[i] * bufS[i];
    }
    let ratio = sEnergy / (mEnergy + sEnergy + 1e-9); // 0 = pure mid, 1 = pure side
    if (mEnergy + sEnergy < 1e-6) ratio = 0;
    smoothedRatio = smoothedRatio + (ratio - smoothedRatio) * 0.1;

    // listener position
    const cx = w / 2;
    const cy = h * 0.78;
    const R = Math.min(w, h) * 0.36;

    // arc representing perceived spread, from -90° (left) to +90° (right)
    // narrower when side-energy ratio is low
    const spread = 0.25 + smoothedRatio * 0.95; // 0.25..1.2
    const halfAngle = (Math.PI / 2) * Math.min(1, spread);
    const startAngle = -Math.PI / 2 - halfAngle;
    const endAngle = -Math.PI / 2 + halfAngle;

    // soundfield arc fill
    const grad = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R);
    grad.addColorStop(0, "rgba(247, 129, 102, 0.0)");
    grad.addColorStop(1, "rgba(247, 129, 102, 0.35)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    // arc outline
    ctx.strokeStyle = "rgba(247, 129, 102, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, startAngle, endAngle);
    ctx.stroke();

    // mid axis (front)
    ctx.strokeStyle = "rgba(88, 166, 255, 0.55)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - R);
    ctx.stroke();
    ctx.setLineDash([]);

    // speakers (fixed at -30°, +30° from center)
    drawSpeaker(ctx, cx + Math.sin(-Math.PI / 6) * R * 0.85, cy - Math.cos(-Math.PI / 6) * R * 0.85, "L");
    drawSpeaker(ctx, cx + Math.sin(Math.PI / 6) * R * 0.85, cy - Math.cos(Math.PI / 6) * R * 0.85, "R");

    // listener head
    ctx.fillStyle = "#1c232d";
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 2, 0, Math.PI * 2);
    ctx.fill();

    // ratio readout
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "10px ui-monospace, monospace";
    const pct = Math.round(smoothedRatio * 100);
    ctx.fillText(`Side energy: ${pct}%`, 8, 14);
  };

  return subscribe(draw);
}

function drawSpeaker(ctx, x, y, label) {
  ctx.fillStyle = "#161b22";
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(x - 8, y - 10, 16, 20);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "bold 10px ui-monospace, monospace";
  ctx.fillText(label, x - 3, y + 22);
}
