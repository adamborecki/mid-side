// Builds the standard visualizer grid and wires it up to the engine's analysers.

import { attachGoniometer } from "../viz/goniometer.js";
import { attachCorrelation } from "../viz/correlation.js";
import { attachMeters } from "../viz/meters.js";
import { attachSpectrum } from "../viz/spectrum.js";
import { attachWaveform } from "../viz/waveform.js";
import { attachImageArc } from "../viz/imageArc.js";

export function buildVisualizerGrid(engine, { include = "all" } = {}) {
  const grid = document.createElement("div");
  grid.className = "viz-grid";

  const wants = (k) => include === "all" || include.includes(k);

  if (wants("goniometer")) {
    grid.appendChild(makeVizBlock({
      title: "Goniometer",
      caption: "Vertical line = mono. Horizontal cloud = wide. Diagonal line = one channel only.",
      width: 320, height: 240,
      attach: (canvas) => attachGoniometer(canvas, engine.outAnalyser),
    }));
  }
  if (wants("imageArc")) {
    grid.appendChild(makeVizBlock({
      title: "Stereo image",
      caption: "Top-down view of how wide the sound feels relative to the listener.",
      width: 320, height: 220,
      attach: (canvas) => attachImageArc(canvas, engine.msAnalyser),
    }));
  }
  if (wants("meters")) {
    grid.appendChild(makeVizBlock({
      title: "Mid & Side levels",
      caption: "Center info on the left, sides info on the right.",
      width: 200, height: 220,
      attach: (canvas) => attachMeters(canvas, engine.msAnalyser),
    }));
  }
  if (wants("correlation")) {
    grid.appendChild(makeVizBlock({
      title: "Phase correlation",
      caption: null,
      withCaption: true,
      width: 320, height: 80,
      attach: (canvas, capEl) => attachCorrelation(canvas, engine.outAnalyser, capEl),
    }));
  }
  if (wants("spectrum")) {
    grid.appendChild(makeVizBlock({
      title: "Spectrum (Mid vs Side)",
      caption: "Where center vs side energy lives across the frequency range.",
      width: 360, height: 220,
      attach: (canvas) => attachSpectrum(canvas, engine.msAnalyser),
    }));
  }
  if (wants("waveLR")) {
    grid.appendChild(makeVizBlock({
      title: "Waveform (L / R)",
      caption: "Original left and right channels over time.",
      width: 320, height: 140,
      attach: (canvas) => attachWaveform(canvas, engine.outAnalyser, { mode: "lr" }),
    }));
  }
  if (wants("waveMS")) {
    grid.appendChild(makeVizBlock({
      title: "Waveform (Mid / Side)",
      caption: "Same audio after M/S encoding.",
      width: 320, height: 140,
      attach: (canvas) => attachWaveform(canvas, engine.msAnalyser, { mode: "ms" }),
    }));
  }

  return grid;
}

function makeVizBlock({ title, caption, withCaption = false, width, height, attach }) {
  const wrap = document.createElement("div");
  wrap.className = "viz";
  const h3 = document.createElement("h3");
  h3.textContent = title;
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = `${height}px`;
  wrap.appendChild(h3);
  wrap.appendChild(canvas);
  let capEl = null;
  if (withCaption || caption) {
    capEl = document.createElement("div");
    capEl.className = "viz-caption";
    if (caption) capEl.textContent = caption;
    wrap.appendChild(capEl);
  }
  // attach lazily once it's in the DOM
  queueMicrotask(() => attach(canvas, capEl));
  return wrap;
}
