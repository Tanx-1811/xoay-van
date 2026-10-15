/* Synthesized sounds (WebAudio, no audio files): per-slice tick, looping spin music, after-spin effects, speech. */
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var active = new Set(); // handles of sounds that can still be stopped

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Original plays nothing when embedded in an iframe.
  var inIframe = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

  var noiseBuffer = null;
  function noise() {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noiseBuffer.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    return src;
  }

  // One enveloped oscillator note into `out`.
  function tone(out, o) {
    var t = o.at || ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || o.dur));
    if (o.vibrato) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vibrato[0]; lg.gain.value = o.vibrato[1];
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + o.dur + 0.05);
    }
    if (o.detune) osc.detune.value = o.detune;
    var peak = o.gain == null ? 0.5 : o.gain;
    var a = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (o.hold) g.gain.setValueAtTime(peak, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    g.connect(o.filter || out);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
    return osc;
  }

  function burst(out, o) {
    var t = o.at || ctx.currentTime;
    var src = noise();
    var f = ctx.createBiquadFilter();
    f.type = o.ftype || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 3000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    f.Q.value = o.q || 1;
    var g = ctx.createGain();
    var a = o.attack || 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.4, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random());
    src.stop(t + o.dur + 0.02);
  }

  // Bell from inharmonic partials.
  function bell(out, at, base, dur, gain, partials) {
    (partials || [[1, 1], [2.0, 0.5], [2.76, 0.4], [5.4, 0.18], [8.93, 0.08]]).forEach(function (p) {
      tone(out, { freq: base * p[0], dur: dur * (1.2 - p[0] / 12), gain: gain * p[1], at: at, attack: 0.002 });
    });
  }

  function newBus(vol) {
    var g = ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1, vol));
    g.connect(master);
    return g;
  }

  function handle(bus, cleanup) {
    var h = {
      stop: function (fadeMs) {
        if (!active.has(h)) return;
        active.delete(h);
        var f = (fadeMs || 30) / 1000;
        bus.gain.cancelScheduledValues(ctx.currentTime);
        bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
        bus.gain.linearRampToValueAtTime(0, ctx.currentTime + f);
        setTimeout(function () { if (cleanup) cleanup(); try { bus.disconnect(); } catch (e) {} }, f * 1000 + 60);
      }
    };
    active.add(h);
    return h;
  }

  // ---------------------------------------------------------------- after-spin effects
  // Each returns the duration in seconds so the handle can clean itself up.
  var FX = {
    'applause-sound-soft': function (o) { return applause(o, 2.6, 90, 0.18); },
    'applause-sound': function (o) {
      var d = applause(o, 3.6, 260, 0.3);
      for (var i = 0; i < 6; i++) tone(o, { type: 'sine', freq: 1800 + Math.random() * 900, to: 2600, dur: 0.35, gain: 0.04, at: ctx.currentTime + 0.4 + i * 0.45, vibrato: [9, 80] });
      return d;
    },
    'joke-punchline': function (o) {
      var t = ctx.currentTime;
      tone(o, { freq: 190, to: 70, dur: 0.18, gain: 0.8, at: t });
      tone(o, { freq: 170, to: 65, dur: 0.18, gain: 0.8, at: t + 0.2 });
      burst(o, { ftype: 'highpass', freq: 7000, dur: 0.9, gain: 0.35, at: t + 0.42 });
      return 1.4;
    },
    'announcement-bell-sound': function (o) {
      var t = ctx.currentTime;
      [523.3, 659.3, 784, 1046.5].forEach(function (f, i) { bell(o, t + i * 0.22, f, 1.6, 0.18, [[1, 1], [2, 0.3], [3, 0.12]]); });
      return 2.5;
    },
    'twinkling-star-sound': function (o) {
      var t = ctx.currentTime;
      [1046.5, 1318.5, 1568, 2093, 2637].forEach(function (f, i) {
        tone(o, { freq: f, dur: 0.9, gain: 0.25, at: t + i * 0.09 });
        tone(o, { type: 'triangle', freq: f * 2, dur: 0.4, gain: 0.05, at: t + i * 0.09 });
      });
      for (var k = 0; k < 12; k++) tone(o, { freq: 2400 + Math.random() * 2600, dur: 0.25, gain: 0.05, at: t + 0.45 + k * 0.07 });
      return 1.9;
    },
    'correct-answer-ding-sound': function (o) {
      var t = ctx.currentTime;
      bell(o, t, 1318.5, 1.1, 0.3, [[1, 1], [2, 0.2]]);
      bell(o, t + 0.13, 1760, 1.4, 0.3, [[1, 1], [2, 0.2]]);
      return 1.7;
    },
    'synth-bell-sound': function (o) {
      var t = ctx.currentTime;
      [784, 987.8, 1174.7].forEach(function (f, i) {
        var mod = ctx.createOscillator(), mg = ctx.createGain();
        var car = tone(o, { freq: f, dur: 2.2, gain: 0.22, at: t + i * 0.04 });
        mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + 1.5);
        mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(t + 2.3);
      });
      return 2.4;
    },
    'notification-bell-sound': function (o) { var t = ctx.currentTime; bell(o, t, 1760, 1.2, 0.25); bell(o, t + 0.16, 2349, 1.2, 0.2); return 1.6; },
    'fanfare-sound': function (o) {
      var t = ctx.currentTime;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(o);
      [[392, 0, 0.14], [392, 0.16, 0.14], [392, 0.32, 0.14], [523.3, 0.48, 0.5], [466.2, 1.0, 0.22], [523.3, 1.24, 1.1]].forEach(function (n) {
        tone(o, { type: 'sawtooth', freq: n[0], dur: n[2] + 0.1, gain: 0.2, at: t + n[1], filter: lp, attack: 0.02 });
        tone(o, { type: 'sawtooth', freq: n[0] * 1.006, dur: n[2] + 0.1, gain: 0.12, at: t + n[1], filter: lp, attack: 0.02 });
      });
      [261.6, 329.6, 392].forEach(function (f) { tone(o, { type: 'sawtooth', freq: f, dur: 1.2, gain: 0.08, at: t + 1.24, filter: lp, attack: 0.05 }); });
      return 2.5;
    },
    'bell-sound': function (o) { var t = ctx.currentTime; for (var i = 0; i < 6; i++) bell(o, t + i * 0.3, i % 2 ? 880 : 1046.5, 1.4, 0.18); return 3.2; },
    'cymbal-sound': function (o) {
      var t = ctx.currentTime;
      burst(o, { ftype: 'highpass', freq: 5000, dur: 2.4, gain: 0.45, at: t, q: 0.5 });
      burst(o, { ftype: 'bandpass', freq: 9000, dur: 1.4, gain: 0.25, at: t, q: 0.8 });
      return 2.6;
    },
    'thunder': function (o) {
      var t = ctx.currentTime;
      burst(o, { ftype: 'lowpass', freq: 900, to: 120, dur: 3.2, gain: 0.9, at: t, attack: 0.05, q: 0.6 });
      burst(o, { ftype: 'lowpass', freq: 400, to: 80, dur: 2.4, gain: 0.8, at: t + 0.35, attack: 0.2, q: 0.6 });
      burst(o, { ftype: 'bandpass', freq: 2500, dur: 0.25, gain: 0.5, at: t, q: 0.6 });
      return 3.6;
    },
    'cash-register': function (o) {
      var t = ctx.currentTime;
      for (var i = 0; i < 4; i++) burst(o, { ftype: 'highpass', freq: 2500, dur: 0.05, gain: 0.4, at: t + i * 0.06 });
      burst(o, { freq: 600, dur: 0.18, gain: 0.5, at: t + 0.3, q: 2 });
      bell(o, t + 0.42, 2093, 1.2, 0.22);
      return 1.8;
    },
    'microwave-ding-sound': function (o) { bell(o, ctx.currentTime, 1975.5, 2.2, 0.32, [[1, 1], [2.32, 0.35], [4.1, 0.12]]); return 2.4; },
    'old-phone-sound': function (o) {
      var t = ctx.currentTime;
      [0, 1.6].forEach(function (d) {
        var amp = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        amp.gain.value = 0.5; lfo.type = 'square'; lfo.frequency.value = 22; lg.gain.value = 0.5;
        lfo.connect(lg); lg.connect(amp.gain); amp.connect(o);
        [1046.5, 1318.5].forEach(function (f) { tone(amp, { type: 'triangle', freq: f, dur: 1.0, hold: 0.85, gain: 0.25, at: t + d }); });
        lfo.start(t + d); lfo.stop(t + d + 1.05);
      });
      return 2.8;
    },
    'alarm-clock-sound': function (o) {
      var t = ctx.currentTime;
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) tone(o, { type: 'square', freq: 2093, dur: 0.06, hold: 0.04, gain: 0.12, at: t + i * 0.5 + j * 0.08 });
      return 2.2;
    },
    'fireworks-sound': function (o) {
      var t = ctx.currentTime;
      for (var i = 0; i < 4; i++) {
        var s = t + i * 0.55 + Math.random() * 0.15;
        tone(o, { freq: 600, to: 2400, dur: 0.5, gain: 0.05, at: s });
        burst(o, { ftype: 'lowpass', freq: 1800, to: 200, dur: 0.9, gain: 0.8, at: s + 0.5, q: 0.7 });
        for (var k = 0; k < 8; k++) burst(o, { ftype: 'highpass', freq: 4000, dur: 0.04, gain: 0.25, at: s + 0.6 + Math.random() * 0.6 });
      }
      return 3.4;
    },
    'game-win-ding': function (o) {
      var t = ctx.currentTime;
      [523.3, 659.3, 784, 1046.5, 1318.5].forEach(function (f, i) { tone(o, { type: 'square', freq: f, dur: 0.1, gain: 0.12, at: t + i * 0.07 }); });
      tone(o, { type: 'square', freq: 1568, dur: 0.5, hold: 0.2, gain: 0.12, at: t + 0.38 });
      bell(o, t + 0.38, 3136, 0.9, 0.08);
      return 1.3;
    },
    'wrong-answer': function (o) {
      var t = ctx.currentTime;
      tone(o, { type: 'sawtooth', freq: 140, dur: 0.35, hold: 0.25, gain: 0.25, at: t });
      tone(o, { type: 'sawtooth', freq: 110, dur: 0.6, hold: 0.45, gain: 0.25, at: t + 0.4 });
      return 1.1;
    },
    'punch': function (o) {
      var t = ctx.currentTime;
      tone(o, { freq: 160, to: 45, dur: 0.3, gain: 0.9, at: t });
      burst(o, { ftype: 'lowpass', freq: 1500, dur: 0.12, gain: 0.7, at: t });
      return 0.5;
    },
    'sad-trombone': function (o) {
      var t = ctx.currentTime;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(o);
      [[293.7, 0, 0.42], [277.2, 0.45, 0.42], [261.6, 0.9, 0.42], [246.9, 1.35, 1.3]].forEach(function (n, i) {
        tone(o, { type: 'sawtooth', freq: n[0], dur: n[2], hold: n[2] * 0.6, gain: 0.25, at: t + n[1], attack: 0.04, filter: lp, vibrato: i === 3 ? [6, 6] : null });
      });
      return 2.8;
    },
    'cinematic-drum-impact': function (o) {
      var t = ctx.currentTime;
      tone(o, { freq: 90, to: 32, dur: 2.2, gain: 1, at: t });
      burst(o, { ftype: 'lowpass', freq: 700, to: 90, dur: 1.6, gain: 0.8, at: t, q: 0.5 });
      burst(o, { ftype: 'highpass', freq: 3000, dur: 0.6, gain: 0.25, at: t });
      return 2.4;
    },
    'gong': function (o) { bell(o, ctx.currentTime, 110, 5, 0.35, [[1, 1], [1.48, 0.6], [2.02, 0.5], [2.73, 0.35], [3.6, 0.2], [4.8, 0.1]]); return 5; },
    'doorbell': function (o) { var t = ctx.currentTime; bell(o, t, 659.3, 1.4, 0.35, [[1, 1], [3, 0.1]]); bell(o, t + 0.55, 523.3, 2, 0.35, [[1, 1], [3, 0.1]]); return 2.7; },
    'church-bell': function (o) { var t = ctx.currentTime; for (var i = 0; i < 3; i++) bell(o, t + i * 1.1, 196, 3, 0.35, [[0.5, 0.5], [1, 1], [1.19, 0.5], [1.5, 0.35], [2, 0.3], [2.5, 0.12]]); return 5.4; },
    'referee-whistle': function (o) {
      var t = ctx.currentTime;
      [[0, 0.22], [0.3, 0.75]].forEach(function (p) {
        tone(o, { freq: 2950, dur: p[1], hold: p[1] - 0.08, gain: 0.2, at: t + p[0], vibrato: [32, 140] });
        burst(o, { freq: 2950, dur: p[1], gain: 0.08, at: t + p[0], q: 6 });
      });
      return 1.2;
    },
    'boing': function (o) { tone(o, { type: 'triangle', freq: 180, to: 520, dur: 0.6, gain: 0.5, glide: 0.25, vibrato: [14, 40] }); return 0.8; },
    'angel-choir': function (o) {
      var t = ctx.currentTime;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7; bp.connect(o);
      [523.3, 659.3, 784, 1046.5].forEach(function (f) {
        [-9, 0, 9].forEach(function (d) { tone(o, { type: 'sawtooth', freq: f, detune: d, dur: 3.2, hold: 1.8, attack: 0.6, gain: 0.05, at: t, filter: bp, vibrato: [5, 3] }); });
      });
      return 3.4;
    },
    'harp-strum': function (o) {
      var t = ctx.currentTime;
      [261.6, 329.6, 392, 523.3, 659.3, 784, 1046.5, 1318.5].forEach(function (f, i) {
        tone(o, { type: 'triangle', freq: f, dur: 1.8, gain: 0.2, at: t + i * 0.05 });
        tone(o, { freq: f * 2, dur: 0.8, gain: 0.05, at: t + i * 0.05 });
      });
      return 2.3;
    },
    'camera-shutter-flash': function (o) {
      var t = ctx.currentTime;
      burst(o, { ftype: 'highpass', freq: 2500, dur: 0.04, gain: 0.7, at: t });
      burst(o, { ftype: 'bandpass', freq: 1500, dur: 0.06, gain: 0.6, at: t + 0.09 });
      tone(o, { freq: 3000, to: 9000, dur: 1.2, gain: 0.03, at: t + 0.15 });
      return 1.4;
    },
    'lost-game': function (o) {
      var t = ctx.currentTime;
      [784, 740, 698.5, 659.3].forEach(function (f, i) { tone(o, { type: 'square', freq: f, dur: 0.22, hold: 0.15, gain: 0.12, at: t + i * 0.25 }); });
      tone(o, { type: 'square', freq: 622.3, to: 520, dur: 0.9, hold: 0.5, gain: 0.12, at: t + 1.0, vibrato: [7, 14] });
      return 2.1;
    }
  };

  function applause(o, len, claps, gain) {
    var t = ctx.currentTime;
    for (var i = 0; i < claps; i++) {
      var at = t + Math.pow(Math.random(), 1.4) * len * 0.85;
      var fade = 1 - (at - t) / len;
      burst(o, { freq: 900 + Math.random() * 2600, q: 0.8 + Math.random(), dur: 0.04 + Math.random() * 0.05, gain: gain * (0.4 + Math.random() * 0.6) * Math.max(0.15, fade), at: at });
    }
    burst(o, { ftype: 'bandpass', freq: 1800, q: 0.4, dur: len, gain: gain * 0.15, at: t, attack: 0.15 });
    return len + 0.2;
  }

  // ---------------------------------------------------------------- looping spin music (tiny step sequencer)
  // Notes are MIDI numbers per 16th step; null = rest. Drums: k kick, s snare, h hat.
  function mf(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  var SONGS = {
    'chip-adventure': { bpm: 150, lead: [72, null, 76, null, 79, null, 76, 79, 84, null, 83, null, 79, null, 76, null, 74, null, 77, null, 81, null, 77, 81, 86, null, 84, null, 81, null, 77, null], bass: [48, null, 48, null, 55, null, 48, null, 53, null, 53, null, 57, null, 53, null], drums: 'k.h.s.h.k.h.s.hh', leadType: 'square', bassType: 'triangle' },
    'chip-bounce': { bpm: 132, lead: [76, 76, null, 76, null, 72, 76, null, 79, null, null, null, 67, null, null, null, 72, null, null, 67, null, null, 64, null, null, 69, null, 71, null, 70, 69, null], bass: [40, null, 52, null, 40, null, 52, null, 43, null, 55, null, 43, null, 55, null], drums: 'k.h.s.h.k.k.s.h.', leadType: 'square', bassType: 'triangle' },
    'chip-race': { bpm: 176, lead: [69, 72, 76, 72, 69, 72, 76, 81, 67, 71, 74, 71, 67, 71, 74, 79, 65, 69, 72, 69, 65, 69, 72, 77, 64, 68, 71, 68, 64, 68, 71, 76], bass: [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 40, 40, 52, 40], drums: 'khshkhshkhshkhss', leadType: 'square', bassType: 'sawtooth' },
    'music-box': { bpm: 96, lead: [79, null, 84, null, 88, null, 84, null, 91, null, 88, null, 84, null, 79, null, 77, null, 81, null, 84, null, 81, null, 89, null, 84, null, 81, null, 77, null], bass: [60, null, null, null, 67, null, null, null, 65, null, null, null, 60, null, null, null], drums: '', leadType: 'sine', bassType: 'sine', bell: true },
    'easy-keys': { bpm: 84, lead: [64, null, 67, null, 71, null, 74, null, 72, null, 71, null, 67, null, null, null, 62, null, 65, null, 69, null, 72, null, 71, null, 69, null, 65, null, null, null], bass: [48, null, null, null, 55, null, 52, null, 50, null, null, null, 57, null, 53, null], drums: 'k.......s.......', leadType: 'triangle', bassType: 'sine' },
    'suspense': { bpm: 120, lead: [null, null, null, null, 63, null, null, null, null, null, null, null, 62, null, null, null], bass: [36, null, 36, null, 36, null, 36, null, 36, null, 36, null, 37, null, 37, null], drums: 'k...k...k...k.k.', leadType: 'sawtooth', bassType: 'sawtooth' },
    'war-drums': { bpm: 108, lead: [], bass: [33, null, null, null, null, null, 33, null, 33, null, null, null, null, null, null, null], drums: 'k.ks..k.kks.k.ss', leadType: 'sine', bassType: 'sine', bigDrums: true }
  };
  var RANDOM_GROUPS = {
    'random: 8-Bit': ['chip-adventure', 'chip-bounce', 'chip-race'],
    'random: Nhạc nhẹ': ['music-box', 'easy-keys'],
    'random: Nhạc điện ảnh': ['suspense', 'war-drums'],
    'random-music': Object.keys(SONGS)
  };

  function drum(out, kind, at, big) {
    if (kind === 'k') { tone(out, { freq: big ? 110 : 150, to: big ? 38 : 50, dur: big ? 0.5 : 0.18, gain: big ? 0.9 : 0.7, at: at }); }
    else if (kind === 's') { burst(out, { ftype: big ? 'lowpass' : 'highpass', freq: big ? 900 : 1500, dur: big ? 0.3 : 0.12, gain: big ? 0.5 : 0.3, at: at }); }
    else if (kind === 'h') { burst(out, { ftype: 'highpass', freq: 7000, dur: 0.035, gain: 0.12, at: at }); }
  }

  function playSong(id, bus) {
    var song = SONGS[id];
    var step16 = 60 / song.bpm / 4;
    var step = 0;
    var next = ctx.currentTime + 0.06;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = song.leadType === 'square' ? 3200 : 6000; lp.connect(bus);
    function schedule() {
      while (next < ctx.currentTime + 0.25) {
        var n = song.lead.length ? song.lead[step % song.lead.length] : null;
        if (n != null) {
          if (song.bell) bell(lp, next, mf(n), 1.2, 0.1, [[1, 1], [2, 0.25], [3, 0.08]]);
          else tone(lp, { type: song.leadType, freq: mf(n), dur: step16 * 1.8, hold: step16 * 0.6, gain: song.leadType === 'square' ? 0.07 : 0.16, at: next });
        }
        var b = song.bass[step % song.bass.length];
        if (b != null) tone(bus, { type: song.bassType, freq: mf(b), dur: step16 * (song.bpm < 100 ? 3.5 : 1.6), hold: step16 * 0.5, gain: song.bassType === 'sawtooth' ? 0.08 : 0.22, at: next });
        if (song.drums) drum(bus, song.drums[step % song.drums.length], next, song.bigDrums);
        step++;
        next += step16;
      }
    }
    schedule();
    var timer = setInterval(schedule, 60);
    return function () { clearInterval(timer); };
  }

  // Non-musical loops.
  function playLoop(id, bus) {
    if (id === 'drum-roll') {
      var on = true, t0 = ctx.currentTime, next = t0 + 0.03;
      var timer = setInterval(function () {
        while (on && next < ctx.currentTime + 0.2) {
          burst(bus, { ftype: 'bandpass', freq: 2200, q: 0.6, dur: 0.07, gain: 0.25 + Math.random() * 0.08, at: next });
          tone(bus, { freq: 190, to: 140, dur: 0.05, gain: 0.08, at: next });
          next += 0.045;
        }
      }, 50);
      return function () { on = false; clearInterval(timer); };
    }
    if (id === 'microwave-oven') {
      var hum = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), fan = noise();
      hum.type = 'sawtooth'; hum.frequency.value = 100; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0.18;
      hum.connect(f); f.connect(g); g.connect(bus);
      var nf = ctx.createBiquadFilter(), ng = ctx.createGain();
      fan.loop = true; nf.type = 'bandpass'; nf.frequency.value = 700; nf.Q.value = 0.8; ng.gain.value = 0.12;
      fan.connect(nf); nf.connect(ng); ng.connect(bus);
      hum.start(); fan.start();
      return function () { try { hum.stop(); fan.stop(); } catch (e) {} };
    }
    return function () {};
  }

  function resolveLoop(id) {
    if (RANDOM_GROUPS[id]) { var pool = RANDOM_GROUPS[id]; return pool[Math.floor(Math.random() * pool.length)]; }
    return id;
  }

  function speak(text, vol, voiceIndex, lang) {
    if (!('speechSynthesis' in window) || !text) return null;
    var voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    var prefix = (lang || 'vi').slice(0, 2).toLowerCase();
    var matches = voices.filter(function (v) { return (v.lang || '').toLowerCase().indexOf(prefix) === 0; });
    var voice = voiceIndex === 2 ? (matches[1] || matches[0] || voices[0]) : (matches[0] || voices[0]);
    var u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.volume = Math.max(0, Math.min(1, vol));
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return { stop: function () { speechSynthesis.cancel(); } };
  }
  if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); } catch (e) {} }

  var LOOP_IDS = ['drum-roll', 'microwave-oven'].concat(Object.keys(SONGS), Object.keys(RANDOM_GROUPS));
  var FX_POOL = Object.keys(FX);
  var NONE = { stop: function () {} };

  window.Sound = {
    unlock: function () { ac(); },
    setMuted: function (m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 1; },
    isMuted: function () { return muted; },
    isLoop: function (id) { return LOOP_IDS.indexOf(id) >= 0; },
    has: function (id) { return !!FX[id] || LOOP_IDS.indexOf(id) >= 0 || id === 'ticking-sound' || id === 'no-sound' || id === 'random-sound' || /^read-winner-sound/.test(id); },

    // One "ding" each time a slice boundary passes the pointer.
    tick: function (volume) {
      if (inIframe || muted || !volume || !ac()) return;
      var bus = newBus(volume / 100);
      tone(bus, { type: 'triangle', freq: 2350, to: 1500, dur: 0.045, gain: 0.55 });
      tone(bus, { freq: 4700, dur: 0.02, gain: 0.12 });
      burst(bus, { ftype: 'highpass', freq: 5000, dur: 0.012, gain: 0.25 });
      setTimeout(function () { try { bus.disconnect(); } catch (e) {} }, 200);
    },

    // Looping during-spin sound; the handle's stop(1000) fades it out like the original.
    startLoop: function (id, volume) {
      if (inIframe || !id || !ac() || LOOP_IDS.indexOf(id) < 0) return NONE;
      var bus = newBus(volume / 100);
      var real = resolveLoop(id);
      var stopper = SONGS[real] ? playSong(real, bus) : playLoop(real, bus);
      return handle(bus, stopper);
    },

    // After-spin effect (or speech of `text`).
    play: function (id, volume, text, lang) {
      if (inIframe || !id || id === 'no-sound' || !ac()) return NONE;
      if (id === 'read-winner-sound' || id === 'read-winner-sound-2') return speak(text, volume / 100, id === 'read-winner-sound-2' ? 2 : 1, lang) || NONE;
      if (id === 'random-sound') id = FX_POOL[Math.floor(Math.random() * FX_POOL.length)];
      var fx = FX[id] || FX['applause-sound-soft'];
      var bus = newBus(volume / 100);
      var h = handle(bus);
      var dur = fx(bus);
      setTimeout(function () { h.stop(50); }, (dur + 0.3) * 1000);
      return h;
    },

    click: function (volume) {
      if (inIframe || muted || !volume || !ac()) return;
      var bus = newBus(volume / 100);
      burst(bus, { ftype: 'bandpass', freq: 3200, q: 1.4, dur: 0.03, gain: 0.8 });
      tone(bus, { type: 'square', freq: 900, to: 400, dur: 0.03, gain: 0.08 });
      setTimeout(function () { try { bus.disconnect(); } catch (e) {} }, 200);
    },

    stopAll: function () {
      active.forEach(function (h) { h.stop(80); });
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
  };
})();
