'use strict';
/* =====================================================================
   audio: engine & skid, sound effects, three procedural radio stations.
   ===================================================================== */
const AUDIO = {
  ac: null, master: null, eng: null, engGain: null, engF: null, skid: null, radioGain: null, station: 0, nextT: 0, step: 0, bar: 0,
  STATIONS: [
    { name: '關閉', fm: '' },
    { name: '濠江夜話 Lo-fi', fm: 'FM 87.9', bpm: 78, root: 50, prog: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [3, 7, 10, 14]], lead: 'triangle', drums: 'lofi' },
    { name: '葡韻電台 Fado', fm: 'FM 98.0', bpm: 96, root: 52, prog: [[0, 3, 7], [5, 8, 12], [-5, -1, 2], [0, 3, 7]], lead: 'sine', drums: 'soft', arp: true },
    { name: '霓虹路氹 Synthwave', fm: 'FM 101.5', bpm: 112, root: 45, prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-7, -3, 0]], lead: 'sawtooth', drums: 'synth' }
  ],
  init() { if (this.ac) return; try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const ac = this.ac; this.master = ac.createGain(); this.master.gain.value = save.sound ? 1 : 0; this.master.connect(ac.destination);
    this.eng = ac.createOscillator(); this.eng.type = 'sawtooth'; this.engF = ac.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 650; this.engGain = ac.createGain(); this.engGain.gain.value = 0;
    this.eng.connect(this.engF).connect(this.engGain).connect(this.master); this.eng.start();
    const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    const ns = ac.createBufferSource(); ns.buffer = buf; ns.loop = true; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 2; this.skid = ac.createGain(); this.skid.gain.value = 0; ns.connect(bp).connect(this.skid).connect(this.master); ns.start();
    const rs = ac.createBufferSource(); rs.buffer = buf; rs.loop = true; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; this.rain = ac.createGain(); this.rain.gain.value = 0; rs.connect(lp).connect(this.rain).connect(this.master); rs.start();
    this.radioGain = ac.createGain(); this.radioGain.gain.value = 0; const comp = ac.createDynamicsCompressor(); this.radioGain.connect(comp).connect(this.master);
    this.station = save.radio || 1; },
  setMuted(m) { if (this.master) this.master.gain.value = m ? 0 : 1; },
  tone(f, t, dur, type, vol, dest, attack) { const ac = this.ac; const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (attack || .01)); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(dest || this.master); o.start(t); o.stop(t + dur + .05); },
  hit(t, kind, dest) { const ac = this.ac; if (kind === 'kick') { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + .18); g.gain.setValueAtTime(.55, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.connect(g).connect(dest); o.start(t); o.stop(t + .3); return; }
    const s = ac.createBufferSource(); s.buffer = this.noise; const f = ac.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800; const g = ac.createGain(); const v = kind === 'hat' ? .12 : .3, d = kind === 'hat' ? .05 : .16;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * .5); s.stop(t + d + .02); },
  sfx(name) { if (!this.ac) return; const t = this.ac.currentTime; const T = (f, d, ty, v, off) => this.tone(f, t + (off || 0), d, ty, v);
    if (name === 'coin') { T(988, .1, 'square', .07); T(1319, .25, 'square', .07, .08); }
    else if (name === 'ok' || name === 'cp') { T(784, .12, 'sine', .12); T(988, .18, 'sine', .12, .08); }
    else if (name === 'done') { [523, 659, 784, 1047].forEach((f, i) => T(f, .25, 'sine', .11, i * .09)); }
    else if (name === 'start') { T(392, .18, 'triangle', .12); T(523, .25, 'triangle', .12, .12); }
    else if (name === 'fail') { T(330, .25, 'sawtooth', .07); T(220, .4, 'sawtooth', .07, .2); }
    else if (name === 'tick') T(440, .15, 'square', .07); else if (name === 'go') T(880, .4, 'square', .08);
    else if (name === 'horn') { T(392, .35, 'square', .07); T(494, .35, 'square', .07); }
    else if (name === 'shutter') { this.hit(t, 'snare', this.master); }
    else if (name === 'buy') { T(660, .08, 'sine', .1); T(880, .12, 'sine', .1, .06); }
    else if (name === 'door') T(140, .12, 'triangle', .1);
    else if (name === 'thump') { const o = this.ac.createOscillator(), g = this.ac.createGain(); o.type = 'square'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + .25); g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.0001, t + .3); o.connect(g).connect(this.master); o.start(t); o.stop(t + .35); } },
  cycleRadio() { if (!this.ac) return; this.station = (this.station + 1) % this.STATIONS.length; save.radio = this.station; persist(); this.nextT = this.ac.currentTime + .05; this.step = 0; this.bar = 0; return this.STATIONS[this.station]; },
  update(dt, inCar, vf, throttle, skid, sport) {
    if (!this.ac) return; const ac = this.ac;
    this.engGain.gain.value = inCar ? .03 + Math.min(.05, Math.abs(throttle) * .04) : 0; this.eng.frequency.value = 36 + Math.abs(vf) * (sport ? 4.2 : 3.2) + (throttle > 0 ? 14 : 0);
    this.skid.gain.value = inCar ? Math.min(.12, skid * .02) : 0; this.rain.gain.value = ENV.rain * .06;
    const st = this.STATIONS[this.station]; const want = inCar && this.station > 0 ? .55 : 0; this.radioGain.gain.value += (want - this.radioGain.gain.value) * Math.min(1, dt * 3);
    if (this.station === 0 || !st.bpm) return; const spb = 60 / st.bpm / 2;
    if (this.nextT < ac.currentTime) this.nextT = ac.currentTime + .05;
    while (this.nextT < ac.currentTime + .25) { const t = this.nextT, i = this.step % 16; const ch = st.prog[this.bar % st.prog.length]; const R = this.radioGain; const f = n => 440 * Math.pow(2, (st.root + n - 69) / 12);
      if (i === 0) for (const n of ch) this.tone(f(n + 12), t, spb * 15, st.lead === 'sawtooth' ? 'sawtooth' : 'triangle', st.lead === 'sawtooth' ? .025 : .04, R, .08);
      if (i % 4 === 0) this.tone(f(ch[0] - 12), t, spb * 3.5, 'sine', .14, R);
      if (st.arp && i % 2 === 0) this.tone(f(ch[(i / 2) % ch.length] + 24), t, spb * 1.6, 'triangle', .05, R);
      if (st.lead === 'sawtooth' && i % 2 === 1) this.tone(f(ch[(i * 3) % ch.length] + 24), t, spb * .9, 'square', .018, R);
      if (!st.arp && st.lead === 'triangle' && (i === 6 || i === 10 || i === 14) && Math.random() < .7) this.tone(f(ch[(Math.random() * ch.length) | 0] + 24), t, spb * 2, 'sine', .05, R);
      if (st.drums === 'lofi') { if (i === 0 || i === 7 || i === 10) this.hit(t, 'kick', R); if (i === 4 || i === 12) this.hit(t, 'snare', R); if (i % 2 === 0) this.hit(t, 'hat', R); }
      if (st.drums === 'soft') { if (i === 0 || i === 8) this.hit(t, 'kick', R); if (i % 4 === 2) this.hit(t, 'hat', R); }
      if (st.drums === 'synth') { if (i % 4 === 0) this.hit(t, 'kick', R); if (i === 4 || i === 12) this.hit(t, 'snare', R); this.hit(t, 'hat', R); }
      this.nextT += spb; this.step++; if (this.step % 16 === 0) this.bar++; } }
};
