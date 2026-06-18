/* ============================================================
   Star Duel — Audio engine
   All sound effects + music are synthesised with the Web Audio
   API, so the game needs zero audio downloads and works offline.
   ============================================================ */
(function () {
  "use strict";

  const Audio = {
    ctx: null,
    master: null,
    musicGain: null,
    enabled: true,
    _musicTimer: null,
    _step: 0,
  };

  function ensure() {
    if (Audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    Audio.ctx = new AC();
    Audio.master = Audio.ctx.createGain();
    Audio.master.gain.value = 0.9;
    Audio.master.connect(Audio.ctx.destination);

    Audio.musicGain = Audio.ctx.createGain();
    Audio.musicGain.gain.value = 0.22;
    Audio.musicGain.connect(Audio.master);
  }

  // Resume on first user gesture (mobile autoplay policy).
  Audio.unlock = function () {
    ensure();
    if (Audio.ctx.state === "suspended") Audio.ctx.resume();
  };

  Audio.setEnabled = function (on) {
    Audio.enabled = on;
    ensure();
    Audio.master.gain.value = on ? 0.9 : 0.0;
  };

  // Generic tone helper
  function tone(opts) {
    if (!Audio.enabled || !Audio.ctx) return;
    const t = Audio.ctx.currentTime;
    const o = Audio.ctx.createOscillator();
    const g = Audio.ctx.createGain();
    o.type = opts.type || "square";
    o.frequency.setValueAtTime(opts.f0, t);
    if (opts.f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t + opts.dur);
    const vol = opts.vol == null ? 0.3 : opts.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    o.connect(g);
    g.connect(opts.dest || Audio.master);
    o.start(t);
    o.stop(t + opts.dur + 0.02);
  }

  // Noise burst (explosions / hits)
  function noise(dur, vol, freq) {
    if (!Audio.enabled || !Audio.ctx) return;
    const t = Audio.ctx.currentTime;
    const len = Math.floor(Audio.ctx.sampleRate * dur);
    const buf = Audio.ctx.createBuffer(1, len, Audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = Audio.ctx.createBufferSource();
    src.buffer = buf;
    const filt = Audio.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(freq || 1200, t);
    filt.frequency.exponentialRampToValueAtTime(200, t + dur);
    const g = Audio.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(Audio.master);
    src.start(t); src.stop(t + dur);
  }

  // ---- Public sound effects ----
  Audio.laser = function (player) {
    tone({ type: "sawtooth", f0: player ? 880 : 660, f1: player ? 240 : 180, dur: 0.16, vol: 0.18 });
  };
  Audio.hit = function () { noise(0.12, 0.25, 1800); };
  Audio.explosion = function () {
    noise(0.55, 0.6, 900);
    tone({ type: "triangle", f0: 160, f1: 40, dur: 0.5, vol: 0.35 });
  };
  Audio.powerup = function () {
    tone({ type: "square", f0: 520, f1: 1040, dur: 0.18, vol: 0.22 });
    tone({ type: "square", f0: 780, f1: 1560, dur: 0.22, vol: 0.18 });
  };
  Audio.shieldHit = function () { tone({ type: "sine", f0: 420, f1: 220, dur: 0.18, vol: 0.25 }); };
  Audio.win = function () {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => tone({ type: "square", f0: f, dur: 0.22, vol: 0.25 }), i * 130));
  };
  Audio.lose = function () {
    [392, 330, 262, 196].forEach((f, i) =>
      setTimeout(() => tone({ type: "sawtooth", f0: f, dur: 0.3, vol: 0.25 }), i * 160));
  };
  Audio.click = function () { tone({ type: "square", f0: 440, f1: 660, dur: 0.07, vol: 0.18 }); };

  // ---- Background music: simple arpeggiated loop ----
  const SCALE = [220, 261.63, 329.63, 392, 440, 523.25];
  const BASS = [55, 65.41, 49, 73.42];

  Audio.startMusic = function () {
    ensure();
    if (Audio._musicTimer) return;
    Audio._step = 0;
    const interval = 220; // ms per step
    Audio._musicTimer = setInterval(function () {
      if (!Audio.enabled) return;
      const s = Audio._step++;
      const note = SCALE[(s * 2) % SCALE.length] * (s % 8 < 4 ? 1 : 1.5);
      tone({ type: "triangle", f0: note, dur: 0.2, vol: 0.10, dest: Audio.musicGain });
      if (s % 4 === 0) {
        const b = BASS[Math.floor(s / 4) % BASS.length];
        tone({ type: "sine", f0: b, dur: 0.5, vol: 0.18, dest: Audio.musicGain });
      }
    }, interval);
  };

  Audio.stopMusic = function () {
    if (Audio._musicTimer) { clearInterval(Audio._musicTimer); Audio._musicTimer = null; }
  };

  window.GameAudio = Audio;
})();
