// Session tracker: tab dwell time, lesson checkpoints, quiz answers,
// challenge snapshots, and a SHA-256 integrity hash over the payload.

const TAB_NAMES = ["lessons", "playground", "quiz", "challenge"];

class SessionTracker {
  constructor() {
    this.startedAt = new Date();
    this.tabs = Object.fromEntries(TAB_NAMES.map((n) => [n, { ms: 0, visits: 0 }]));
    this.currentTab = null;
    this.currentTabEnteredAt = null;
    this.pageHiddenAt = null;
    this.lessonsCompleted = []; // [{ id, at }]
    this.checkpointAnswers = []; // [{ lessonId, question, chosen, correct, at }]
    this.quizAnswers = []; // [{ idx, question, chosen, correct, at }]
    this.challengeSnapshots = []; // [{ scenarioId, notes, snapshot, at }]
  }

  start() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this._flushTab();
        this.pageHiddenAt = performance.now();
      } else {
        this.pageHiddenAt = null;
        if (this.currentTab) this.currentTabEnteredAt = performance.now();
      }
    });
  }

  markTabEnter(name) {
    if (this.currentTab === name) return;
    this._flushTab();
    if (!this.tabs[name]) this.tabs[name] = { ms: 0, visits: 0 };
    this.currentTab = name;
    this.currentTabEnteredAt = performance.now();
    this.tabs[name].visits++;
  }

  _flushTab() {
    if (this.currentTab && this.currentTabEnteredAt != null) {
      const elapsed = performance.now() - this.currentTabEnteredAt;
      this.tabs[this.currentTab].ms += elapsed;
      this.currentTabEnteredAt = null;
    }
  }

  recordLessonCheckpoint(lessonId, question, chosen, correct) {
    this.checkpointAnswers.push({
      lessonId,
      question,
      chosen,
      correct,
      at: new Date().toISOString(),
    });
  }

  recordLessonComplete(lessonId) {
    if (!this.lessonsCompleted.some((l) => l.id === lessonId)) {
      this.lessonsCompleted.push({ id: lessonId, at: new Date().toISOString() });
    }
  }

  recordQuizAnswer(idx, question, chosen, correct) {
    this.quizAnswers.push({
      idx,
      question,
      chosen,
      correct,
      at: new Date().toISOString(),
    });
  }

  resetQuiz() {
    this.quizAnswers = [];
  }

  recordChallengeSnapshot(scenarioId, snapshot, notes) {
    this.challengeSnapshots.push({
      scenarioId,
      snapshot,
      notes,
      at: new Date().toISOString(),
    });
  }

  resetChallenge() {
    this.challengeSnapshots = [];
  }

  serialize() {
    this._flushTab();
    if (this.currentTab) this.currentTabEnteredAt = performance.now();
    const tabs = {};
    for (const [k, v] of Object.entries(this.tabs)) {
      tabs[k] = { ms: Math.round(v.ms), visits: v.visits };
    }
    return {
      startedAt: this.startedAt.toISOString(),
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - this.startedAt.getTime(),
      tabs,
      lessonsCompleted: [...this.lessonsCompleted],
      checkpointAnswers: [...this.checkpointAnswers],
      quizAnswers: [...this.quizAnswers],
      challenge: [...this.challengeSnapshots],
    };
  }
}

export const tracker = new SessionTracker();

// Canonical JSON: keys sorted recursively, so a recipient can recompute the
// same hash from the payload independently.
function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}

export async function integrityHash(obj) {
  const canon = canonicalize(obj);
  const bytes = new TextEncoder().encode(canon);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}
