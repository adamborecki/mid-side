// Mobile-friendly "Start audio" gate. Browsers (especially iOS Safari) block
// audio playback until the user explicitly taps a control that resumes the
// AudioContext within the same gesture. We render a full-page overlay until
// the user taps Start, then dispatch `audio:unlocked` so lessons/challenge can
// auto-play their step audio.

import { engine } from "../audio/engine.js";

let overlayEl = null;

export function initAudioGate() {
  // If audio is already running (e.g. dev hot reload kept it alive), skip.
  if (engine.audioUnlocked) return;

  overlayEl = document.createElement("div");
  overlayEl.className = "audio-gate";
  overlayEl.innerHTML = `
    <div class="audio-gate-card">
      <div class="audio-gate-mark">M/S</div>
      <h1>Mid-Side Lab</h1>
      <p>An interactive walkthrough of mid-side stereo signal processing.</p>
      <p class="dim">Most of this app makes sound. Tap below to enable audio playback in your browser.</p>
      <button class="btn primary audio-gate-btn" type="button">Start audio</button>
      <p class="dim audio-gate-tiny">All audio is synthesized in your browser — nothing is uploaded.</p>
    </div>`;
  document.body.appendChild(overlayEl);

  const btn = overlayEl.querySelector(".audio-gate-btn");

  // Note: we deliberately keep this handler synchronous up to the resume()
  // call so iOS Safari counts it as a user gesture. ensureCtx() now fires
  // resume() without awaiting.
  btn.addEventListener("click", () => {
    engine.ensureCtx();
    // Give resume() a tick to flip ctx.state to "running".
    setTimeout(checkAndDismiss, 80);
    // And again a bit later, in case the first attempt didn't catch it.
    setTimeout(checkAndDismiss, 400);
  });

  function checkAndDismiss() {
    if (!overlayEl) return;
    if (engine.audioUnlocked) {
      overlayEl.classList.add("audio-gate-hide");
      setTimeout(() => { if (overlayEl?.parentNode) overlayEl.parentNode.removeChild(overlayEl); overlayEl = null; }, 220);
      // engine.ensureCtx() already dispatches audio:unlocked once it sees ctx running.
    }
  }
}
