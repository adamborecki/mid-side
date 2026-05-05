// Reusable Play/Stop + source picker + bypass/mono toggles. Subscribes to
// engine state so all instances stay in sync.

import { engine, SOURCE_DEFS } from "../audio/engine.js";
import { makeToggleButton } from "./controls.js";

export function buildTransport({ showSource = true, showBypass = true, showMono = true } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "transport-bar";

  const playBtn = document.createElement("button");
  playBtn.className = "btn primary";
  playBtn.type = "button";
  playBtn.addEventListener("click", async () => { await engine.toggle(); });
  wrap.appendChild(playBtn);

  let sourceSel = null;
  if (showSource) {
    sourceSel = document.createElement("select");
    sourceSel.className = "input";
    for (const s of SOURCE_DEFS) {
      const o = document.createElement("option");
      o.value = s.id; o.textContent = s.label; sourceSel.appendChild(o);
    }
    sourceSel.addEventListener("change", () => engine.setSource(sourceSel.value));
    wrap.appendChild(sourceSel);
  }

  let bypassBtn = null;
  if (showBypass) {
    bypassBtn = makeToggleButton({
      label: "Bypass",
      pressed: engine.state.bypass,
      onChange: (v) => engine.setBypass(v),
    });
    wrap.appendChild(bypassBtn.el);
  }

  let monoBtn = null;
  if (showMono) {
    monoBtn = makeToggleButton({
      label: "Mono check",
      pressed: engine.state.monoSum,
      onChange: (v) => engine.setMonoSum(v),
    });
    wrap.appendChild(monoBtn.el);
  }

  function sync() {
    const s = engine.state;
    playBtn.textContent = s.playing ? "■ Stop" : "▶ Play";
    if (sourceSel) sourceSel.value = s.sourceId;
    if (bypassBtn) bypassBtn.set(s.bypass);
    if (monoBtn) monoBtn.set(s.monoSum);
  }
  sync();
  const unsub = engine.on(sync);

  // Detach when removed from the DOM via MutationObserver — keeps the
  // listener set from leaking when tabs re-render.
  const obs = new MutationObserver(() => {
    if (!wrap.isConnected) { unsub(); obs.disconnect(); }
  });
  queueMicrotask(() => {
    if (wrap.parentNode) obs.observe(wrap.parentNode, { childList: true, subtree: true });
  });

  return wrap;
}
