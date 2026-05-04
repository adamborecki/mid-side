// Reusable control builders.

export function makeSlider({ label, min, max, step, value, format, onInput, className = "" }) {
  const wrap = document.createElement("div");
  wrap.className = `control ${className}`;
  const lab = document.createElement("label");
  const lname = document.createElement("span");
  lname.textContent = label;
  const lval = document.createElement("span");
  lval.className = "value";
  lab.appendChild(lname);
  lab.appendChild(lval);
  const input = document.createElement("input");
  input.type = "range";
  input.min = min; input.max = max; input.step = step; input.value = value;
  const update = (v) => { lval.textContent = format ? format(v) : String(v); };
  update(value);
  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    update(v);
    onInput(v);
  });
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return { el: wrap, input, set(v) { input.value = v; update(parseFloat(v)); } };
}

export function makeToggleButton({ label, pressed, onChange, className = "btn" }) {
  const btn = document.createElement("button");
  btn.className = className;
  btn.type = "button";
  btn.textContent = label;
  btn.setAttribute("aria-pressed", pressed ? "true" : "false");
  btn.addEventListener("click", () => {
    const next = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", next ? "true" : "false");
    onChange(next);
  });
  return {
    el: btn,
    set(pressed) { btn.setAttribute("aria-pressed", pressed ? "true" : "false"); },
  };
}

export function makeSelect({ label, options, value, onChange }) {
  const wrap = document.createElement("div");
  wrap.className = "control";
  const lab = document.createElement("label");
  lab.appendChild(document.createTextNode(label));
  const sel = document.createElement("select");
  sel.className = "input";
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt.value; o.textContent = opt.label;
    if (opt.value === value) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => onChange(sel.value));
  wrap.appendChild(lab);
  wrap.appendChild(sel);
  return { el: wrap, select: sel };
}

export function showToast(text, ms = 1600) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), ms);
}
