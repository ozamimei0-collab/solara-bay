// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, pickups and a small bass-driven music loop.
export function createAudio() {
  let ctx = null, master = null, musicGain = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenLfo = null;
  let muted = false, musicTimer = null, beat = 0;
  const BASS = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4]; // A1 A1 C2 G1 …

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.14; musicGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = ctx.createGain(); engineGain.gain.value = 0; engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator(); sirenLfo.type = 'square'; sirenLfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
      sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start(); sirenLfo.start();
    } catch { return false; }
    return true;
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* audio is optional */ }
  }
  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
      const g = ctx.createGain(); g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master); src.start();
    } catch { /* ignore */ }
  }
  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const f = BASS[beat % BASS.length]; beat += 1;
      blip(f, 0.42, 'triangle', 0.5);
      if (beat % 2 === 0) blip(f * 2, 0.12, 'square', 0.08);
      if (beat % 4 === 0) noise(0.05, 0.08, 6000);
    }, 260);
  }
  return {
    start() { if (ensure()) { try { ctx.resume(); } catch { /* ignore */ } startMusic(); } },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    setEngine(speed, inCar) {
      if (!ctx || muted) return;
      try {
        engineGain.gain.value = inCar ? 0.05 + Math.min(0.09, speed / 6000) : 0;
        engineOsc.frequency.value = 45 + speed * 0.16;
      } catch { /* ignore */ }
    },
    setSiren(on) { if (ctx) { try { sirenGain.gain.value = on && !muted ? 0.045 : 0; } catch { /* ignore */ } } },
    shoot() { noise(0.12, 0.4, 1800); blip(160, 0.08, 'square', 0.15, 60); },
    punch() { noise(0.08, 0.25, 900); },
    pickup() { blip(660, 0.1, 'sine', 0.25); window.setTimeout(() => blip(990, 0.14, 'sine', 0.25), 90); },
    crash() { noise(0.25, 0.35, 500); },
    mission() { [523, 659, 784].forEach((f, i) => window.setTimeout(() => blip(f, 0.22, 'triangle', 0.3), i * 110)); },
    click() { blip(440, 0.06, 'sine', 0.15); },
  };
}
