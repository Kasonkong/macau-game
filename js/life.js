'use strict';
/* =====================================================================
   life (v2.2): vehicle lights at night and brake lights, skid marks,
   umbrellas in the rain, lightning, ferries and planes, shop opening
   hours, pedestrians' speech bubbles, city ambience and footsteps.
   ===================================================================== */
const LIFE = { carNight: { value: 0 }, brake: { value: 0 }, zero: { value: 0 }, playerTrim: null, curMesh: null, skid: null, skidI: 0, skidPrev: null, skidT: 0, umb: null, flashT: 0, thunderT: -1, ferries: [], planes: [], bubbleT: 0, bubbleP: null, bubbleCool: 0, stepT: 0 };

/* vertex-coloured lamp parts (head, tail, taxi roof sign, bus destination board) glow at night */
function patchLights(mat, brakeU, key) {
  const prev = mat.onBeforeCompile; const own = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null; mat.customProgramCacheKey = () => (own ? own() : '') + '|L' + key;
  mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uCarNight = LIFE.carNight; sh.uniforms.uBrake = brakeU;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uCarNight;uniform float uBrake;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef USE_COLOR
{vec3 vc=vColor;float hd=step(distance(vc,vec3(.965,.945,.847)),.03);float tl=step(distance(vc,vec3(.761,.153,.122)),.03);float tx=step(distance(vc,vec3(.957,.906,.722)),.03)+step(distance(vc,vec3(.941,.655,.2)),.03);
totalEmissiveRadiance+=vc*(hd*uCarNight*2.2+tl*(uCarNight*1.1+uBrake*2.4)+tx*uCarNight*1.3);}
#endif`); }; }

LIFE.build = function () {
  patchLights(trimMat, LIFE.zero, 't'); trimMat.needsUpdate = true;
  for (const t in tPools) { const m = tPools[t].trim.material; if (m !== trimMat) { patchLights(m, LIFE.zero, 't'); m.needsUpdate = true; } }
  LIFE.playerTrim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .2 }); nearFade(LIFE.playerTrim, 2.6); patchLights(LIFE.playerTrim, LIFE.brake, 'p');
  // skid marks: ring buffer of dark quads
  const sm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }), 900);
  const o = new THREE.Object3D(); o.scale.set(0, 0, 0); o.updateMatrix(); for (let i = 0; i < 900; i++) sm.setMatrixAt(i, o.matrix); sm.frustumCulled = false; sm.renderOrder = 1; world.add(sm); LIFE.skid = sm;
  // umbrellas, one per pedestrian slot
  const n = PEDS.length; const ug = partsGeo([{ g: new THREE.ConeGeometry(.62, .32, 10, 1, true), y: 2.12 }, { g: new THREE.CylinderGeometry(.015, .015, 1.0, 4), y: 1.62, c: '#333333' }]);
  const um = new THREE.InstancedMesh(ug, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, side: THREE.DoubleSide }), n); const UC = ['#1F3A5F', '#C62828', '#2A2D30', '#F2C14E', '#2E7D5B', '#8E6CC9', '#E8577A', '#EDEAE3'];
  for (let i = 0; i < n; i++) { um.setMatrixAt(i, o.matrix); um.setColorAt(i, C(UC[i % UC.length])); } um.frustumCulled = false; um.castShadow = true; world.add(um); LIFE.umb = um;
  // ferries: Outer Harbour and Taipa terminals out towards Hong Kong
  const ferryGeo = partsGeo([{ g: new THREE.BoxGeometry(9, 2.4, 30), y: 1.2, c: '#F4F4F2' }, { g: new THREE.BoxGeometry(9.05, .5, 30.05), y: 1.4, c: '#C62828' }, { g: new THREE.BoxGeometry(8, 2.6, 21), y: 3.7, z: -1.5, c: '#EDEDEA' }, { g: new THREE.BoxGeometry(8.1, .9, 20), y: 3.9, z: -1.5, c: '#1F2A31' }, { g: new THREE.BoxGeometry(5, 1.4, 6), y: 5.6, z: 4, c: '#F4F4F2' }, { g: new THREE.BoxGeometry(5.1, .5, 2), y: 5.7, z: 6.6, c: '#1F2A31' }]);
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .45, depthWrite: false }); const fmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5 }); patchLights(fmat, LIFE.zero, 'f');
  const routes = [[[22.1960, 113.5612], [22.1885, 113.5612], [22.1840, 113.5800], [22.1950, 113.6000], [22.2150, 113.6400], [22.2300, 113.6800]], [[22.1605, 113.5830], [22.1630, 113.5842], [22.1665, 113.5842], [22.1720, 113.5880], [22.1900, 113.6100], [22.2100, 113.6450], [22.2250, 113.6800]]];
  routes.forEach((rt, ri) => { const pts = rt.map(([la, lo]) => toXZ(lo, la)); const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    for (let k = 0; k < 2; k++) { const g = new THREE.Group(); const hull = new THREE.Mesh(ferryGeo, fmat); hull.castShadow = true; const wake = new THREE.Mesh(new THREE.PlaneGeometry(10, 60).rotateX(-Math.PI / 2).translate(0, .25, -44), wakeMat); g.add(hull, wake); world.add(g);
      LIFE.ferries.push({ g, pts, cum, s: cum[cum.length - 1] * (k * .5 + ri * .23) % cum[cum.length - 1], dir: k ? -1 : 1, v: 15, wait: 0 }); } });
  // planes: landings and take-offs on the airport runway
  const pg = partsGeo([{ g: new THREE.CylinderGeometry(2, 2, 37, 12).rotateX(Math.PI / 2), y: 0, c: '#F4F4F2' }, { g: new THREE.SphereGeometry(2, 12, 8), z: 18.5, c: '#F4F4F2' }, { g: new THREE.ConeGeometry(2, 6, 12).rotateX(-Math.PI / 2), z: -21.5, c: '#F4F4F2' },
    { g: new THREE.BoxGeometry(34, .45, 5.5), y: -.6, z: 1, c: '#DADBD8' }, { g: new THREE.BoxGeometry(12, .3, 3), y: .6, z: -20, c: '#DADBD8' }, { g: new THREE.BoxGeometry(.4, 6, 4.5), y: 3.6, z: -20.5, c: '#1F5FA8' },
    { g: new THREE.CylinderGeometry(1, 1, 4, 10).rotateX(Math.PI / 2), x: -6, y: -1.8, z: 2.5, c: '#B9BCBE' }, { g: new THREE.CylinderGeometry(1, 1, 4, 10).rotateX(Math.PI / 2), x: 6, y: -1.8, z: 2.5, c: '#B9BCBE' }, { g: new THREE.BoxGeometry(4.1, .9, 30), y: .6, c: '#1F2A31' }]);
  const pmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: .2 });
  for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(pg, pmat); m.castShadow = true; m.visible = false; world.add(m); LIFE.planes.push({ m, t: -k * 70 - 20, mode: k ? 'up' : 'down' }); }
};
const RW_C = [3268.2, 1259.4], RW_A = [0.3019, 0.9533];
function planePose(p, dt) { // landings come in from the north, take-offs leave northbound
  p.t += dt; const T = p.t; if (T < 0) return null; let s, h, th;
  if (p.mode === 'down') { th = Math.atan2(RW_A[0], RW_A[1]); const ta = 7700 / 72; if (T < ta) { s = -9000 + T * 72; h = (-1300 - s) * .052; } else { const tt = T - ta; if (tt > 12) return 'end'; s = -1300 + 72 * tt - 3 * tt * tt; h = 0; } }
  else { th = Math.atan2(-RW_A[0], -RW_A[1]); if (T < 30) { s = 1500 - 1.25 * T * T; h = 0; } else { const t2 = T - 30; s = 375 - 75 * t2; h = t2 * 7.5; if (s < -9000) return 'end'; } }
  return { x: RW_C[0] + RW_A[0] * s, z: RW_C[1] + RW_A[1] * s, y: BASE + 2.6 + h, th, pitch: p.mode === 'down' ? (h > 0 ? -.03 : 0) : (h > 0 ? -.14 : 0) }; }

/* ---------- per frame ---------- */
LIFE.update = function (dt, frozen) {
  LIFE.carNight.value = clamp((ENV.night - .3) / .5, 0, 1);
  FU.uClosed.value = shopClosedAmt(GAME.time);
  // swap the brake-light material onto the player's vehicle
  const c = player.car; const mesh = c ? c.mesh : null;
  if (mesh !== LIFE.curMesh) { if (LIFE.curMesh && LIFE.curMesh.children[1]) LIFE.curMesh.children[1].material = trimMat; if (mesh && mesh.children[1]) mesh.children[1].material = LIFE.playerTrim; LIFE.curMesh = mesh; }
  const hb = keys.has('Space') || GP.jump;
  LIFE.brake.value = c && ((c.thr < -.05 && (c.vf || 0) > .5) || (hb && Math.abs(c.vf || 0) > 1)) ? 1 : 0;
  // ferries
  for (const f of LIFE.ferries) { const L = f.cum[f.cum.length - 1]; if (f.wait > 0) { f.wait -= dt; } else { f.s += f.dir * f.v * dt; if (f.s > L || f.s < 0) { f.dir *= -1; f.s = clamp(f.s, 0, L); f.wait = f.s === 0 ? 50 : 8; } }
    let i = 1; while (i < f.cum.length - 1 && f.cum[i] < f.s) i++; const a = f.pts[i - 1], b = f.pts[i]; const t = (f.s - f.cum[i - 1]) / ((f.cum[i] - f.cum[i - 1]) || 1);
    const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; const th = Math.atan2((b[0] - a[0]) * f.dir, (b[1] - a[1]) * f.dir);
    f.g.position.set(x, .3 + Math.sin(EX.time.value * 1.3 + x) * .15, z); let d = th - f.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); f.g.rotation.y += d * Math.min(1, dt * .8); f.g.children[1].visible = f.wait <= 0; }
  // planes
  for (const p of LIFE.planes) { const r = planePose(p, dt); if (r === 'end') { p.mode = p.mode === 'down' ? 'up' : 'down'; p.t = -60 - Math.random() * 90; p.m.visible = false; continue; } if (!r) { p.m.visible = false; continue; }
    p.m.visible = true; p.m.position.set(r.x, r.y, r.z); p.m.rotation.set(r.pitch, r.th, 0, 'YXZ'); }
  if (frozen || !GAME.started) return;
  // skid marks
  LIFE.skidT -= dt;
  if (c && !c.air && c.type !== 'bus') { const spd = Math.hypot(c.vx, c.vz); const sliding = Math.abs(c.vl || 0) > 2.6 || (hb && spd > 6) || (LIFE.brake.value && spd > 14);
    if (sliding && LIFE.skidT <= 0) { LIFE.skidT = .04; const fx = Math.sin(c.th), fz = Math.cos(c.th), rx = Math.cos(c.th), rz = -Math.sin(c.th); const back = c.len / 2 - .9, half = c.type === 'scooter' ? 0 : c.wid / 2 - .25;
      const wheels = (c.type === 'scooter' ? [0] : [-1, 1]).map(sd => [c.x - fx * back + rx * half * sd, c.z - fz * back + rz * half * sd]);
      if (LIFE.skidPrev) { const o = new THREE.Object3D(); wheels.forEach((w, k) => { const q = LIFE.skidPrev[k]; if (!q) return; const dx = w[0] - q[0], dz = w[1] - q[1]; const len = Math.hypot(dx, dz); if (len < .05 || len > 4) return;
        o.position.set((w[0] + q[0]) / 2, surfaceAt(w[0], w[1], c.y + 1) + .035, (w[1] + q[1]) / 2); o.rotation.set(0, Math.atan2(dx, dz), 0); o.scale.set(c.type === 'scooter' ? .14 : .24, 1, len + .05); o.updateMatrix(); LIFE.skid.setMatrixAt(LIFE.skidI, o.matrix); LIFE.skidI = (LIFE.skidI + 1) % 900; }); LIFE.skid.instanceMatrix.needsUpdate = true; }
      LIFE.skidPrev = wheels; } else if (!sliding) LIFE.skidPrev = null; } else LIFE.skidPrev = null;
  // umbrellas
  if (LIFE.umb) { const show = ENV.rain > .25; const o = new THREE.Object3D(); let ch = show || LIFE.umbOn;
    if (ch) { for (const p of PEDS) { if (show && p.alive && p.y != null && hsh(p.i * 3 + 1) < .85) { o.position.set(p.x, p.y, p.z); o.rotation.set(0, p.th || 0, 0); o.scale.set(1, 1, 1); } else o.scale.set(0, 0, 0); o.updateMatrix(); LIFE.umb.setMatrixAt(p.i, o.matrix); } LIFE.umb.instanceMatrix.needsUpdate = true; }
    LIFE.umbOn = show; }
  // lightning & thunder
  if (ENV.weather === '雨' && ENV.rain > .7 && Math.random() < dt * .05) { LIFE.flashT = .35; LIFE.thunderT = 1 + Math.random() * 2.5; }
  if (LIFE.flashT > 0) { LIFE.flashT -= dt; const k = LIFE.flashT > .22 || (LIFE.flashT < .12 && LIFE.flashT > .06) ? 1 : 0; hemi.intensity += k * 1.6; if (EX.sky) EX.sky.material.uniforms.uH.value.lerp(_ca.set('#C9D4E6'), k * .7); }
  if (LIFE.thunderT > 0) { LIFE.thunderT -= dt; if (LIFE.thunderT <= 0) AMB.thunder(); }
  // pedestrians speak
  LIFE.bubbleCool -= dt; if (LIFE.bubbleT > 0) { LIFE.bubbleT -= dt; if (LIFE.bubbleT <= 0) $('bubble').hidden = true; else placeBubble(); }
  if (LIFE.bubbleCool <= 0) { const spd = c ? Math.hypot(c.vx, c.vz) : 0; let near = null, nd = 1e9; for (const p of PEDS) { if (!p.alive || p.x == null) continue; const d = Math.hypot(p.x - player.x, p.z - player.z); if (d < nd) { nd = d; near = p; } }
    if (near) { if (c && spd > 6 && nd < 3.2) say(near, PED_LINES.car); else if (!c && nd < .9) say(near, PED_LINES.bump); } }
  // ambience & footsteps
  AMB.update(dt, c);
};
function shopClosedAmt(t) { // most shops close 23:00–08:00 (shutters come down gradually)
  if (t >= 23 * 60 || t < 7 * 60 + 30) return 1; if (t < 8 * 60) return (8 * 60 - t) / 30; if (t > 22 * 60 + 30) return (t - (22 * 60 + 30)) / 30; return 0; }
function shopOpen(s, t) { const k = shopKind(s.cat); if (k === 'conv' || k === 'rest' || k === 'med' && /pharmacy/.test(s.cat)) return true; if (k === 'food' || k === 'fast') return !(t >= 2 * 60 && t < 7 * 60); return shopClosedAmt(t) < .5; }
const PED_LINES = { car: ['嘩！睇路呀！', '揸咁快做乜呀？', '小心啲呀後生仔！', '喂！行人路嚟㗎！', '嚇死我咩！'], bump: ['唔該借借～', '小心啲喎', 'Sorry 呀', '唔好意思'], horn: ['響乜嘢號呀？', '知道啦知道啦', '咪催啦！', '吓？'] };
function say(p, lines) { LIFE.bubbleP = p; LIFE.bubbleT = 2.4; LIFE.bubbleCool = 5; const el = $('bubble'); el.textContent = lines[(Math.random() * lines.length) | 0]; el.hidden = false; placeBubble(); }
const _bv = new THREE.Vector3();
function placeBubble() { const p = LIFE.bubbleP; if (!p || p.x == null) return; _bv.set(p.x, (p.y || 0) + 2.35, p.z).project(camera); const el = $('bubble');
  if (_bv.z > 1) { el.style.visibility = 'hidden'; return; } el.style.visibility = ''; el.style.left = ((_bv.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _bv.y) / 2 * innerHeight) + 'px'; }
function hornReaction() { let near = null, nd = 18; for (const p of PEDS) { if (!p.alive || p.x == null) continue; const d = Math.hypot(p.x - player.x, p.z - player.z); if (d < nd) { nd = d; near = p; } } if (near && LIFE.bubbleCool <= 0) say(near, PED_LINES.horn); }

/* ---------- ambience ---------- */
const AMB = { hum: null, birds: 0,
  init() { const ac = AUDIO.ac; if (!ac || this.hum) return; const s = ac.createBufferSource(); s.buffer = AUDIO.noise; s.loop = true; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; this.hum = ac.createGain(); this.hum.gain.value = 0; s.connect(lp).connect(this.hum).connect(AUDIO.master); s.start(); },
  update(dt, c) { if (!AUDIO.ac) return; this.init(); const traffic = TRAFFIC.filter(t => t.alive && Math.abs(t.x - player.x) < 120 && Math.abs(t.z - player.z) < 120).length;
    this.hum.gain.value += ((.008 + Math.min(.03, traffic * .002)) * (c ? .5 : 1) - this.hum.gain.value) * Math.min(1, dt * 2);
    if (!c && player.grounded) { const sp = player._sp || 0; if (sp > .5) { LIFE.stepT -= dt * sp / 1.6; if (LIFE.stepT <= 0) { LIFE.stepT = 1; this.step(sp > 6); } } }
    if (ENV.night < .3 && !c && Math.random() < dt * .05 && isLand(player.x, player.z)) this.bird(); },
  step(run) { const ac = AUDIO.ac, t = ac.currentTime; const s = ac.createBufferSource(); s.buffer = AUDIO.noise; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = run ? 900 : 650; f.Q.value = 1.2; const g = ac.createGain(); g.gain.setValueAtTime(run ? .09 : .06, t); g.gain.exponentialRampToValueAtTime(.001, t + .07); s.connect(f).connect(g).connect(AUDIO.master); s.start(t, Math.random() * .5); s.stop(t + .09); },
  bird() { const ac = AUDIO.ac, t = ac.currentTime; const f0 = 2400 + Math.random() * 1600; for (let i = 0; i < 3; i++) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; const tt = t + i * .14; o.frequency.setValueAtTime(f0, tt); o.frequency.exponentialRampToValueAtTime(f0 * 1.35, tt + .08); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.025, tt + .02); g.gain.exponentialRampToValueAtTime(.0001, tt + .1); o.connect(g).connect(AUDIO.master); o.start(tt); o.stop(tt + .12); } },
  thunder() { const ac = AUDIO.ac; if (!ac) return; const t = ac.currentTime; const s = ac.createBufferSource(); s.buffer = AUDIO.noise; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(70, t + 3); const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .08); g.gain.exponentialRampToValueAtTime(.001, t + 3.2); s.connect(f).connect(g).connect(AUDIO.master); s.start(t); s.stop(t + 3.3); }
};

/* ---------- v2.3: mission givers at their markers, landmark night lighting, aviation lights ---------- */
const GIVERS = { pool: [], t: 0, labels: new Map() };
const GIVER_LOOK = { '陳伯': { skin: '#D2A47F', hair: '#C9C7C2', style: 'short', shirt: '#EDEAE3', pants: '#4A4A4A', shoes: '#2B2B2B' }, '陳伯個孫': { skin: '#E0B48C', hair: '#1B1816', style: 'cap', shirt: '#C62828', pants: '#2A3038', shoes: '#F4F4F2' }, '婆婆': { skin: '#D9B08D', hair: '#B9B7B2', style: 'bun', shirt: '#8E6CC9', pants: '#3a3a3a', shoes: '#2B2B2B' } };
function giverDef(m) { const n = m.giver || (m.cat === 'race' ? '賽車手' : '街坊'); if (GIVER_LOOK[n]) return GIVER_LOOK[n]; const h = k => hsh(m.id.charCodeAt(1) * 31 + m.id.length * 7 + k);
  const base = CHARS[(h(1) * CHARS.length) | 0]; return Object.assign({}, base, { style: m.cat === 'race' ? 'cap' : ['short', 'long', 'bun', 'cap'][(h(2) * 4) | 0], shirt: SHIRTS[(h(3) * SHIRTS.length) | 0] }); }
function giverLabel(text, col) { const key = text + col; if (GIVERS.labels.has(key)) return GIVERS.labels.get(key);
  const c = document.createElement('canvas'); const x = c.getContext('2d'); x.font = '700 40px ' + SIGN_FONT; const w = Math.ceil(x.measureText(text).width) + 36; c.width = w; c.height = 60;
  x.font = '700 40px ' + SIGN_FONT; x.fillStyle = 'rgba(12,20,25,.82)'; x.beginPath(); if (x.roundRect) x.roundRect(0, 0, w, 60, 14); else x.rect(0, 0, w, 60); x.fill(); x.fillStyle = col; x.fillRect(0, 54, w, 6); x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.fillText(text, 18, 29);
  const t = new THREE.CanvasTexture(c); const r = { t, aspect: w / 60 }; GIVERS.labels.set(key, r); return r; }
LIFE.buildMore = function () {
  for (let k = 0; k < 4; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: true })); sp.visible = false; world.add(sp); GIVERS.pool.push({ ch: null, sp, m: null }); }
  // landmark night lighting: an additive overlay sharing each landmark's geometry
  const near = (x, z) => { let best = null, bd = 1e18; for (const m of LM_MESHES) { const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const c = g.boundingSphere.center; const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < bd) { bd = d; best = m; } } return bd < 140 * 140 ? best : null; };
  const cen = r => { const q = decRing(r); let x = 0, z = 0; for (const p of q) { x += p[0]; z += p[1]; } return [x / q.length, z / q.length]; };
  const specs = []; if (MOD.lisboa_tower) specs.push([MOD.lisboa_tower.x, MOD.lisboa_tower.z, '#FFC24A', .5]); if (MOD.lisboa_podium) specs.push([...cen(MOD.lisboa_podium.ring), '#FF9F3A', .45]);
  if (D.tower) specs.push([D.tower[0], D.tower[1], '#A8C8FF', .22]); if (MOD.morpheus) specs.push([MOD.morpheus.x, MOD.morpheus.z, '#DDE6F0', .16]); if (MOD.bigben) specs.push([MOD.bigben.x, MOD.bigben.z, '#FFD9A0', .3]);
  if (MOD.studio && MOD.studio.towers && MOD.studio.towers[0]) specs.push([...cen(MOD.studio.towers[0]), '#FFD27A', .3]);
  LIFE.glows = []; const used = new Set();
  for (const [x, z, col, k] of specs) { const m = near(x, z); if (!m || used.has(m)) continue; used.add(m); const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const o = new THREE.Mesh(m.geometry, mat); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale); o.visible = false; world.add(o); LIFE.glows.push([o, k]); }
  // red aviation lights on the tallest buildings
  const tops = BINFO.filter(b => b.top - b.base > 105).map(b => [b.cx, b.top + .6, b.cz]); if (D.tower) tops.push([D.tower[0], groundAt(D.tower[0], D.tower[1]) + 338.5, D.tower[1]]); if (MOD.lisboa_tower) tops.push([MOD.lisboa_tower.x, MOD.lisboa_tower.y + 258, MOD.lisboa_tower.z]);
  const am = new THREE.InstancedMesh(new THREE.SphereGeometry(.9, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }), Math.max(1, tops.length)); const o = new THREE.Object3D();
  tops.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.updateMatrix(); am.setMatrixAt(i, o.matrix); }); am.count = tops.length; am.frustumCulled = false; world.add(am); LIFE.avi = am;
};
LIFE.updateMore = function (dt) {
  const n = clamp((ENV.night - .3) / .5, 0, 1);
  for (const [o, k] of LIFE.glows || []) { o.visible = n > 0; o.material.opacity = n * k; }
  if (LIFE.avi) LIFE.avi.visible = n > 0 && (EX.time.value % 1.6) < .8;
  // givers
  GIVERS.t -= dt; if (GIVERS.t <= 0) { GIVERS.t = .5; const want = (MS.cur || MS.job) ? [] : MS.markers.filter(mk => missionAvailable(mk.m)).map(mk => ({ mk, d: Math.hypot(mk.p.x - player.x, mk.p.z - player.z) })).filter(o => o.d < 150).sort((a, b) => a.d - b.d).slice(0, GIVERS.pool.length).map(o => o.mk);
    for (const g of GIVERS.pool) if (g.m && !want.includes(g.m)) { if (g.ch) world.remove(g.ch.group); g.ch = null; g.m = null; g.sp.visible = false; }
    for (const mk of want) { if (GIVERS.pool.some(g => g.m === mk)) continue; const g = GIVERS.pool.find(q => !q.m); if (!g) break; g.m = mk; const m = mk.m;
      g.ch = makeCharacter(giverDef(m), null); const r = roadPos(mk.p.x, mk.p.z, { noBridge: true }); let x = mk.p.x, z = mk.p.z;
      if (r) { const nx = r.dz, nz = -r.dx; const sd = ((mk.p.x - r.x) * nx + (mk.p.z - r.z) * nz) >= 0 ? 1 : -1; x += nx * sd * 1.5 + r.dx * 1.8; z += nz * sd * 1.5 + r.dz * 1.8; }
      g.x = x; g.z = z; g.ch.group.position.set(x, surfaceAt(x, z, 99) - .02, z); world.add(g.ch.group);
      const lb = giverLabel(m.giver || (m.cat === 'race' ? '賽車手' : '街坊'), MK_COLORS[m.cat]); g.sp.material.map = lb.t; g.sp.material.needsUpdate = true; g.sp.scale.set(.45 * lb.aspect, .45, 1); g.sp.position.set(x, g.ch.group.position.y + 2.3, z); g.sp.visible = true; } }
  for (const g of GIVERS.pool) { if (!g.ch) continue; const d = Math.hypot(player.x - g.x, player.z - g.z); const ch = g.ch;
    if (d < 25) ch.group.rotation.y += (Math.atan2(Math.sin(Math.atan2(player.x - g.x, player.z - g.z) - ch.group.rotation.y), Math.cos(Math.atan2(player.x - g.x, player.z - g.z) - ch.group.rotation.y))) * Math.min(1, dt * 4);
    ch.armR.rotation.x = d < 9 ? -2.7 + Math.sin(EX.time.value * 7) * .35 : 0; ch.armR.rotation.z = d < 9 ? .25 : 0; ch.torso.position.y = 1.23 + Math.sin(EX.time.value * 2 + g.x) * .01; }
};
