// Mid & Side level meters: peak + RMS in dBFS.
// Driven from the M/S analyser (M on ch0, S on ch1).

import { fitCanvas } from "./canvas.js";
import { subscribe } from "./raf.js";

const MIN_DB = -60;

export function attachMeters(canvas, msAnalyserPair) {
  const ctx = canvas.getContext("2d");
  const bufM = new Float32Array(msAnalyserPair.L.fftSize);
  const bufS = new Float32Array(msAnalyserPair.R.fftSize);
  const peakHold = { M: -Infinity, S: -Infinity, mt: 0, st: 0 };

  const draw = () => {
    const { dpr, w, h } = fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    msAnalyserPair.L.getFloatTimeDomainData(bufM);
    msAnalyserPair.R.getFloatTimeDomainData(bufS);

    const stats = (data) => {
      let peak = 0, sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        const a = Math.abs(data[i]);
        if (a > peak) peak = a;
        sumSq += data[i] * data[i];
      }
      const rms = Math.sqrt(sumSq / data.length);
      return {
        peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
        rmsDb: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
      };
    };

    const m = stats(bufM);
    const s = stats(bufS);

    const now = performance.now();
    if (m.peakDb > peakHold.M || now - peakHold.mt > 1500) { peakHold.M = m.peakDb; peakHold.mt = now; }
    if (s.peakDb > peakHold.S || now - peakHold.st > 1500) { peakHold.S = s.peakDb; peakHold.st = now; }

    drawBar(ctx, 0, 0, w / 2 - 6, h, "M", m.rmsDb, m.peakDb, peakHold.M, "#58a6ff");
    drawBar(ctx, w / 2 + 6, 0, w / 2 - 6, h, "S", s.rmsDb, s.peakDb, peakHold.S, "#f78166");
  };

  return subscribe(draw);
}

function dbToFrac(db) {
  if (!isFinite(db)) return 0;
  if (db <= MIN_DB) return 0;
  if (db >= 0) return 1;
  return (db - MIN_DB) / (0 - MIN_DB);
}

function drawBar(ctx, x, y, w, h, label, rmsDb, peakDb, holdDb, color) {
  // background
  ctx.fillStyle = "#1c232d";
  ctx.fillRect(x, y, w, h);

  // tick marks every 6 dB
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let db = -6; db >= MIN_DB; db -= 6) {
    const f = dbToFrac(db);
    const ty = y + h - h * f;
    ctx.fillRect(x, ty, w, 1);
  }

  // RMS bar
  const rmsF = dbToFrac(rmsDb);
  ctx.fillStyle = color + "aa";
  ctx.fillRect(x, y + h - h * rmsF, w, h * rmsF);

  // Peak line
  const peakF = dbToFrac(peakDb);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + h - h * peakF, w, 2);

  // Hold marker
  const holdF = dbToFrac(holdDb);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(x, y + h - h * holdF, w, 1);

  // Label
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.fillText(label, x + 4, y + 12);

  // dB readout
  const peakStr = isFinite(peakDb) ? peakDb.toFixed(1) : "-∞";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillText(peakStr, x + 4, y + h - 4);
}
