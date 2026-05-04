// L/R <-> M/S matrix using ChannelSplitter + Gain + ChannelMerger.
// M = (L+R)/sqrt(2)
// S = (L-R)/sqrt(2)
// L = (M+S)/sqrt(2)
// R = (M-S)/sqrt(2)
// Using sqrt(2)/2 ≈ 0.7071 keeps unity gain through a flat round trip.

const SQRT2_INV = Math.SQRT1_2; // 1/sqrt(2)

export function createEncoder(ctx) {
  // Input: stereo. Output: stereo where ch0 = M, ch1 = S.
  const splitter = ctx.createChannelSplitter(2);

  const mFromL = ctx.createGain();
  const mFromR = ctx.createGain();
  const sFromL = ctx.createGain();
  const sFromR = ctx.createGain();

  mFromL.gain.value = SQRT2_INV;
  mFromR.gain.value = SQRT2_INV;
  sFromL.gain.value = SQRT2_INV;
  sFromR.gain.value = -SQRT2_INV;

  const merger = ctx.createChannelMerger(2);

  splitter.connect(mFromL, 0);
  splitter.connect(mFromR, 1);
  splitter.connect(sFromL, 0);
  splitter.connect(sFromR, 1);

  mFromL.connect(merger, 0, 0);
  mFromR.connect(merger, 0, 0);
  sFromL.connect(merger, 0, 1);
  sFromR.connect(merger, 0, 1);

  return { input: splitter, output: merger };
}

export function createDecoder(ctx) {
  // Input: stereo where ch0 = M, ch1 = S. Output: stereo L/R.
  const splitter = ctx.createChannelSplitter(2);

  const lFromM = ctx.createGain();
  const lFromS = ctx.createGain();
  const rFromM = ctx.createGain();
  const rFromS = ctx.createGain();

  lFromM.gain.value = SQRT2_INV;
  lFromS.gain.value = SQRT2_INV;
  rFromM.gain.value = SQRT2_INV;
  rFromS.gain.value = -SQRT2_INV;

  const merger = ctx.createChannelMerger(2);

  splitter.connect(lFromM, 0);
  splitter.connect(lFromS, 1);
  splitter.connect(rFromM, 0);
  splitter.connect(rFromS, 1);

  lFromM.connect(merger, 0, 0);
  lFromS.connect(merger, 0, 0);
  rFromM.connect(merger, 0, 1);
  rFromS.connect(merger, 0, 1);

  return { input: splitter, output: merger };
}

// Convenience: split a stereo signal whose channels are already M and S
// into two mono outputs. Useful for routing M and S through separate chains.
export function splitMS(ctx) {
  const splitter = ctx.createChannelSplitter(2);
  const midOut = ctx.createGain();
  const sideOut = ctx.createGain();
  splitter.connect(midOut, 0);
  splitter.connect(sideOut, 1);
  return { input: splitter, mid: midOut, side: sideOut };
}

// Merge two mono inputs (M, S) back into one stereo signal carrying M on ch0, S on ch1.
export function mergeMS(ctx) {
  const merger = ctx.createChannelMerger(2);
  const midIn = ctx.createGain();
  const sideIn = ctx.createGain();
  midIn.connect(merger, 0, 0);
  sideIn.connect(merger, 0, 1);
  return { mid: midIn, side: sideIn, output: merger };
}
