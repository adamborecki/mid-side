// Beginner / Advanced switch — toggles a body class so .advanced-only / .beginner-only blocks show or hide.

const KEY = "midside-advanced";

export function initAdvancedToggle() {
  const cb = document.getElementById("advanced-toggle");
  const initial = localStorage.getItem(KEY) === "1";
  cb.checked = initial;
  document.body.classList.toggle("advanced", initial);

  cb.addEventListener("change", () => {
    document.body.classList.toggle("advanced", cb.checked);
    localStorage.setItem(KEY, cb.checked ? "1" : "0");
    window.dispatchEvent(new CustomEvent("advanced:change", { detail: { advanced: cb.checked } }));
  });
}

export function isAdvanced() {
  return document.body.classList.contains("advanced");
}
