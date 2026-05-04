// Simple tab router driven by data-tab attributes on <button class="tab">.

const PANELS = ["lessons", "playground", "quiz", "challenge"];

export function initTabs(initial = "lessons") {
  const buttons = Array.from(document.querySelectorAll(".tab"));
  const panels = Object.fromEntries(PANELS.map((k) => [k, document.getElementById(`panel-${k}`)]));

  function activate(name) {
    if (!PANELS.includes(name)) name = "lessons";
    buttons.forEach((b) => {
      const on = b.dataset.tab === name;
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    PANELS.forEach((k) => panels[k].classList.toggle("hidden", k !== name));
    history.replaceState(null, "", `#${name}`);
    window.dispatchEvent(new CustomEvent("tab:change", { detail: { name } }));
  }

  buttons.forEach((b) => b.addEventListener("click", () => activate(b.dataset.tab)));

  const fromHash = location.hash.replace("#", "");
  activate(fromHash || initial);

  return { activate };
}
