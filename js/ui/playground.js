// Playground: full interactive M/S surface with all visualizers.

import { engine, SOURCE_DEFS } from "../audio/engine.js";
import { makeSlider, makeToggleButton, showToast } from "./controls.js";
import { buildVisualizerGrid } from "./visualizerPanel.js";

const PRESETS = {
  reset: { width: 1, midGain: 1, sideGain: 1, mid: { lowGain: 0, midGain: 0, highGain: 0 }, side: { lowGain: 0, midGain: 0, highGain: 0 } },
  wider: { width: 1.6, midGain: 1, sideGain: 1, mid: { lowGain: 0 }, side: { highFreq: 8000, highGain: 3 } },
  tighterBass: { width: 1, midGain: 1, sideGain: 1, mid: { lowGain: 0 }, side: { lowFreq: 180, lowGain: -10 } },
  airOnSides: { width: 1.2, midGain: 1, sideGain: 1, mid: { highGain: 0 }, side: { highFreq: 10000, highGain: 5 } },
  monoCheck: { width: 0, midGain: 1, sideGain: 1 },
};

export function renderPlayground(panel) {
  panel.innerHTML = "";

  const root = document.createElement("div");
  root.className = "col";
  panel.appendChild(root);

  // ===== Header / transport =====
  const header = document.createElement("div");
  header.className = "card";
  root.appendChild(header);

  const title = document.createElement("h1");
  title.textContent = "Playground";
  const sub = document.createElement("p");
  sub.className = "dim";
  sub.textContent = "Pick a sound, press play, and explore. Everything updates in real time.";
  header.appendChild(title);
  header.appendChild(sub);

  const transport = document.createElement("div");
  transport.className = "transport";
  header.appendChild(transport);

  const playBtn = document.createElement("button");
  playBtn.className = "btn primary";
  playBtn.textContent = "Play";
  playBtn.addEventListener("click", async () => {
    await engine.toggle();
  });
  transport.appendChild(playBtn);

  const sourceSel = document.createElement("select");
  sourceSel.className = "input";
  for (const s of SOURCE_DEFS) {
    const o = document.createElement("option");
    o.value = s.id; o.textContent = s.label; sourceSel.appendChild(o);
  }
  sourceSel.value = engine.state.sourceId;
  sourceSel.addEventListener("change", () => engine.setSource(sourceSel.value));
  transport.appendChild(sourceSel);

  const bypassToggle = makeToggleButton({
    label: "Bypass",
    pressed: engine.state.bypass,
    onChange: (v) => engine.setBypass(v),
  });
  const monoToggle = makeToggleButton({
    label: "Mono check",
    pressed: engine.state.monoSum,
    onChange: (v) => engine.setMonoSum(v),
  });
  transport.appendChild(bypassToggle.el);
  transport.appendChild(monoToggle.el);

  const resetBtn = document.createElement("button");
  resetBtn.className = "btn";
  resetBtn.textContent = "Reset all";
  resetBtn.addEventListener("click", () => { engine.resetAll(); rerenderControls(); });
  transport.appendChild(resetBtn);

  // ===== Presets =====
  const presetCard = document.createElement("div");
  presetCard.className = "card";
  root.appendChild(presetCard);
  const presetTitle = document.createElement("h2");
  presetTitle.textContent = "Quick presets";
  presetCard.appendChild(presetTitle);

  const presetRow = document.createElement("div");
  presetRow.className = "preset-row";
  const presetButtons = [
    { id: "wider", label: "Wider mix" },
    { id: "tighterBass", label: "Tighter bass" },
    { id: "airOnSides", label: "Air on sides" },
    { id: "monoCheck", label: "Mono check" },
    { id: "reset", label: "Reset" },
  ];
  presetButtons.forEach(({ id, label }) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = label;
    b.addEventListener("click", () => { applyPreset(id); rerenderControls(); showToast(`Loaded "${label}"`); });
    presetRow.appendChild(b);
  });
  presetCard.appendChild(presetRow);

  // ===== M/S controls =====
  const controlsRow = document.createElement("div");
  controlsRow.className = "row";
  root.appendChild(controlsRow);

  // Mid bus
  const midCard = document.createElement("div");
  midCard.className = "card bus-block mid";
  midCard.style.flex = "1 1 320px";
  controlsRow.appendChild(midCard);
  midCard.appendChild(headerH2("Mid (center)"));
  const midSoloBtn = makeToggleButton({
    label: "Solo mid",
    pressed: engine.state.midSolo,
    onChange: (v) => engine.setMidSolo(v),
  });
  const midGainSlider = makeSlider({
    label: "Mid gain", min: 0, max: 2, step: 0.01, value: engine.state.midGain,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    onInput: (v) => engine.setMidGain(v),
    className: "mid",
  });
  const midTopRow = document.createElement("div");
  midTopRow.className = "row bus-top-row";
  midTopRow.appendChild(midGainSlider.el);
  midTopRow.appendChild(midSoloBtn.el);
  midCard.appendChild(midTopRow);
  const midEq = buildEqGroup("mid", engine.state.mid);
  midCard.appendChild(midEq.el);

  // Side bus
  const sideCard = document.createElement("div");
  sideCard.className = "card bus-block side";
  sideCard.style.flex = "1 1 320px";
  controlsRow.appendChild(sideCard);
  sideCard.appendChild(headerH2("Side (stereo difference)"));

  const widthSlider = makeSlider({
    label: "Width (Side gain)", min: 0, max: 2, step: 0.01, value: engine.state.width,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    onInput: (v) => engine.setWidth(v),
    className: "side",
  });
  const sideSoloBtn = makeToggleButton({
    label: "Solo side",
    pressed: engine.state.sideSolo,
    onChange: (v) => engine.setSideSolo(v),
  });
  const sideTopRow = document.createElement("div");
  sideTopRow.className = "row bus-top-row";
  sideTopRow.appendChild(widthSlider.el);
  sideTopRow.appendChild(sideSoloBtn.el);
  sideCard.appendChild(sideTopRow);
  const sideEq = buildEqGroup("side", engine.state.side);
  sideCard.appendChild(sideEq.el);

  // ===== Visualizers =====
  root.appendChild(buildVisualizerGrid(engine));

  // ===== State sync =====
  const refs = { playBtn, sourceSel, bypassToggle, monoToggle, midSoloBtn, sideSoloBtn, midGainSlider, widthSlider, midEq, sideEq };
  const unsub = engine.on(() => syncFromState(refs));
  syncFromState(refs);

  // when panel is replaced, listeners are dropped via unsub call below — but
  // since we re-render on every tab switch, just leave it; old refs detach
  // when their canvases are removed and rAF subscribers are weak via the
  // fitCanvas check (canvases not in DOM still tick — small cost, acceptable).

  function rerenderControls() { syncFromState(refs); }

  function applyPreset(id) {
    const p = PRESETS[id];
    if (!p) return;
    if ("width" in p) engine.setWidth(p.width);
    if ("midGain" in p) engine.setMidGain(p.midGain);
    if ("sideGain" in p) engine.setSideGain(p.sideGain);
    if (p.mid) engine.setEq("mid", { ...p.mid });
    if (p.side) engine.setEq("side", { ...p.side });
  }
}

function headerH2(text) { const h = document.createElement("h2"); h.textContent = text; return h; }

function buildEqGroup(bus, store) {
  const group = document.createElement("div");
  group.className = "eq-group";

  const lowFreq = makeSlider({
    label: "Low freq", min: 60, max: 400, step: 1, value: store.lowFreq,
    format: (v) => `${Math.round(v)} Hz`,
    onInput: (v) => engine.setEq(bus, { lowFreq: v }),
    className: bus,
  });
  const lowGain = makeSlider({
    label: "Low gain", min: -18, max: 18, step: 0.1, value: store.lowGain,
    format: (v) => `${v.toFixed(1)} dB`,
    onInput: (v) => engine.setEq(bus, { lowGain: v }),
    className: bus,
  });

  const midFreq = makeSlider({
    label: "Mid freq", min: 200, max: 6000, step: 1, value: store.midFreq,
    format: (v) => v >= 1000 ? `${(v / 1000).toFixed(2)} kHz` : `${Math.round(v)} Hz`,
    onInput: (v) => engine.setEq(bus, { midFreq: v }),
    className: bus,
  });
  const midGain = makeSlider({
    label: "Mid gain", min: -18, max: 18, step: 0.1, value: store.midGain,
    format: (v) => `${v.toFixed(1)} dB`,
    onInput: (v) => engine.setEq(bus, { midGain: v }),
    className: bus,
  });

  const highFreq = makeSlider({
    label: "High freq", min: 2000, max: 16000, step: 10, value: store.highFreq,
    format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`,
    onInput: (v) => engine.setEq(bus, { highFreq: v }),
    className: bus,
  });
  const highGain = makeSlider({
    label: "High gain", min: -18, max: 18, step: 0.1, value: store.highGain,
    format: (v) => `${v.toFixed(1)} dB`,
    onInput: (v) => engine.setEq(bus, { highGain: v }),
    className: bus,
  });

  // Layout: each column = freq above gain
  const col1 = document.createElement("div"); col1.className = "col";
  col1.appendChild(lowFreq.el); col1.appendChild(lowGain.el);
  const col2 = document.createElement("div"); col2.className = "col";
  col2.appendChild(midFreq.el); col2.appendChild(midGain.el);
  const col3 = document.createElement("div"); col3.className = "col";
  col3.appendChild(highFreq.el); col3.appendChild(highGain.el);
  group.appendChild(col1); group.appendChild(col2); group.appendChild(col3);

  return {
    el: group,
    sync(state) {
      lowFreq.set(state.lowFreq); lowGain.set(state.lowGain);
      midFreq.set(state.midFreq); midGain.set(state.midGain);
      highFreq.set(state.highFreq); highGain.set(state.highGain);
    },
  };
}

function syncFromState(refs) {
  const s = engine.state;
  refs.playBtn.textContent = s.playing ? "Stop" : "Play";
  refs.sourceSel.value = s.sourceId;
  refs.bypassToggle.set(s.bypass);
  refs.monoToggle.set(s.monoSum);
  refs.midSoloBtn.set(s.midSolo);
  refs.sideSoloBtn.set(s.sideSolo);
  refs.midGainSlider.set(s.midGain);
  refs.widthSlider.set(s.width);
  refs.midEq.sync(s.mid);
  refs.sideEq.sync(s.side);
}
