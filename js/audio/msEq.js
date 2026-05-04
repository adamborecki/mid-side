// 3-band biquad EQ: low shelf, mid peaking, high shelf.

export function createEq(ctx, defaults = {}) {
  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = defaults.lowFreq ?? 200;
  low.gain.value = defaults.lowGain ?? 0;

  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = defaults.midFreq ?? 1000;
  mid.Q.value = defaults.midQ ?? 1.0;
  mid.gain.value = defaults.midGain ?? 0;

  const high = ctx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = defaults.highFreq ?? 6000;
  high.gain.value = defaults.highGain ?? 0;

  low.connect(mid);
  mid.connect(high);

  return {
    input: low,
    output: high,
    bands: { low, mid, high },
    setLow(freq, gain) { low.frequency.value = freq; low.gain.value = gain; },
    setMid(freq, gain, q) { mid.frequency.value = freq; mid.gain.value = gain; if (q != null) mid.Q.value = q; },
    setHigh(freq, gain) { high.frequency.value = freq; high.gain.value = gain; },
    flat() {
      low.gain.value = 0;
      mid.gain.value = 0;
      high.gain.value = 0;
    },
  };
}
