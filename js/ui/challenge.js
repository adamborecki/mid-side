// Challenge: scenario tasks. Each scenario sets up a source, asks the user to
// dial in a target, then collects a short reflection. At the end we generate a
// shareable text summary.

import { engine } from "../audio/engine.js";
import { makeSlider, makeToggleButton, showToast } from "./controls.js";
import { buildVisualizerGrid } from "./visualizerPanel.js";

const SCENARIOS = [
  {
    id: "tighter-bass",
    title: "Tighten the bass without losing width",
    setup: { sourceId: "mix" },
    brief: `The mix has a wide pad and a centered bass. Right now the low end of the sides is muddy.
    Use the Side EQ to clean it up <em>without</em> narrowing the pad.`,
    targetHint: "Try cutting around 100–200 Hz on the Side bus only.",
    prompts: ["What did you do, and how do you know it worked?"],
  },
  {
    id: "more-air",
    title: "Open up the top end on the sides",
    setup: { sourceId: "mix" },
    brief: `The mix sounds a little dull. You want sparkle <em>only</em> on the sides — leave the vocal-y center alone.`,
    targetHint: "Boost above 8 kHz on the Side bus.",
    prompts: ["Did you push it wider on purpose? Why or why not?"],
  },
  {
    id: "mono-safe",
    title: "Mono-proof the mix",
    setup: { sourceId: "mix" },
    brief: `Imagine this mix is going to play on a phone speaker. Engage Mono check and listen.
    Then adjust width and Side EQ until you're happy with both the stereo and the mono version.`,
    targetHint: "Check that the correlation meter stays mostly positive.",
    prompts: ["What disappeared in mono? What setting fixed it?"],
  },
];

export function renderChallenge(panel) {
  panel.innerHTML = "";

  const root = document.createElement("div");
  root.className = "col";
  panel.appendChild(root);

  const intro = document.createElement("div");
  intro.className = "card";
  intro.innerHTML = `<h1>Challenge</h1>
    <p class="dim">${SCENARIOS.length} short scenarios. Each one gives you a goal — dial it in,
    explain what you did, then export a summary you can share.</p>`;
  root.appendChild(intro);

  const responses = SCENARIOS.map((s) => ({ id: s.id, text: "", snapshot: null }));

  let idx = 0;

  const card = document.createElement("div");
  card.className = "card";
  root.appendChild(card);

  function renderScenario() {
    card.innerHTML = "";
    if (idx >= SCENARIOS.length) {
      renderFinal();
      return;
    }
    const s = SCENARIOS[idx];

    if (s.setup) applySetup(s.setup);

    const head = document.createElement("div");
    head.className = "row";
    head.style.justifyContent = "space-between";
    head.innerHTML = `<span class="dim">Scenario ${idx + 1} / ${SCENARIOS.length}</span>
      <span class="dim">${s.title}</span>`;
    card.appendChild(head);

    const wrap = document.createElement("div");
    wrap.className = "scenario";

    const title = document.createElement("h2");
    title.textContent = s.title;
    wrap.appendChild(title);

    const brief = document.createElement("div");
    brief.innerHTML = s.brief;
    wrap.appendChild(brief);

    const hint = document.createElement("div");
    hint.className = "callout";
    hint.innerHTML = `<strong>Hint:</strong> ${s.targetHint}`;
    wrap.appendChild(hint);

    // quick controls + viz grid
    const controlsCard = document.createElement("div");
    controlsCard.className = "card";
    const transport = document.createElement("div");
    transport.className = "transport";
    const playBtn = document.createElement("button");
    playBtn.className = "btn primary";
    playBtn.textContent = engine.state.playing ? "Stop" : "Play";
    playBtn.addEventListener("click", async () => { await engine.toggle(); playBtn.textContent = engine.state.playing ? "Stop" : "Play"; });
    transport.appendChild(playBtn);

    transport.appendChild(makeToggleButton({
      label: "Bypass",
      pressed: engine.state.bypass,
      onChange: (v) => engine.setBypass(v),
    }).el);
    transport.appendChild(makeToggleButton({
      label: "Mono check",
      pressed: engine.state.monoSum,
      onChange: (v) => engine.setMonoSum(v),
    }).el);
    controlsCard.appendChild(transport);

    const sliders = document.createElement("div");
    sliders.className = "row";
    sliders.appendChild(makeSlider({
      label: "Width", min: 0, max: 2, step: 0.01, value: engine.state.width,
      format: (v) => `${(v * 100).toFixed(0)}%`,
      onInput: (v) => engine.setWidth(v),
      className: "side",
    }).el);
    sliders.appendChild(makeSlider({
      label: "Side low gain", min: -18, max: 18, step: 0.1, value: engine.state.side.lowGain,
      format: (v) => `${v.toFixed(1)} dB`,
      onInput: (v) => engine.setEq("side", { lowGain: v }),
      className: "side",
    }).el);
    sliders.appendChild(makeSlider({
      label: "Side high gain", min: -18, max: 18, step: 0.1, value: engine.state.side.highGain,
      format: (v) => `${v.toFixed(1)} dB`,
      onInput: (v) => engine.setEq("side", { highGain: v }),
      className: "side",
    }).el);
    sliders.appendChild(makeSlider({
      label: "Mid high gain", min: -18, max: 18, step: 0.1, value: engine.state.mid.highGain,
      format: (v) => `${v.toFixed(1)} dB`,
      onInput: (v) => engine.setEq("mid", { highGain: v }),
      className: "mid",
    }).el);
    controlsCard.appendChild(sliders);

    wrap.appendChild(controlsCard);
    wrap.appendChild(buildVisualizerGrid(engine, { include: ["goniometer", "imageArc", "correlation", "spectrum"] }));

    s.prompts.forEach((p, i) => {
      const lab = document.createElement("label");
      lab.style.display = "block";
      lab.style.marginTop = "8px";
      lab.textContent = p;
      const ta = document.createElement("textarea");
      ta.value = responses[idx].text || "";
      ta.addEventListener("input", () => responses[idx].text = ta.value);
      lab.appendChild(ta);
      wrap.appendChild(lab);
    });

    const nextRow = document.createElement("div");
    nextRow.className = "lesson-progress";
    const prev = document.createElement("button");
    prev.className = "btn";
    prev.textContent = "← Previous";
    prev.disabled = idx === 0;
    prev.addEventListener("click", () => { idx--; renderScenario(); });
    const next = document.createElement("button");
    next.className = "btn primary";
    next.textContent = idx === SCENARIOS.length - 1 ? "Finish & summarize" : "Next →";
    next.addEventListener("click", () => {
      // snapshot current settings for the summary
      responses[idx].snapshot = snapshotEngineState();
      idx++;
      renderScenario();
    });
    nextRow.appendChild(prev);
    nextRow.appendChild(next);
    wrap.appendChild(nextRow);

    card.appendChild(wrap);
  }

  function renderFinal() {
    card.innerHTML = "";
    const h = document.createElement("h2");
    h.textContent = "Your challenge summary";
    card.appendChild(h);

    const summary = buildSummary(responses);
    const pre = document.createElement("pre");
    pre.className = "share-output";
    pre.textContent = summary;
    card.appendChild(pre);

    const row = document.createElement("div");
    row.className = "row";
    const copy = document.createElement("button");
    copy.className = "btn primary";
    copy.textContent = "Copy summary";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(summary);
        showToast("Copied to clipboard");
      } catch {
        showToast("Couldn't copy — select and copy manually.");
      }
    });
    const restart = document.createElement("button");
    restart.className = "btn";
    restart.textContent = "Start over";
    restart.addEventListener("click", () => { idx = 0; responses.forEach((r) => { r.text = ""; r.snapshot = null; }); renderScenario(); });
    row.appendChild(copy); row.appendChild(restart);
    card.appendChild(row);
  }

  renderScenario();
}

let _lastChallengeSource = null;
let _challengeGen = 0;

async function applySetup({ sourceId }) {
  _lastChallengeSource = sourceId;
  const myGen = ++_challengeGen;
  engine.resetAll();
  if (sourceId && sourceId !== engine.state.sourceId) await engine.setSource(sourceId);
  if (myGen !== _challengeGen) return;
  if (!engine.state.playing && engine.audioUnlocked) await engine.play();
}

window.addEventListener("audio:unlocked", () => {
  // Only retry if the Challenge tab is currently visible — otherwise lessons
  // (or another tab) owns the active setup.
  const challengePanel = document.getElementById("panel-challenge");
  if (challengePanel && !challengePanel.classList.contains("hidden") && _lastChallengeSource) {
    applySetup({ sourceId: _lastChallengeSource });
  }
});

function snapshotEngineState() {
  const s = engine.state;
  return {
    width: s.width,
    midGain: s.midGain,
    sideGain: s.sideGain,
    bypass: s.bypass,
    monoSum: s.monoSum,
    mid: { ...s.mid },
    side: { ...s.side },
  };
}

function buildSummary(responses) {
  const lines = [];
  lines.push("Mid-Side Lab — Challenge summary");
  lines.push("================================");
  lines.push(new Date().toLocaleString());
  lines.push("");
  responses.forEach((r, i) => {
    const s = SCENARIOS[i];
    lines.push(`${i + 1}. ${s.title}`);
    lines.push("-".repeat(s.title.length + 3));
    if (r.snapshot) {
      const sn = r.snapshot;
      lines.push(`   Width:    ${(sn.width * 100).toFixed(0)}%`);
      lines.push(`   Mid gain: ${(sn.midGain * 100).toFixed(0)}%`);
      lines.push(`   Mid EQ:   low ${sn.mid.lowGain.toFixed(1)} dB / mid ${sn.mid.midGain.toFixed(1)} dB / high ${sn.mid.highGain.toFixed(1)} dB`);
      lines.push(`   Side EQ:  low ${sn.side.lowGain.toFixed(1)} dB / mid ${sn.side.midGain.toFixed(1)} dB / high ${sn.side.highGain.toFixed(1)} dB`);
    }
    lines.push(`   Notes: ${r.text || "(no notes)"}`);
    lines.push("");
  });
  return lines.join("\n");
}
