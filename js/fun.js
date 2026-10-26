'use strict';
/* =====================================================================
   fun (v2.5): ride real buses, photograph street cats, nightly fireworks
   at Macau Tower, and daily challenges.
   ===================================================================== */
const FUN = { cats: [], catMesh: null, meowT: 0, fw: null, fwOn: false, fwT: 0, fwNext: 0, fwWarned: -1, shells: [], booms: [] };
if (!save.cats) save.cats = []; if (save.stats && save.stats.bus == null) save.stats.bus = 0; if (!save.day) save.day = 1;
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

/* ---------- buses ---------- */
const BUS_FARE = 6;
function nearStop() { let best = null, bd = 6 * 6; W.stops.forEach((s, i) => { const d = (s[0] - player.x) ** 2 + (s[1] - player.z) ** 2; if (d < bd) { bd = d; best = i; } }); return best; }
function busDialog(i) { const s0 = W.stops[i]; const name = S(s0[4]);
  const cand = W.stops.map((s, j) => ({ j, d: Math.hypot(s[0] - s0[0], s[1] - s0[1]), name: S(s[4]) })).filter(o => o.d > 700 && o.d < 9000 && o.name && o.name !== name);
  const seen = new Set(), pick = []; cand.sort((a, b) => hsh(a.j + s0[0] | 0) - hsh(b.j + s0[0] | 0));
  for (const o of cand) { if (seen.has(o.name) || pick.some(p => Math.hypot(W.stops[p.j][0] - W.stops[o.j][0], W.stops[p.j][1] - W.stops[o.j][1]) < 500)) continue; seen.add(o.name); pick.push(o); if (pick.length >= 9) break; }
  pick.sort((a, b) => a.d - b.d);
  const el = UI.openDlg('<span class="eb" style="color:var(--side)">巴士站 · ' + esc(name) + '</span><h2>搭巴士</h2><p>全程收費 MOP ' + BUS_FARE + '。揀個站，車程會計入遊戲時鐘。</p><div class="list">' +
    pick.map((o, k) => { const p = parishAt(W.stops[o.j][0], W.stops[o.j][1]); const mins = Math.round(o.d / 6.5 / 60 * 2 + 3); return '<button class="item" type="button" data-k="' + k + '"><span class="ic" style="background:var(--side)">巴</span><span class="nm">' + esc(o.name) + '</span><span class="ds">' + (p ? esc(p.name) + ' · ' : '') + (o.d / 1000).toFixed(1) + ' 公里 · 約 ' + mins + ' 分鐘</span><span class="rt">MOP ' + BUS_FARE + '</span></button>'; }).join('') + '</div><div class="row"><button class="btn" type="button" data-close>離開</button></div>', 'bus');
  el.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { const o = pick[+b.dataset.k]; if (save.money < BUS_FARE) { UI.toast('唔夠錢', '車費 MOP ' + BUS_FARE + '。', 2); return; }
    if (MS.cur && MS.cur.steps[MS.step] && ['pass', 'race', 'follow'].includes(MS.cur.steps[MS.step].k)) { UI.toast('而家唔得', '任務進行中唔可以搭巴士。', 2); return; }
    addMoney(-BUS_FARE); save.stats.bus = (save.stats.bus || 0) + 1; AUDIO.sfx('buy'); UI.closeDlg(); const mins = Math.round(o.d / 6.5 / 60 * 2 + 3);
    UI.fade(() => { const s = W.stops[o.j]; teleport(s[0] + Math.sin(s[3]) * 2.2, s[1] + Math.cos(s[3]) * 2.2); GAME.time = (GAME.time + mins) % 1440; UI.toast('到咗 ' + o.name, '車費 MOP ' + BUS_FARE + ' · 車程約 ' + mins + ' 分鐘', 3.5); }); })); }

/* ---------- street cats ---------- */
const CAT_COATS = [['#E3913B', '#F2C08A'], ['#1E1E1E', '#1E1E1E'], ['#F2F0EA', '#2A2A2A'], ['#8C8C8C', '#BDBDBD'], ['#E3913B', '#2A2A2A'], ['#F2F0EA', '#E3913B']];
function buildCats() {
  // 30 cats sitting on pavements of small lanes, spread across the city (old districts first)
  const lanes = []; ROADS.forEach((rd, ri) => { if (rd.cls >= 2 && !rd.br && rd.len > 25) lanes.push(ri); });
  lanes.sort((a, b) => hsh(a * 7 + 11) - hsh(b * 7 + 11));
  for (const ri of lanes) { if (FUN.cats.length >= 30) break; const rd = ROADS[ri]; const p = roadPoint(rd, rd.len * (.3 + hsh(ri) * .4)); const sd = hsh(ri + 3) < .5 ? 1 : -1; const nx = p[4], nz = -p[3];
    const x = p[0] + nx * (rd.hw + .9) * sd, z = p[1] + nz * (rd.hw + .9) * sd; if (!isLand(x, z) || collide(x, z, .3, groundAt(x, z), 1).hit) continue;
    if (FUN.cats.some(c => Math.hypot(c.x - x, c.z - z) < 450)) continue; FUN.cats.push({ i: FUN.cats.length, x, z, y: surfaceAt(x, z, 99), th: Math.atan2(-nx * sd, -nz * sd) + (hsh(ri + 5) - .5) * 1.5, coat: (hsh(ri + 9) * CAT_COATS.length) | 0 }); }
  const geo = coat => partsGeo([{ g: new THREE.SphereGeometry(.17, 10, 8), y: .2, z: -.05, c: coat[0] }, { g: new THREE.SphereGeometry(.14, 10, 8), y: .3, z: -.02, c: coat[1] }, { g: new THREE.SphereGeometry(.11, 10, 8), y: .44, z: .1, c: coat[0] },
    { g: new THREE.ConeGeometry(.04, .08, 4), x: -.06, y: .54, z: .1, c: coat[0] }, { g: new THREE.ConeGeometry(.04, .08, 4), x: .06, y: .54, z: .1, c: coat[0] }, { g: new THREE.SphereGeometry(.018, 6, 4), x: -.04, y: .46, z: .2, c: '#C9D94A' }, { g: new THREE.SphereGeometry(.018, 6, 4), x: .04, y: .46, z: .2, c: '#C9D94A' },
    { g: new THREE.CylinderGeometry(.025, .02, .34, 6), y: .1, z: -.26, rx: 1.2, c: coat[0] }]);
  FUN.catMeshes = CAT_COATS.map((coat, k) => { const list = FUN.cats.filter(c => c.coat === k); const m = new THREE.InstancedMesh(geo(coat), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }), Math.max(1, list.length)); m.count = list.length; m.frustumCulled = false; m.castShadow = true; world.add(m); m.userData.list = list; return m; });
  FUN.placeCats(); }
FUN.placeCats = function () { const o = new THREE.Object3D(); for (const m of FUN.catMeshes) { m.userData.list.forEach((c, k) => { o.position.set(c.x, c.y, c.z); o.rotation.set(0, c.th, 0); o.scale.setScalar(1.3); o.updateMatrix(); m.setMatrixAt(k, o.matrix); }); m.instanceMatrix.needsUpdate = true; } };
FUN.catPhoto = function () { const fx = camTgt.x - camera.position.x, fz = camTgt.z - camera.position.z, fl = Math.hypot(fx, fz) || 1; let got = null;
  for (const c of FUN.cats) { if (save.cats.includes(c.i)) continue; const tx = c.x - camera.position.x, tz = c.z - camera.position.z, d = Math.hypot(tx, tz); if (d > 22) continue; if ((fx * tx + fz * tz) / fl / d > .88) { got = c; break; } }
  if (!got) return false; save.cats.push(got.i); addMoney(80); persist(); setTimeout(() => { AMB.meow(1); UI.toast('影到街貓 ' + save.cats.length + ' / ' + FUN.cats.length, '喵～ MOP +80', 3.5); }, 400); return true; };

/* ---------- fireworks (nightly 21:00–21:15 over the sea by Macau Tower) ---------- */
function buildFireworks() { if (!D.tower) return; const [tx, tz] = D.tower; let best = null, bs = -1;
  for (let a = 0; a < 24; a++) for (const r of [250, 350, 450]) { const x = tx + Math.cos(a / 24 * 6.283) * r, z = tz + Math.sin(a / 24 * 6.283) * r; if (isLand(x, z)) continue; let w = 0; for (let b = 0; b < 8; b++) if (!isLand(x + Math.cos(b) * 120, z + Math.sin(b) * 120)) w++; if (w > bs) { bs = w; best = [x, z]; } }
  if (!best) return; FUN.fwPos = best; const N = 2400; const pos = new Float32Array(N * 3), col = new Float32Array(N * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 9, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true })); pts.frustumCulled = false; world.add(pts);
  FUN.fw = { pts, pos, col, N, p: [] }; for (let i = 0; i < N; i++) { FUN.fw.p.push({ life: 0 }); pos[i * 3 + 1] = -999; } }
const FW_COLS = ['#FF4D4D', '#FFD24D', '#4DD2FF', '#7CFF6B', '#FF7BEA', '#FFFFFF', '#FF9F3A', '#B48CFF'];
function fwShell() { const [x0, z0] = FUN.fwPos; FUN.shells.push({ x: x0 + (Math.random() - .5) * 240, z: z0 + (Math.random() - .5) * 120, y: 2, vy: 70 + Math.random() * 25, fuse: 1.6 + Math.random() * .9, col: FW_COLS[(Math.random() * FW_COLS.length) | 0], col2: Math.random() < .35 ? FW_COLS[(Math.random() * FW_COLS.length) | 0] : null, kind: Math.random() < .25 ? 'ring' : Math.random() < .2 ? 'willow' : 'peony' }); }
function fwEmit(x, y, z, vx, vy, vz, c, life, drag) { const F = FUN.fw; for (let i = 0; i < F.N; i++) { const p = F.p[i]; if (p.life > 0) continue; Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, drag, r: c.r, g: c.g, b: c.b }); return; } }
function fwBurst(s) { const n = s.kind === 'ring' ? 90 : 150; const ca = C(s.col), cb = s.col2 ? C(s.col2) : ca; const sp = s.kind === 'willow' ? 36 : 55; const ax = Math.random() * 6.28;
  for (let i = 0; i < n; i++) { let vx, vy, vz; if (s.kind === 'ring') { const a = i / n * 6.283; vx = Math.cos(a) * sp; vy = Math.sin(a) * sp * .9; vz = Math.sin(a + ax) * 6; }
    else { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u); const k = sp * (.75 + Math.random() * .25); vx = r * Math.cos(a) * k; vy = u * k; vz = r * Math.sin(a) * k; }
    fwEmit(s.x, s.y, s.z, vx, vy, vz, i % 2 ? ca : cb, s.kind === 'willow' ? 3.6 : 2.2 + Math.random() * .6, s.kind === 'willow' ? 1.6 : 1.1); }
  const d = Math.hypot(s.x - camera.position.x, s.z - camera.position.z); FUN.booms.push({ t: d / 340, v: clamp(1 - d / 5000, .08, 1) }); FUN.flash = .25; }
function updateFireworks(dt) { const F = FUN.fw; if (!F) return; const t = GAME.time; const on = t >= 21 * 60 && t < 21 * 60 + 15;
  if (GAME.started && t >= 20 * 60 + 52 && t < 21 * 60 && FUN.fwWarned !== save.day) { FUN.fwWarned = save.day; UI.toast('旅遊塔煙花表演', '21:00 開始，喺西灣湖或者南灣海邊睇最靚。', 5); }
  if (on) { FUN.fwT -= dt; if (FUN.fwT <= 0) { const finale = t > 21 * 60 + 12; FUN.fwT = finale ? .18 : .7 + Math.random() * 1.1; fwShell(); if (finale && Math.random() < .5) fwShell(); } }
  for (let i = FUN.shells.length - 1; i >= 0; i--) { const s = FUN.shells[i]; s.vy -= 9.8 * dt; s.y += s.vy * dt; s.fuse -= dt; fwEmit(s.x, s.y, s.z, (Math.random() - .5) * 2, -4, (Math.random() - .5) * 2, _ca.set('#FFE2A8'), .5, 1); if (s.fuse <= 0) { fwBurst(s); FUN.shells.splice(i, 1); } }
  for (let i = FUN.booms.length - 1; i >= 0; i--) { const b = FUN.booms[i]; b.t -= dt; if (b.t <= 0) { AMB.boom(b.v); FUN.booms.splice(i, 1); } }
  let any = false; for (let i = 0; i < F.N; i++) { const p = F.p[i]; const o = i * 3; if (p.life <= 0) { if (F.pos[o + 1] !== -999) { F.pos[o + 1] = -999; any = true; } continue; } any = true;
    p.life -= dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy = p.vy * k - 9.8 * dt * .55; p.vz *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const a = clamp(p.life / p.max, 0, 1); const fl = a * (.75 + Math.random() * .25); F.pos[o] = p.x; F.pos[o + 1] = p.y; F.pos[o + 2] = p.z; F.col[o] = p.r * fl; F.col[o + 1] = p.g * fl; F.col[o + 2] = p.b * fl; }
  if (any) { F.pts.geometry.attributes.position.needsUpdate = true; F.pts.geometry.attributes.color.needsUpdate = true; }
  if (FUN.flash > 0) { FUN.flash -= dt; hemi.intensity += FUN.flash * 1.2 * ENV.night; } }

/* ---------- daily challenges ---------- */
const DAILY_POOL = [
  { id: 'km', t: '揸車 5 公里', v: () => save.stats.dist / 1000, need: 5 },
  { id: 'tart', t: '收集 1 個葡撻', v: () => save.tarts.length, need: 1 },
  { id: 'cat', t: '影 1 隻街貓', v: () => save.cats.length, need: 1 },
  { id: 'jobs', t: '打工完成 3 單', v: () => save.stats.jobRuns || 0, need: 3 },
  { id: 'ride', t: '搭 1 次巴士或輕軌', v: () => (save.stats.bus || 0) + (save.stats.lrt || 0), need: 1 },
  { id: 'mis', t: '完成 1 個任務或競速', v: () => save.stats.missions || 0, need: 1 },
  { id: 'lm', t: '打卡 1 個新地標', v: () => save.lms.length, need: 1 },
  { id: 'photo', t: '影 3 張相', v: () => save.stats.photos, need: 3 },
  { id: 'shop', t: '喺舖頭買 2 次嘢', v: () => save.stats.buys || 0, need: 2 },
  { id: 'clean', t: '連續 2 公里冇違例', v: () => save.stats.clean / 1000, need: 2, abs: true }
];
const DAILY_REWARD = 300;
function dailyEnsure() { const d = save.daily; if (d && d.day === save.day) return d; const ids = DAILY_POOL.slice().sort((a, b) => hsh(save.day * 31 + a.id.charCodeAt(0) * 7 + a.id.length) - hsh(save.day * 31 + b.id.charCodeAt(0) * 7 + b.id.length)).slice(0, 3).map(c => c.id);
  const base = {}; for (const id of ids) { const c = DAILY_POOL.find(q => q.id === id); base[id] = c.abs ? 0 : c.v(); } save.daily = { day: save.day, ids, base, done: [] }; persist(); return save.daily; }
function dailyProgress(id) { const d = dailyEnsure(); const c = DAILY_POOL.find(q => q.id === id); return clamp(c.v() - d.base[id], 0, c.need); }
FUN.appDaily = function (s, back) { const d = dailyEnsure();
  s.innerHTML = UI.appHead('今日挑戰') + '<p style="color:var(--ink-soft);font-size:13px;margin:0">第 ' + save.day + ' 日（星期' + WEEKDAY[save.day % 7] + '）· 每個挑戰獎勵 MOP ' + DAILY_REWARD + '，遊戲過咗午夜會換新挑戰。</p><div class="list">' +
    d.ids.map(id => { const c = DAILY_POOL.find(q => q.id === id); const p = dailyProgress(id); const done = d.done.includes(id); return '<div class="item' + (done ? ' done' : '') + '" style="cursor:default"><span class="ic" style="background:' + (done ? 'var(--accent)' : '#3B4A55') + ';color:' + (done ? '#1B1606' : '#fff') + '">' + (done ? '✓' : '!') + '</span><span class="nm">' + c.t + '</span><span class="ds"><span class="bar" style="display:block;margin-top:4px"><i style="width:' + (p / c.need * 100) + '%"></i></span></span><span class="rt">' + (c.need % 1 || p % 1 ? p.toFixed(1) : p) + ' / ' + c.need + '</span></div>'; }).join('') + '</div>' +
    '<h3 style="margin:6px 0 0;font-size:11px;letter-spacing:.2em;color:var(--ink-soft)">今晚</h3><div class="glass" style="padding:10px 12px;font-size:13px">21:00 旅遊塔煙花表演（每晚 15 分鐘）</div>'; back(); };
function dailyTick() { const d = dailyEnsure(); for (const id of d.ids) { if (d.done.includes(id)) continue; const c = DAILY_POOL.find(q => q.id === id); if (dailyProgress(id) >= c.need) { d.done.push(id); addMoney(DAILY_REWARD); AUDIO.sfx('done'); UI.toast('今日挑戰完成：' + c.t, 'MOP +' + DAILY_REWARD + (d.done.length === 3 ? ' · 今日三個挑戰全部完成！' : ''), 4.5); persist(); break; } } }

/* ---------- build & update ---------- */
FUN.build = function () { buildCats(); buildFireworks(); dailyEnsure(); FUN.built = true; };
FUN.t = 0;
FUN.update = function (dt, frozen) {
  updateFireworks(dt);
  if (!GAME.started || frozen) return;
  FUN.t -= dt; if (FUN.t <= 0) { FUN.t = 1; dailyTick(); }
  FUN.meowT -= dt; if (FUN.meowT <= 0) { FUN.meowT = 2; for (const c of FUN.cats) { const d = Math.hypot(c.x - player.x, c.z - player.z); if (d < 9 && Math.random() < .5) { AMB.meow(clamp(1 - d / 10, .2, 1)); break; } } }
};
Object.assign(AMB, {
  meow(v) { const ac = AUDIO.ac; if (!ac) return; const t = ac.currentTime; const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(); o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2;
    const f0 = 520 + Math.random() * 160; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.45, t + .18); o.frequency.linearRampToValueAtTime(f0 * .9, t + .5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06 * v, t + .06); g.gain.exponentialRampToValueAtTime(.001, t + .55); o.connect(f).connect(g).connect(AUDIO.master); o.start(t); o.stop(t + .6); },
  boom(v) { const ac = AUDIO.ac; if (!ac) return; const t = ac.currentTime; const s = ac.createBufferSource(); s.buffer = AUDIO.noise; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.2);
    const g = ac.createGain(); g.gain.setValueAtTime(.4 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + 1.4); s.connect(f).connect(g).connect(AUDIO.master); s.start(t, Math.random() * .4); s.stop(t + 1.5); }
});
