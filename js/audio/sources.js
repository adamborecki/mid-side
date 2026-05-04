// In-browser stereo source loops. Each source is rendered into an AudioBuffer
// the first time it's requested, then played back via a looping
// AudioBufferSourceNode so the user gets seamless playback and consistent A/B.

const BAR_SECONDS = 2.0; // 4 bars at 120 BPM-ish; long enough to feel musical
const TOTAL_SECONDS = BAR_SECONDS * 4;

const cache = new Map();

export const SOURCE_DEFS = [
  { id: "drums", label: "Drum kit", description: "Kick + snare + hats with stereo panned hats." },
  { id: "pad", label: "Pad chord", description: "Wide synth pad — heavy in the sides." },
  { id: "mix", label: "Full mix", description: "Drums + bass + pad + lead — a realistic stereo mix." },
  { id: "vocal", label: "Vocal-ish", description: "Centered formant tone — almost entirely mid." },
  { id: "bassdrums", label: "Bass + drums", description: "Mostly mono content; useful for width testing." },
  { id: "noise", label: "Stereo noise", description: "Decorrelated pink noise — pure side-heavy content." },
];

export async function getSourceBuffer(ctx, id) {
  if (cache.has(id)) return cache.get(id);
  const buffer = await renderSource(ctx, id);
  cache.set(id, buffer);
  return buffer;
}

async function renderSource(ctx, id) {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(TOTAL_SECONDS * sampleRate);
  const offline = new OfflineAudioContext(2, length, sampleRate);

  switch (id) {
    case "drums": renderDrums(offline); break;
    case "pad": renderPad(offline); break;
    case "mix": renderMix(offline); break;
    case "vocal": renderVocal(offline); break;
    case "bassdrums": renderBassDrums(offline); break;
    case "noise": renderStereoNoise(offline); break;
    default: throw new Error(`unknown source: ${id}`);
  }

  return await offline.startRendering();
}

// ================ helpers =================

function whiteNoiseBuffer(ctx, seconds, channels = 1) {
  const buf = ctx.createBuffer(channels, Math.floor(seconds * ctx.sampleRate), ctx.sampleRate);
  for (let c = 0; c < channels; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function pinkNoiseBuffer(ctx, seconds, channels = 1) {
  // Voss-McCartney-ish via a simple IIR lowpass on white noise.
  const buf = ctx.createBuffer(channels, Math.floor(seconds * ctx.sampleRate), ctx.sampleRate);
  for (let c = 0; c < channels; c++) {
    const data = buf.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
  }
  return buf;
}

function envGain(ctx, time, attack, decay, sustainLevel = 0, sustainTime = 0) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(1, time + attack);
  if (sustainTime > 0) {
    g.gain.linearRampToValueAtTime(sustainLevel, time + attack + decay);
    g.gain.linearRampToValueAtTime(0, time + attack + decay + sustainTime);
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  }
  return g;
}

function pannedSource(ctx, source, pan, gain = 1) {
  const g = ctx.createGain(); g.gain.value = gain;
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  source.connect(g); g.connect(p);
  return p;
}

// ================ drum kit =================

function kickAt(ctx, t, dest) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
  const env = envGain(ctx, t, 0.002, 0.22);
  osc.connect(env); env.connect(dest);
  osc.start(t); osc.stop(t + 0.3);
}

function snareAt(ctx, t, dest) {
  const noise = ctx.createBufferSource();
  noise.buffer = whiteNoiseBuffer(ctx, 0.2);
  const filt = ctx.createBiquadFilter();
  filt.type = "highpass"; filt.frequency.value = 1500;
  const env = envGain(ctx, t, 0.001, 0.15);
  noise.connect(filt); filt.connect(env); env.connect(dest);
  noise.start(t); noise.stop(t + 0.2);

  const tone = ctx.createOscillator();
  tone.frequency.value = 200;
  const tenv = envGain(ctx, t, 0.001, 0.08);
  tone.connect(tenv); tenv.connect(dest);
  tone.start(t); tone.stop(t + 0.1);
}

function hatAt(ctx, t, dest, pan = 0) {
  const noise = ctx.createBufferSource();
  noise.buffer = whiteNoiseBuffer(ctx, 0.06);
  const filt = ctx.createBiquadFilter();
  filt.type = "highpass"; filt.frequency.value = 7000;
  const env = envGain(ctx, t, 0.001, 0.04);
  const panner = ctx.createStereoPanner(); panner.pan.value = pan;
  const g = ctx.createGain(); g.gain.value = 0.5;
  noise.connect(filt); filt.connect(env); env.connect(panner); panner.connect(g); g.connect(dest);
  noise.start(t); noise.stop(t + 0.07);
}

function renderDrums(ctx) {
  const dest = ctx.destination;
  const beat = 0.5; // 120 BPM quarter
  for (let bar = 0; bar < 4; bar++) {
    const b = bar * 4 * beat;
    kickAt(ctx, b + 0 * beat, dest);
    kickAt(ctx, b + 2 * beat, dest);
    snareAt(ctx, b + 1 * beat, dest);
    snareAt(ctx, b + 3 * beat, dest);
    for (let i = 0; i < 8; i++) {
      const t = b + i * (beat / 2);
      const pan = i % 2 === 0 ? -0.6 : 0.6;
      hatAt(ctx, t, dest, pan);
    }
  }
}

// ================ pad (wide) =================

function renderPad(ctx) {
  const dest = ctx.destination;
  const notes = [220, 261.63, 329.63, 392]; // A minor 7
  notes.forEach((freq, i) => {
    const detune = (i % 2 === 0) ? -8 : 8;
    const oscL = ctx.createOscillator();
    oscL.type = "sawtooth";
    oscL.frequency.value = freq;
    oscL.detune.value = detune - 4;
    const oscR = ctx.createOscillator();
    oscR.type = "sawtooth";
    oscR.frequency.value = freq;
    oscR.detune.value = detune + 4;

    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.value = 0.08;

    const panL = ctx.createStereoPanner(); panL.pan.value = -0.85;
    const panR = ctx.createStereoPanner(); panR.pan.value = 0.85;

    oscL.connect(panL); oscR.connect(panR);
    panL.connect(lp); panR.connect(lp);
    lp.connect(g); g.connect(dest);

    oscL.start(0); oscL.stop(ctx.length / ctx.sampleRate);
    oscR.start(0); oscR.stop(ctx.length / ctx.sampleRate);
  });
}

// ================ vocal-ish (centered) =================

function renderVocal(ctx) {
  const dest = ctx.destination;
  const carrier = ctx.createOscillator();
  carrier.type = "sawtooth";
  carrier.frequency.value = 196; // G3
  // simple formant filter
  const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 700; f1.Q.value = 5;
  const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 1200; f2.Q.value = 6;
  const mix = ctx.createGain(); mix.gain.value = 0.6;
  carrier.connect(f1); carrier.connect(f2);
  f1.connect(mix); f2.connect(mix);

  // amplitude wobble
  const lfo = ctx.createOscillator(); lfo.frequency.value = 4.5;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.18;
  const amp = ctx.createGain(); amp.gain.value = 0.5;
  lfo.connect(lfoGain); lfoGain.connect(amp.gain);

  mix.connect(amp); amp.connect(dest);
  carrier.start(0); carrier.stop(ctx.length / ctx.sampleRate);
  lfo.start(0); lfo.stop(ctx.length / ctx.sampleRate);
}

// ================ bass + drums (mostly mono) =================

function renderBassDrums(ctx) {
  renderDrums(ctx);
  const dest = ctx.destination;
  const beat = 0.5;
  // simple bassline on root
  const pattern = [55, 55, 73.42, 65.41]; // A1 / A1 / D2 / C2
  for (let bar = 0; bar < 4; bar++) {
    pattern.forEach((freq, i) => {
      const t = bar * 4 * beat + i * beat;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 350;
      const env = envGain(ctx, t, 0.005, 0.42);
      const g = ctx.createGain(); g.gain.value = 0.35;
      osc.connect(lp); lp.connect(env); env.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.5);
    });
  }
}

// ================ stereo noise =================

function renderStereoNoise(ctx) {
  const buf = pinkNoiseBuffer(ctx, ctx.length / ctx.sampleRate, 2);
  // each channel is independent → side-heavy
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = 0.35;
  src.connect(g); g.connect(ctx.destination);
  src.start(0);
}

// ================ full mix =================

function renderMix(ctx) {
  // master gain to keep sum from clipping
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  // re-route by piping through sub-buffers we render via sub-trees
  // Simpler approach: just inline the same generators but to master.
  const dest = master;

  // drums
  const beat = 0.5;
  for (let bar = 0; bar < 4; bar++) {
    const b = bar * 4 * beat;
    kickAt(ctx, b + 0 * beat, dest);
    kickAt(ctx, b + 2 * beat, dest);
    snareAt(ctx, b + 1 * beat, dest);
    snareAt(ctx, b + 3 * beat, dest);
    for (let i = 0; i < 8; i++) {
      hatAt(ctx, b + i * (beat / 2), dest, i % 2 === 0 ? -0.6 : 0.6);
    }
  }

  // bassline
  const bassPattern = [55, 55, 73.42, 65.41];
  for (let bar = 0; bar < 4; bar++) {
    bassPattern.forEach((freq, i) => {
      const t = bar * 4 * beat + i * beat;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth"; osc.frequency.value = freq;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320;
      const env = envGain(ctx, t, 0.005, 0.42);
      const g = ctx.createGain(); g.gain.value = 0.3;
      osc.connect(lp); lp.connect(env); env.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.5);
    });
  }

  // pad
  const padNotes = [220, 261.63, 329.63];
  padNotes.forEach((freq, i) => {
    const oscL = ctx.createOscillator();
    oscL.type = "sawtooth"; oscL.frequency.value = freq; oscL.detune.value = -7;
    const oscR = ctx.createOscillator();
    oscR.type = "sawtooth"; oscR.frequency.value = freq; oscR.detune.value = 7;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2000;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const panL = ctx.createStereoPanner(); panL.pan.value = -0.8;
    const panR = ctx.createStereoPanner(); panR.pan.value = 0.8;
    oscL.connect(panL); oscR.connect(panR);
    panL.connect(lp); panR.connect(lp);
    lp.connect(g); g.connect(dest);
    oscL.start(0); oscR.start(0);
    oscL.stop(ctx.length / ctx.sampleRate);
    oscR.stop(ctx.length / ctx.sampleRate);
  });

  // lead (centered)
  const leadNotes = [
    [659.25, 0.5, 0.4], [587.33, 1.0, 0.4], [523.25, 1.5, 0.4], [440, 2.0, 0.6],
    [659.25, 3.0, 0.4], [587.33, 3.5, 0.4], [659.25, 4.0, 0.5], [880, 4.5, 0.8],
    [659.25, 5.5, 0.5], [587.33, 6.0, 0.5], [523.25, 6.5, 1.5],
  ];
  leadNotes.forEach(([freq, start, dur]) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle"; osc.frequency.value = freq;
    const env = envGain(ctx, start, 0.01, dur * 0.85, 0.3, dur * 0.15);
    const g = ctx.createGain(); g.gain.value = 0.12;
    osc.connect(env); env.connect(g); g.connect(dest);
    osc.start(start); osc.stop(start + dur + 0.1);
  });
}

export function makeLoopingPlayer(ctx, buffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}
