// Central audio engine. Owns the AudioContext, M/S routing, EQ, gain, analysers,
// and exposes a small state-object API the UI can drive.

import { createEncoder, createDecoder, splitMS, mergeMS } from "./msMatrix.js";
import { createEq } from "./msEq.js";
import { getSourceBuffer, makeLoopingPlayer, SOURCE_DEFS } from "./sources.js";

export class Engine {
  constructor() {
    this.ctx = null;
    this.state = {
      sourceId: SOURCE_DEFS[0].id,
      playing: false,
      bypass: false,
      monoSum: false,
      midSolo: false,
      sideSolo: false,
      width: 1.0,
      midGain: 1.0,
      sideGain: 1.0,
      mid: { lowFreq: 200, lowGain: 0, midFreq: 1000, midGain: 0, midQ: 1.0, highFreq: 6000, highGain: 0 },
      side: { lowFreq: 200, lowGain: 0, midFreq: 1000, midGain: 0, midQ: 1.0, highFreq: 6000, highGain: 0 },
      masterGain: 0.55,
    };
    this._listeners = new Set();
    this._currentSource = null;
    this._buffers = new Map();
  }

  async ensureCtx() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctor();
      this._buildGraph();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  _buildGraph() {
    const ctx = this.ctx;

    // Source feed: a GainNode we plug a BufferSource into when the user picks a source.
    this.sourceTap = ctx.createGain();
    this.sourceTap.gain.value = 1;

    // Pre-encode analyser (raw L/R)
    this.preAnalyser = createAnalysers(ctx);
    this.sourceTap.connect(this.preAnalyser.input);

    // M/S encode
    this.encoder = createEncoder(ctx);
    this.sourceTap.connect(this.encoder.input);

    // Split M and S out as mono buses, run through EQ + gain, then re-merge.
    this.msSplit = splitMS(ctx);
    this.encoder.output.connect(this.msSplit.input);

    this.midEq = createEq(ctx);
    this.sideEq = createEq(ctx);
    this.midGainNode = ctx.createGain();
    this.sideGainNode = ctx.createGain();
    this.midGainNode.gain.value = this.state.midGain;
    this.sideGainNode.gain.value = this.state.sideGain * this.state.width;

    this.msSplit.mid.connect(this.midEq.input);
    this.msSplit.side.connect(this.sideEq.input);
    this.midEq.output.connect(this.midGainNode);
    this.sideEq.output.connect(this.sideGainNode);

    this.msMerge = mergeMS(ctx);
    this.midGainNode.connect(this.msMerge.mid);
    this.sideGainNode.connect(this.msMerge.side);

    // Post M/S analyser (M on ch0, S on ch1) — used for M vs S spectrum/meters.
    this.msAnalyser = createAnalysers(ctx);
    this.msMerge.output.connect(this.msAnalyser.input);

    // Decode back to L/R
    this.decoder = createDecoder(ctx);
    this.msMerge.output.connect(this.decoder.input);

    // Bypass switch: original L/R vs decoded L/R.
    this.processedBus = ctx.createGain();
    this.bypassBus = ctx.createGain();
    this.decoder.output.connect(this.processedBus);
    this.sourceTap.connect(this.bypassBus);
    this.processedBus.gain.value = 1;
    this.bypassBus.gain.value = 0;

    // Mono-sum option (post-everything) — collapses L/R for a mono check.
    this.outSum = ctx.createGain();
    this.processedBus.connect(this.outSum);
    this.bypassBus.connect(this.outSum);

    this.monoMixer = ctx.createGain();
    this.stereoMixer = ctx.createGain();
    this.outSum.connect(this.stereoMixer);

    // mono path: split → sum to both channels
    const monoSplit = ctx.createChannelSplitter(2);
    const monoMergeL = ctx.createGain();
    const monoMergeR = ctx.createGain();
    const monoMerger = ctx.createChannelMerger(2);
    this.outSum.connect(monoSplit);
    monoSplit.connect(monoMergeL, 0);
    monoSplit.connect(monoMergeL, 1);
    monoSplit.connect(monoMergeR, 0);
    monoSplit.connect(monoMergeR, 1);
    monoMergeL.gain.value = 0.5;
    monoMergeR.gain.value = 0.5;
    monoMergeL.connect(monoMerger, 0, 0);
    monoMergeR.connect(monoMerger, 0, 1);
    monoMerger.connect(this.monoMixer);

    this.stereoMixer.gain.value = 1;
    this.monoMixer.gain.value = 0;

    // Master + final analyser
    this.master = ctx.createGain();
    this.master.gain.value = this.state.masterGain;
    this.stereoMixer.connect(this.master);
    this.monoMixer.connect(this.master);

    this.outAnalyser = createAnalysers(ctx);
    this.master.connect(this.outAnalyser.input);

    this.master.connect(ctx.destination);
  }

  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit() { for (const fn of this._listeners) fn(this.state); }

  async setSource(id) {
    await this.ensureCtx();
    this.state.sourceId = id;
    const wasPlaying = this.state.playing;
    if (wasPlaying) this.stop();
    if (wasPlaying) await this.play();
    this._emit();
  }

  async play() {
    await this.ensureCtx();
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch {}
    }
    let buf = this._buffers.get(this.state.sourceId);
    if (!buf) {
      buf = await getSourceBuffer(this.ctx, this.state.sourceId);
      this._buffers.set(this.state.sourceId, buf);
    }
    const src = makeLoopingPlayer(this.ctx, buf);
    src.connect(this.sourceTap);
    src.start();
    this._currentSource = src;
    this.state.playing = true;
    this._emit();
  }

  stop() {
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch {}
      this._currentSource.disconnect();
      this._currentSource = null;
    }
    this.state.playing = false;
    this._emit();
  }

  toggle() { return this.state.playing ? this.stop() : this.play(); }

  setBypass(v) {
    this.state.bypass = !!v;
    this._applyBypass();
    this._emit();
  }

  _applyBypass() {
    const t = this.ctx ? this.ctx.currentTime : 0;
    if (!this.ctx) return;
    if (this.state.bypass) {
      this.processedBus.gain.cancelScheduledValues(t);
      this.bypassBus.gain.cancelScheduledValues(t);
      this.processedBus.gain.linearRampToValueAtTime(0, t + 0.02);
      this.bypassBus.gain.linearRampToValueAtTime(1, t + 0.02);
    } else {
      this.processedBus.gain.cancelScheduledValues(t);
      this.bypassBus.gain.cancelScheduledValues(t);
      this.processedBus.gain.linearRampToValueAtTime(1, t + 0.02);
      this.bypassBus.gain.linearRampToValueAtTime(0, t + 0.02);
    }
  }

  setMonoSum(v) {
    this.state.monoSum = !!v;
    if (!this.ctx) { this._emit(); return; }
    const t = this.ctx.currentTime;
    if (this.state.monoSum) {
      this.stereoMixer.gain.linearRampToValueAtTime(0, t + 0.02);
      this.monoMixer.gain.linearRampToValueAtTime(1, t + 0.02);
    } else {
      this.stereoMixer.gain.linearRampToValueAtTime(1, t + 0.02);
      this.monoMixer.gain.linearRampToValueAtTime(0, t + 0.02);
    }
    this._emit();
  }

  setWidth(w) {
    this.state.width = w;
    this._applyMidSideGains();
    this._emit();
  }

  setMidGain(g) {
    this.state.midGain = g;
    this._applyMidSideGains();
    this._emit();
  }

  setSideGain(g) {
    this.state.sideGain = g;
    this._applyMidSideGains();
    this._emit();
  }

  setMidSolo(v) {
    this.state.midSolo = !!v;
    if (v) this.state.sideSolo = false;
    this._applyMidSideGains();
    this._emit();
  }

  setSideSolo(v) {
    this.state.sideSolo = !!v;
    if (v) this.state.midSolo = false;
    this._applyMidSideGains();
    this._emit();
  }

  _applyMidSideGains() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    let mid = this.state.midGain;
    let side = this.state.sideGain * this.state.width;
    if (this.state.midSolo) side = 0;
    if (this.state.sideSolo) mid = 0;
    this.midGainNode.gain.linearRampToValueAtTime(mid, t + 0.01);
    this.sideGainNode.gain.linearRampToValueAtTime(side, t + 0.01);
  }

  setEq(bus, params) {
    const target = bus === "mid" ? this.midEq : this.sideEq;
    const store = bus === "mid" ? this.state.mid : this.state.side;
    Object.assign(store, params);
    target.setLow(store.lowFreq, store.lowGain);
    target.setMid(store.midFreq, store.midGain, store.midQ);
    target.setHigh(store.highFreq, store.highGain);
    this._emit();
  }

  resetEq(bus) {
    const flat = { lowGain: 0, midGain: 0, highGain: 0 };
    this.setEq(bus, flat);
  }

  resetAll() {
    this.state.width = 1;
    this.state.midGain = 1;
    this.state.sideGain = 1;
    this.state.midSolo = false;
    this.state.sideSolo = false;
    this.state.bypass = false;
    this.state.monoSum = false;
    this.resetEq("mid");
    this.resetEq("side");
    this._applyMidSideGains();
    this._applyBypass();
    this.setMonoSum(false);
    this._emit();
  }

  setMasterGain(g) {
    this.state.masterGain = g;
    if (this.ctx) this.master.gain.linearRampToValueAtTime(g, this.ctx.currentTime + 0.01);
    this._emit();
  }
}

function createAnalysers(ctx) {
  // returns an entry node + L and R analyser nodes
  const splitter = ctx.createChannelSplitter(2);
  const L = ctx.createAnalyser();
  const R = ctx.createAnalyser();
  L.fftSize = 2048;
  R.fftSize = 2048;
  L.smoothingTimeConstant = 0.6;
  R.smoothingTimeConstant = 0.6;
  splitter.connect(L, 0);
  splitter.connect(R, 1);
  return { input: splitter, L, R };
}

export const engine = new Engine();
export { SOURCE_DEFS };
