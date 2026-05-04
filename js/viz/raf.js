// Single shared rAF dispatcher so we don't spawn N loops.
const subs = new Set();
let running = false;

function tick() {
  for (const fn of subs) {
    try { fn(); } catch (e) { console.error(e); }
  }
  if (subs.size > 0) requestAnimationFrame(tick);
  else running = false;
}

export function subscribe(fn) {
  subs.add(fn);
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
  return () => subs.delete(fn);
}
