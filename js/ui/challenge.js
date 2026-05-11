// Challenge: scenario tasks. Each scenario sets up a source, asks the user to
// dial in a target, then collects a short reflection. At the end we generate a
// shareable text summary.

import { engine } from "../audio/engine.js";
import { makeSlider, makeToggleButton, showToast } from "./controls.js";
import { buildVisualizerGrid } from "./visualizerPanel.js";
import { tracker, integrityHash, formatDuration } from "../util/tracker.js";

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
    explain what you did, then export a summary you can share.</p>
    <p class="dim">A copy-to-clipboard summary (with everything you did across all tabs) will appear here after you finish all ${SCENARIOS.length} scenarios.</p>`;
  root.appendChild(intro);

  tracker.resetChallenge();
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
      const snap = snapshotEngineState();
      responses[idx].snapshot = snap;
      tracker.recordChallengeSnapshot(s.id, snap, responses[idx].text);
      idx++;
      renderScenario();
    });
    nextRow.appendChild(prev);
    nextRow.appendChild(next);
    wrap.appendChild(nextRow);

    card.appendChild(wrap);
  }

  async function renderFinal() {
    card.innerHTML = "";
    const h = document.createElement("h2");
    h.textContent = "Your session summary";
    card.appendChild(h);

    const note = document.createElement("p");
    note.className = "dim";
    note.textContent = "Includes everything you've done across Lessons, Playground, Quiz, and Challenge — plus a SHA-256 integrity hash so a recipient can verify the payload hasn't been edited.";
    card.appendChild(note);

    const pre = document.createElement("pre");
    pre.className = "share-output";
    pre.textContent = "Computing integrity hash…";
    card.appendChild(pre);

    const summary = await buildSummary(responses);
    pre.textContent = summary;

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
    restart.addEventListener("click", () => {
      idx = 0;
      responses.forEach((r) => { r.text = ""; r.snapshot = null; });
      tracker.resetChallenge();
      renderScenario();
    });
    row.appendChild(copy); row.appendChild(restart);
    card.appendChild(row);
  }

  renderScenario();
}

async function applySetup({ sourceId }) {
  engine.resetAll();
  if (sourceId && sourceId !== engine.state.sourceId) await engine.setSource(sourceId);
  if (!engine.state.playing) await engine.play();
}

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

async function buildSummary(responses) {
  const session = tracker.serialize();
  const payload = {
    schemaVersion: 1,
    session,
    challenge: responses.map((r, i) => ({
      scenarioId: SCENARIOS[i].id,
      title: SCENARIOS[i].title,
      notes: r.text || "",
      snapshot: r.snapshot,
    })),
  };
  const hash = await integrityHash(payload);
  const stamped = { ...payload, integrity: hash };

  const lines = [];
  lines.push("Mid-Side Lab — Session summary");
  lines.push("==============================");
  lines.push(`Started:  ${new Date(session.startedAt).toLocaleString()}`);
  lines.push(`Duration: ${formatDuration(session.durationMs)}`);
  const tabLine = Object.entries(session.tabs)
    .map(([k, v]) => `${capitalize(k)} ${formatDuration(v.ms)} (${v.visits}x)`)
    .join(" · ");
  lines.push(`Time per tab: ${tabLine}`);

  const lessonIds = session.lessonsCompleted.map((l) => l.id);
  lines.push(`Lessons completed: ${lessonIds.length} (${lessonIds.join(", ") || "none"})`);
  if (session.checkpointAnswers.length) {
    const cpCorrect = session.checkpointAnswers.filter((a) => a.correct).length;
    lines.push(`Lesson checkpoints: ${cpCorrect} / ${session.checkpointAnswers.length} correct`);
  }
  if (session.quizAnswers.length) {
    const qCorrect = session.quizAnswers.filter((a) => a.correct).length;
    lines.push(`Quiz answers: ${qCorrect} / ${session.quizAnswers.length} correct`);
  }
  lines.push("");

  if (session.quizAnswers.length) {
    lines.push("Quiz answers");
    lines.push("------------");
    session.quizAnswers.forEach((a, i) => {
      lines.push(`  Q${i + 1}. ${a.question}`);
      lines.push(`       chose: ${a.chosen} ${a.correct ? "[✓]" : "[✗]"}`);
    });
    lines.push("");
  }

  if (session.checkpointAnswers.length) {
    lines.push("Lesson checkpoints");
    lines.push("------------------");
    session.checkpointAnswers.forEach((a) => {
      lines.push(`  [${a.lessonId}] ${a.question}`);
      lines.push(`       chose: ${a.chosen} ${a.correct ? "[✓]" : "[✗]"}`);
    });
    lines.push("");
  }

  lines.push("Challenge scenarios");
  lines.push("-------------------");
  responses.forEach((r, i) => {
    const s = SCENARIOS[i];
    lines.push(`${i + 1}. ${s.title}`);
    if (r.snapshot) {
      const sn = r.snapshot;
      lines.push(`   Width:    ${(sn.width * 100).toFixed(0)}%`);
      lines.push(`   Mid gain: ${(sn.midGain * 100).toFixed(0)}%`);
      lines.push(`   Bypass:   ${sn.bypass ? "on" : "off"}    Mono check: ${sn.monoSum ? "on" : "off"}`);
      lines.push(`   Mid EQ:   low ${sn.mid.lowGain.toFixed(1)} dB @ ${Math.round(sn.mid.lowFreq)} Hz / mid ${sn.mid.midGain.toFixed(1)} dB @ ${Math.round(sn.mid.midFreq)} Hz / high ${sn.mid.highGain.toFixed(1)} dB @ ${Math.round(sn.mid.highFreq)} Hz`);
      lines.push(`   Side EQ:  low ${sn.side.lowGain.toFixed(1)} dB @ ${Math.round(sn.side.lowFreq)} Hz / mid ${sn.side.midGain.toFixed(1)} dB @ ${Math.round(sn.side.midFreq)} Hz / high ${sn.side.highGain.toFixed(1)} dB @ ${Math.round(sn.side.highFreq)} Hz`);
    }
    lines.push(`   Notes: ${r.text || "(no notes)"}`);
    lines.push("");
  });

  lines.push(`Integrity (SHA-256): ${hash}`);
  lines.push("");
  lines.push("--- machine-readable payload ---");
  lines.push(JSON.stringify(stamped, null, 2));

  return lines.join("\n");
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
