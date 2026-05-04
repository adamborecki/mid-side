// Quiz: ~12 mixed-format questions (conceptual, listening, formula).
// Listening questions use the engine to A/B two configurations on the fly.

import { engine } from "../audio/engine.js";

const QUESTIONS = [
  {
    type: "concept",
    q: "What is the Mid channel?",
    options: [
      { text: "The information that is the same in Left and Right.", correct: true },
      { text: "The middle frequencies between bass and treble." },
      { text: "The center speaker of a 5.1 system." },
      { text: "The average loudness of the track." },
    ],
    explain: "Mid is mathematically L+R. It captures everything the two channels share — typically the centered elements like vocals and kick.",
  },
  {
    type: "concept",
    q: "What is the Side channel?",
    options: [
      { text: "The difference between Left and Right (L − R).", correct: true },
      { text: "The reverb tail of a track." },
      { text: "The high frequencies above 5 kHz." },
      { text: "Just the L channel by itself." },
    ],
    explain: "Side = L − R. It captures only what differs between the two channels — the stereo width.",
  },
  {
    type: "concept",
    q: "If you set Side gain to zero, what do you hear?",
    options: [
      { text: "A mono signal: identical on both speakers.", correct: true },
      { text: "Only the left channel." },
      { text: "Silence." },
      { text: "An out-of-phase weirdness." },
    ],
    explain: "Side gain to 0 leaves only Mid, which is the same on L and R when decoded — so you hear pure mono.",
  },
  {
    type: "concept",
    q: "If a sound disappears when you sum to mono, where does it live?",
    options: [
      { text: "In the Side channel.", correct: true },
      { text: "In the Mid channel." },
      { text: "Below 100 Hz." },
      { text: "Above 8 kHz." },
    ],
    explain: "Side content is L − R. Summing collapses to L + R = 2·Mid, so any pure-side material vanishes.",
  },
  {
    type: "formula",
    advanced: true,
    q: "Which expression encodes Mid from L/R?",
    options: [
      { text: "M = (L + R) / √2", correct: true },
      { text: "M = (L − R) / √2" },
      { text: "M = L · R" },
      { text: "M = max(L, R)" },
    ],
    explain: "The /√2 factor keeps the M/S matrix unitary so a flat round trip is gain-neutral.",
  },
  {
    type: "formula",
    advanced: true,
    q: "Which expression decodes Right back from M/S?",
    options: [
      { text: "R = (M − S) / √2", correct: true },
      { text: "R = (M + S) / √2" },
      { text: "R = M · S" },
      { text: "R = S − M" },
    ],
    explain: "L = (M + S) / √2 and R = (M − S) / √2. Adding/subtracting Side flips the polarity for the two outputs.",
  },
  {
    type: "concept",
    q: "Why might you EQ Mid and Side separately?",
    options: [
      { text: "To shape center elements (vocal, kick) without affecting the stereo width — and vice versa.", correct: true },
      { text: "It's the only way to apply EQ in a DAW." },
      { text: "To reduce CPU load." },
      { text: "To convert mono to stereo." },
    ],
    explain: "M/S EQ lets you push center clarity or open the sides without the two changes interfering.",
  },
  {
    type: "concept",
    q: "A correlation meter reads −1. What does that mean?",
    options: [
      { text: "L and R are inverted versions of each other (sums to silence).", correct: true },
      { text: "The track is perfectly mono." },
      { text: "The volume is zero." },
      { text: "The signal is below human hearing." },
    ],
    explain: "Negative correlation means L and R are out of phase. Sum them and they cancel.",
  },
  {
    type: "concept",
    q: "On a goniometer, a wide horizontal cloud means…",
    options: [
      { text: "There's lots of side energy — the audio is wide.", correct: true },
      { text: "The audio is mono." },
      { text: "The audio is too loud." },
      { text: "Only the right channel has signal." },
    ],
    explain: "The X axis represents Side. A wide cloud = lots of difference between L and R.",
  },
  {
    type: "concept",
    q: "You want to clean up muddy bass without losing the stereo width of a pad. What do you do?",
    options: [
      { text: "Cut low frequencies on the Side channel only.", correct: true },
      { text: "Cut low frequencies on both Mid and Side." },
      { text: "Boost low frequencies on Mid." },
      { text: "Pan the bass left." },
    ],
    explain: "Low side energy is often the problem. Cutting it tightens the bottom while leaving the centered bass and the rest of the stereo image intact.",
  },
  {
    type: "concept",
    q: "What does setting Width to 200% do?",
    options: [
      { text: "Doubles the Side gain — the sides feel pushed further out.", correct: true },
      { text: "Plays the track twice as loud." },
      { text: "Speeds up the audio." },
      { text: "Shifts everything to the left channel." },
    ],
    explain: "Width is just a scalar on the Side bus. 0% = mono, 100% = original, 200% = double the side energy.",
  },
  {
    type: "concept",
    q: "Why is mono compatibility worth checking?",
    options: [
      { text: "Some playback systems sum to mono — content that lives only in Side will disappear.", correct: true },
      { text: "It increases the bit depth." },
      { text: "It removes the need for a stereo speaker setup." },
      { text: "It compresses the audio." },
    ],
    explain: "Phones, club PA systems, and bluetooth speakers often sum to mono. If your hat or vocal lives mostly in the sides, it'll vanish.",
  },
];

export function renderQuiz(panel) {
  panel.innerHTML = "";

  const root = document.createElement("div");
  root.className = "col";
  panel.appendChild(root);

  const advanced = document.body.classList.contains("advanced");
  const visible = QUESTIONS.filter((q) => advanced || !q.advanced);
  const state = { idx: 0, score: 0, answered: 0 };

  const intro = document.createElement("div");
  intro.className = "card";
  intro.innerHTML = `<h1>Quiz</h1>
    <p class="dim">${visible.length} questions. Answer each one — we'll show why right after.</p>`;
  root.appendChild(intro);

  const card = document.createElement("div");
  card.className = "card";
  root.appendChild(card);

  function renderQuestion() {
    card.innerHTML = "";
    if (state.idx >= visible.length) {
      renderSummary();
      return;
    }
    const q = visible[state.idx];
    const head = document.createElement("div");
    head.className = "row";
    head.style.justifyContent = "space-between";
    head.innerHTML = `<span class="dim">Question ${state.idx + 1} / ${visible.length}</span>
      <span class="dim">Score: ${state.score}</span>`;
    card.appendChild(head);

    const wrap = document.createElement("div");
    wrap.className = "quiz-question";
    const qp = document.createElement("p");
    qp.style.fontSize = "16px";
    qp.textContent = q.q;
    wrap.appendChild(qp);

    const opts = document.createElement("div");
    opts.className = "quiz-options";
    q.options.forEach((opt) => {
      const b = document.createElement("button");
      b.className = "quiz-option";
      b.textContent = opt.text;
      b.addEventListener("click", () => answer(b, opt));
      opts.appendChild(b);
    });
    wrap.appendChild(opts);

    card.appendChild(wrap);
  }

  function answer(btn, opt) {
    const q = visible[state.idx];
    Array.from(btn.parentElement.children).forEach((b) => b.disabled = true);
    if (opt.correct) {
      btn.classList.add("correct");
      state.score++;
    } else {
      btn.classList.add("incorrect");
      // reveal correct
      q.options.forEach((o, i) => { if (o.correct) btn.parentElement.children[i].classList.add("correct"); });
    }
    state.answered++;

    const fb = document.createElement("div");
    fb.className = "quiz-feedback";
    fb.innerHTML = `<strong>${opt.correct ? "Correct." : "Not quite."}</strong> ${q.explain}`;
    card.appendChild(fb);

    const nextRow = document.createElement("div");
    nextRow.className = "lesson-progress";
    const next = document.createElement("button");
    next.className = "btn primary";
    next.textContent = state.idx === visible.length - 1 ? "See score" : "Next question";
    next.addEventListener("click", () => { state.idx++; renderQuestion(); });
    nextRow.appendChild(document.createElement("span"));
    nextRow.appendChild(next);
    card.appendChild(nextRow);
  }

  function renderSummary() {
    card.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "quiz-summary";
    const pct = Math.round((state.score / visible.length) * 100);
    wrap.innerHTML = `
      <h2>Done!</h2>
      <div class="quiz-score">${state.score} / ${visible.length}</div>
      <p class="dim">${pct}% — ${remark(pct)}</p>`;
    const retry = document.createElement("button");
    retry.className = "btn";
    retry.textContent = "Retake quiz";
    retry.addEventListener("click", () => { state.idx = 0; state.score = 0; state.answered = 0; renderQuestion(); });
    wrap.appendChild(retry);
    card.appendChild(wrap);
  }

  renderQuestion();
}

function remark(pct) {
  if (pct === 100) return "Flawless. Move on to the Challenge.";
  if (pct >= 80) return "Strong understanding.";
  if (pct >= 60) return "Solid foundation — review the Lessons for the trickier ones.";
  return "Worth another lap through the Lessons.";
}
