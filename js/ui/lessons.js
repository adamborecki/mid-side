// Lessons: step-through walkthroughs with paired audio + visualizers + a checkpoint.

import { engine } from "../audio/engine.js";
import { makeSlider, makeToggleButton } from "./controls.js";
import { buildVisualizerGrid } from "./visualizerPanel.js";

const KEY = "midside-lesson-progress";

// Each lesson has steps; each step has copy, optional setup (engine state),
// optional controls to surface, viz to show, and an optional checkpoint quiz.
const LESSONS = [
  {
    id: "stereo-basics",
    title: "1. What is stereo, really?",
    steps: [
      {
        body: `<p>Stereo audio is just two channels: <strong>Left</strong> and <strong>Right</strong>.
        Most of what you hear in music is actually the <em>same</em> in both channels — that's the center.
        The bits that <em>differ</em> between the two channels are what gives stereo its width.</p>
        <p>Press play and watch the goniometer. The vertical axis is what's the same in L and R; the horizontal axis is what's different.</p>
        <div class="callout beginner-only">Tip: switch sources to compare a centered vocal vs a wide pad.</div>
        <div class="callout advanced-only">Mid (M) is the sum of L+R, scaled by 1/√2. Side (S) is the difference L−R, same scaling. The matrix is unitary, so a flat round trip is lossless.</div>`,
        setup: { sourceId: "mix", play: true, reset: true },
        viz: ["goniometer", "waveLR"],
      },
      {
        body: `<p>Try a <em>vocal-ish</em> sound. Notice how the goniometer collapses to a near-vertical line — almost everything is in the center (mid).</p>
        <p>Now try the <em>pad chord</em>. Wide horizontal cloud — there's a lot of side energy.</p>`,
        setup: { sourceId: "vocal", play: true },
        viz: ["goniometer", "imageArc"],
        checkpoint: {
          q: "On the goniometer, what does a perfectly vertical line mean?",
          options: [
            { text: "The audio is mono (identical on L and R).", correct: true },
            { text: "The left channel is louder than the right." },
            { text: "The signal is out of phase." },
            { text: "There's no signal at all." },
          ],
        },
      },
    ],
  },
  {
    id: "encoding",
    title: "2. Encoding L/R into Mid/Side",
    steps: [
      {
        body: `<p>To work on the center and the sides separately, we <strong>encode</strong> stereo into Mid and Side:</p>
        <p class="beginner-only">Mid = the bits L and R agree on. Side = the bits where they disagree.</p>
        <div class="formula advanced-only">M = (L + R) / √2 &nbsp;·&nbsp; S = (L − R) / √2</div>
        <p>Compare the two waveform views below — same audio, two different ways of looking at it.</p>`,
        setup: { sourceId: "mix", play: true },
        viz: ["waveLR", "waveMS", "meters"],
      },
    ],
  },
  {
    id: "decoding",
    title: "3. Decoding back to L/R",
    steps: [
      {
        body: `<p>The cool thing about M/S: if you don't change anything, decoding back to L/R is <strong>perfectly lossless</strong>.</p>
        <div class="formula advanced-only">L = (M + S) / √2 &nbsp;·&nbsp; R = (M − S) / √2</div>
        <p>The <em>Bypass</em> button below skips the entire M/S round trip. Click it on and off — should sound identical when all M/S controls are flat.</p>`,
        setup: { reset: true, sourceId: "mix", play: true },
        viz: ["waveLR", "goniometer"],
        controls: ["bypass"],
        checkpoint: {
          q: "When Bypass is off and all controls are flat, the output should…",
          options: [
            { text: "…sound identical to the bypassed version.", correct: true },
            { text: "…be slightly quieter due to the encoding." },
            { text: "…be louder than the bypassed version." },
            { text: "…lose its stereo image." },
          ],
        },
      },
    ],
  },
  {
    id: "width",
    title: "4. Width control",
    steps: [
      {
        body: `<p>Once we have the side channel isolated, we can scale it. <strong>Less side = narrower.</strong> <strong>More side = wider.</strong></p>
        <p>Drag the Width slider. At 0%, the output collapses to mono. At 200%, the sides get pushed twice as far out.</p>
        <div class="callout">Watch the goniometer flatten and stretch as you move the slider.</div>`,
        setup: { sourceId: "pad", play: true, reset: true },
        controls: ["width"],
        viz: ["goniometer", "imageArc", "correlation"],
      },
    ],
  },
  {
    id: "mono",
    title: "5. Mono compatibility",
    steps: [
      {
        body: `<p>If your sides have phase issues, summing to mono can make parts disappear. The <strong>Mono check</strong> button collapses the output for a quick test.</p>
        <p>Try the <em>Stereo noise</em> source — it's basically pure side. Toggle Mono check and listen: most of it vanishes.</p>`,
        setup: { sourceId: "noise", play: true, reset: true },
        controls: ["mono"],
        viz: ["correlation", "meters"],
        checkpoint: {
          q: "If a sound disappears entirely when you sum to mono, what does that tell you?",
          options: [
            { text: "It's almost entirely in the side channel.", correct: true },
            { text: "Its volume was too quiet." },
            { text: "Its left and right channels were identical." },
            { text: "It was a mid-range frequency." },
          ],
        },
      },
    ],
  },
  {
    id: "ms-eq",
    title: "6. Mid/Side EQ",
    steps: [
      {
        body: `<p>The real power: EQ Mid and Side independently. Want clearer vocals without thinning out the guitars?
        Boost the highs on Mid only. Want airier sides without making the bass float? Boost highs on Side only.</p>
        <p>Try it: pull the <em>Side low gain</em> down to clean up rumble in the sides without touching the kick.</p>`,
        setup: { sourceId: "mix", play: true, reset: true },
        controls: ["sideLowGain", "sideHighGain", "midHighGain"],
        viz: ["spectrum", "goniometer"],
        checkpoint: {
          q: "You boost +6 dB at 10 kHz on Side only. What changes?",
          options: [
            { text: "The high-end of stereo width opens up; the center stays the same.", correct: true },
            { text: "Everything gets brighter equally." },
            { text: "The low end gets bigger." },
            { text: "Nothing — Side EQ doesn't affect the output." },
          ],
        },
      },
    ],
  },
];

export function renderLessons(panel) {
  panel.innerHTML = "";

  const progress = loadProgress();
  let currentLessonIdx = 0;
  let currentStepIdx = 0;

  const root = document.createElement("div");
  root.className = "col";
  panel.appendChild(root);

  const intro = document.createElement("div");
  intro.className = "card";
  intro.innerHTML = `<h1>Lessons</h1>
    <p class="dim">Six short walkthroughs. Each one comes with the audio, the visualizers, and one checkpoint question to make sure it stuck.</p>`;
  root.appendChild(intro);

  const nav = document.createElement("div");
  nav.className = "lesson-nav";
  root.appendChild(nav);

  const stepCard = document.createElement("div");
  stepCard.className = "card";
  root.appendChild(stepCard);

  function renderNav() {
    nav.innerHTML = "";
    LESSONS.forEach((lesson, i) => {
      const b = document.createElement("button");
      b.textContent = lesson.title;
      if (i === currentLessonIdx) b.classList.add("active");
      if (progress.completed.includes(lesson.id)) b.classList.add("done");
      b.addEventListener("click", () => { currentLessonIdx = i; currentStepIdx = 0; renderStep(); renderNav(); });
      nav.appendChild(b);
    });
  }

  function renderStep() {
    const lesson = LESSONS[currentLessonIdx];
    const step = lesson.steps[currentStepIdx];
    stepCard.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "lesson-step";

    const left = document.createElement("div");
    left.className = "col";
    const h2 = document.createElement("h2");
    h2.textContent = lesson.title;
    left.appendChild(h2);
    const body = document.createElement("div");
    body.innerHTML = step.body;
    left.appendChild(body);

    if (step.controls && step.controls.length) {
      const controlsCard = buildLessonControls(step.controls);
      left.appendChild(controlsCard);
    }

    if (step.checkpoint) {
      left.appendChild(buildCheckpoint(step.checkpoint, () => {
        if (!progress.completed.includes(lesson.id)) {
          progress.completed.push(lesson.id);
          saveProgress(progress);
          renderNav();
        }
      }));
    }

    const nextRow = document.createElement("div");
    nextRow.className = "lesson-progress";
    const stepInfo = document.createElement("span");
    stepInfo.className = "dim";
    stepInfo.textContent = `Step ${currentStepIdx + 1} of ${lesson.steps.length}`;
    nextRow.appendChild(stepInfo);
    const navBtns = document.createElement("div");
    navBtns.className = "row";
    const prev = document.createElement("button");
    prev.className = "btn";
    prev.textContent = "← Previous";
    prev.disabled = currentLessonIdx === 0 && currentStepIdx === 0;
    prev.addEventListener("click", () => {
      if (currentStepIdx > 0) currentStepIdx--;
      else if (currentLessonIdx > 0) { currentLessonIdx--; currentStepIdx = LESSONS[currentLessonIdx].steps.length - 1; }
      renderStep(); renderNav();
    });
    const next = document.createElement("button");
    next.className = "btn primary";
    const isLast = currentLessonIdx === LESSONS.length - 1 && currentStepIdx === lesson.steps.length - 1;
    next.textContent = isLast ? "Done" : "Next →";
    next.disabled = isLast;
    next.addEventListener("click", () => {
      if (currentStepIdx < lesson.steps.length - 1) currentStepIdx++;
      else if (currentLessonIdx < LESSONS.length - 1) { currentLessonIdx++; currentStepIdx = 0; }
      renderStep(); renderNav();
    });
    navBtns.appendChild(prev); navBtns.appendChild(next);
    nextRow.appendChild(navBtns);
    left.appendChild(nextRow);

    wrap.appendChild(left);

    const right = document.createElement("div");
    right.appendChild(buildVisualizerGrid(engine, { include: step.viz || ["goniometer"] }));
    wrap.appendChild(right);

    stepCard.appendChild(wrap);

    if (step.setup) applySetup(step.setup);
  }

  renderNav();
  renderStep();
}

// Track the most recent setup so we can replay it once audio unlocks.
let _lastSetup = null;
let _setupGen = 0;

async function applySetup(setup) {
  _lastSetup = setup;
  const myGen = ++_setupGen;
  const { sourceId, play, reset } = setup;
  if (reset) engine.resetAll();
  if (sourceId && sourceId !== engine.state.sourceId) await engine.setSource(sourceId);
  // Bail if a newer setup superseded this one mid-await.
  if (myGen !== _setupGen) return;
  if (play && !engine.state.playing && engine.audioUnlocked) await engine.play();
}

// When the user finally taps Start audio, replay the current step's setup
// from scratch so source/reset and play happen in the right order. Only do
// this if the Lessons tab is the visible one — otherwise we'd hijack audio
// for whatever tab the user actually has open.
window.addEventListener("audio:unlocked", () => {
  const panel = document.getElementById("panel-lessons");
  if (panel && !panel.classList.contains("hidden") && _lastSetup) applySetup(_lastSetup);
});

function buildLessonControls(keys) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h3>Try this</h3>`;
  const row = document.createElement("div");
  row.className = "row";
  card.appendChild(row);

  if (keys.includes("width")) {
    row.appendChild(makeSlider({
      label: "Width", min: 0, max: 2, step: 0.01, value: engine.state.width,
      format: (v) => `${(v * 100).toFixed(0)}%`,
      onInput: (v) => engine.setWidth(v),
      className: "side",
    }).el);
  }
  if (keys.includes("bypass")) {
    row.appendChild(makeToggleButton({
      label: "Bypass M/S",
      pressed: engine.state.bypass,
      onChange: (v) => engine.setBypass(v),
    }).el);
  }
  if (keys.includes("mono")) {
    row.appendChild(makeToggleButton({
      label: "Mono check",
      pressed: engine.state.monoSum,
      onChange: (v) => engine.setMonoSum(v),
    }).el);
  }
  if (keys.includes("sideLowGain")) {
    row.appendChild(makeSlider({
      label: "Side low gain", min: -18, max: 18, step: 0.1, value: engine.state.side.lowGain,
      format: (v) => `${v.toFixed(1)} dB`,
      onInput: (v) => engine.setEq("side", { lowGain: v }),
      className: "side",
    }).el);
  }
  if (keys.includes("sideHighGain")) {
    row.appendChild(makeSlider({
      label: "Side high gain", min: -18, max: 18, step: 0.1, value: engine.state.side.highGain,
      format: (v) => `${v.toFixed(1)} dB`,
      onInput: (v) => engine.setEq("side", { highGain: v }),
      className: "side",
    }).el);
  }
  if (keys.includes("midHighGain")) {
    row.appendChild(makeSlider({
      label: "Mid high gain", min: -18, max: 18, step: 0.1, value: engine.state.mid.highGain,
      format: (v) => `${v.toFixed(1)} dB`,
      onInput: (v) => engine.setEq("mid", { highGain: v }),
      className: "mid",
    }).el);
  }
  return card;
}

function buildCheckpoint(cp, onCorrect) {
  const card = document.createElement("div");
  card.className = "card quiz-question";
  card.innerHTML = `<h3>Quick check</h3><p>${cp.q}</p>`;
  const opts = document.createElement("div");
  opts.className = "quiz-options";
  cp.options.forEach((opt) => {
    const b = document.createElement("button");
    b.className = "quiz-option";
    b.textContent = opt.text;
    b.addEventListener("click", () => {
      Array.from(opts.children).forEach((c) => c.disabled = true);
      if (opt.correct) {
        b.classList.add("correct");
        onCorrect?.();
      } else {
        b.classList.add("incorrect");
        // also reveal the correct one
        cp.options.forEach((o, i) => { if (o.correct) opts.children[i].classList.add("correct"); });
      }
    });
    opts.appendChild(b);
  });
  card.appendChild(opts);
  return card;
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { completed: [] }; }
  catch { return { completed: [] }; }
}
function saveProgress(p) { localStorage.setItem(KEY, JSON.stringify(p)); }
