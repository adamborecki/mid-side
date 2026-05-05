// Entry point: wires tabs, advanced toggle, and renders the active panel on demand.

import { initTabs } from "./ui/tabs.js";
import { initAdvancedToggle } from "./ui/advancedToggle.js";
import { initAudioGate } from "./ui/audioGate.js";
import { buildTransport } from "./ui/transport.js";
import { renderPlayground } from "./ui/playground.js";
import { renderLessons } from "./ui/lessons.js";
import { renderQuiz } from "./ui/quiz.js";
import { renderChallenge } from "./ui/challenge.js";
import { engine } from "./audio/engine.js";

const RENDERERS = {
  lessons: renderLessons,
  playground: renderPlayground,
  quiz: renderQuiz,
  challenge: renderChallenge,
};

const renderedOnce = new Set();

function renderTab(name) {
  const panel = document.getElementById(`panel-${name}`);
  if (!panel) return;
  // Always re-render quiz/challenge to reset their flow; lessons & playground
  // can stay alive after first render to keep their canvases attached.
  if (name === "quiz" || name === "challenge" || !renderedOnce.has(name)) {
    RENDERERS[name](panel);
    renderedOnce.add(name);
  }
}

initAdvancedToggle();
const { activate } = initTabs("lessons");

window.addEventListener("tab:change", (e) => {
  renderTab(e.detail.name);
});

window.addEventListener("advanced:change", () => {
  // Re-render the currently visible tab so advanced/beginner content updates.
  const visible = ["lessons", "playground", "quiz", "challenge"].find((n) =>
    !document.getElementById(`panel-${n}`).classList.contains("hidden")
  );
  if (visible) {
    // Force re-render of lessons since it has body innerHTML with conditional copy.
    if (visible === "lessons" || visible === "quiz") {
      renderedOnce.delete(visible);
      renderTab(visible);
    }
  }
});

// initial render of the visible tab
const initialTab = ["lessons", "playground", "quiz", "challenge"].find((n) =>
  !document.getElementById(`panel-${n}`).classList.contains("hidden")
) || "lessons";
renderTab(initialTab);

// Show the explicit "Start audio" gate. Mobile browsers (especially iOS
// Safari) require a deliberate tap on a control inside the gesture chain.
initAudioGate();

// Mount the global transport bar (Play/Stop, source, Bypass, Mono check).
// Hidden while the audio gate is up, since none of those controls work yet.
const transportHost = document.getElementById("global-transport");
transportHost.appendChild(buildTransport({ showSource: true, showBypass: true, showMono: true }));
if (!engine.audioUnlocked) transportHost.classList.add("is-locked");
window.addEventListener("audio:unlocked", () => transportHost.classList.remove("is-locked"));

// Dev-only round-trip null assertion: when engine starts up flat, encoding
// and decoding should reproduce the input. We don't pipe to the speakers — we
// run a tiny offline render and log the peak error.
runRoundTripCheck().catch((e) => console.warn("round-trip check failed", e));

async function runRoundTripCheck() {
  try {
    const { Engine } = await import("./audio/engine.js");
    // Use a small offline check inline rather than a full Engine instance.
    const sr = 48000;
    const len = sr * 0.05;
    const offline = new OfflineAudioContext(2, len, sr);
    const { createEncoder, createDecoder } = await import("./audio/msMatrix.js");
    const enc = createEncoder(offline);
    const dec = createDecoder(offline);

    // synth source: stereo tones, different per channel
    const src = offline.createBufferSource();
    const buf = offline.createBuffer(2, len, sr);
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    for (let i = 0; i < len; i++) {
      L[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sr);
      R[i] = 0.5 * Math.sin(2 * Math.PI * 660 * i / sr + 1.0);
    }
    src.buffer = buf;
    src.connect(enc.input);
    enc.output.connect(dec.input);
    dec.output.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    const eL = rendered.getChannelData(0);
    const eR = rendered.getChannelData(1);
    let maxErr = 0;
    for (let i = 0; i < len; i++) {
      maxErr = Math.max(maxErr, Math.abs(eL[i] - L[i]), Math.abs(eR[i] - R[i]));
    }
    const errDb = maxErr > 0 ? 20 * Math.log10(maxErr) : -Infinity;
    console.info(`[M/S round-trip] peak error = ${maxErr.toExponential(2)} (${errDb.toFixed(1)} dBFS)`);
    if (maxErr > 1e-5) console.warn("M/S round-trip exceeds expected error threshold");
  } catch (e) {
    console.warn(e);
  }
}
