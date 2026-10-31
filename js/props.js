'use strict';
/* =====================================================================
   props: real shop signs & building name plates (text atlas pool),
   traffic lights, bus stops, street lamps, LRT viaduct + train,
   egg-tart collectibles, day/night cycle and weather.
   ===================================================================== */

/* ---------- environment palettes ---------- */
const PAL = {
  day: { sky: '#BFD5E1', sea: '#6593A8', seaDeep: '#355F73', land: '#A9A79E', mainland: '#A5A39B', hillLo: '#86996A', hillHi: '#577447', cnLo: '#B9BBAE', cnHi: '#7F9071', park: '#97B676', road: '#6E7275', runway: '#5B6063',
    trees: ['#5F8448', '#729554', '#557A40', '#80A05E'], roofbox: '#C2C0BA', hemiSky: '#F2F6FA', hemiGnd: '#7F8A7C', hemi: .5, sun: '#FFF1DA', sunI: .85 },
  night: { sky: '#0A1218', sea: '#0E2530', seaDeep: '#081820', land: '#34363A', mainland: '#2A2C2F', hillLo: '#25311F', hillHi: '#1A2617', cnLo: '#26292A', cnHi: '#1E241C', park: '#2A3A24', road: '#2C2F33', runway: '#1F2326',
    trees: ['#1E2D19', '#24341C', '#192616', '#2A3A20'], roofbox: '#4C4D50', hemiSky: '#6F84A6', hemiGnd: '#141B20', hemi: .32, sun: '#A9BAD8', sunI: .16 }
};
const ENV = { night: 0, dusk: 0, rain: 0, weather: '晴', temp: 29, lastPaint: -1, wetT: 0, nextWeather: 0 };
const _ca = new THREE.Color(), _cb = new THREE.Color();
function lerpHex(a, b, t) { return _ca.set(a).lerp(_cb.set(b), t).clone(); }
function lerpPal(t) { const o = {}; for (const k in PAL.day) { const a = PAL.day[k], b = PAL.night[k]; if (typeof a === 'number') o[k] = lerp(a, b, t); else if (Array.isArray(a)) o[k] = a.map((v, i) => lerpHex(v, b[i], t)); else o[k] = lerpHex(a, b, t); } return o; }
let rainLines = null;
function buildRain() {
  const N = 1400; const pos = new Float32Array(N * 6); for (let i = 0; i < N; i++) { const x = (Math.random() - .5) * 80, y = Math.random() * 40, z = (Math.random() - .5) * 80; pos.set([x, y, z, x + .15, y - 1.1, z], i * 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c6d4, transparent: true, opacity: .45 })); rainLines.frustumCulled = false; rainLines.visible = false; scene.add(rainLines);
}
function weatherRoll() { const r = Math.random(); ENV.weather = r < .55 ? '晴' : r < .82 ? '多雲' : '雨'; ENV.nextWeather = 240 + Math.random() * 360; }
function updateEnv(dt, timeMin, focus) {
  ENV.nextWeather -= dt * (1 / 60) * 60; if (ENV.nextWeather <= 0) weatherRoll();
  const targetRain = ENV.weather === '雨' ? 1 : 0; ENV.rain += (targetRain - ENV.rain) * Math.min(1, dt * .25);
  ENV.wetT += ((ENV.weather === '雨' ? 1 : 0) - ENV.wetT) * Math.min(1, dt * (ENV.weather === '雨' ? .3 : .02));
  const th = (timeMin - 6 * 60) / (12 * 60) * Math.PI; const alt = Math.sin(th);
  ENV.night = 1 - sstep(-0.1, 0.16, alt); ENV.dusk = Math.exp(-Math.pow(alt / 0.22, 2)) * (1 - ENV.night * .6);
  const hour = timeMin / 60; ENV.temp = Math.round(26 + 4 * Math.sin((hour - 9) / 24 * Math.PI * 2) - ENV.rain * 2.5);
  const cloud = ENV.weather === '晴' ? 0 : ENV.weather === '多雲' ? .45 : .8;
  if (Math.abs(ENV.night - ENV.lastPaint) > 0.06 || ENV.lastPaint < 0) { const P = lerpPal(ENV.night); colorHills(P); colorTrees(P); ENV.lastPaint = ENV.night; }
  const P = lerpPal(ENV.night);
  const sky = C(P.sky).lerp(C('#E9AE84'), ENV.dusk * .55).lerp(C(ENV.night > .5 ? '#11181D' : '#8E9AA3'), cloud * (ENV.night > .5 ? .35 : .55));
  renderer.setClearColor(sky); scene.fog.color.copy(sky);
  const far = lerp(3600, 2300, ENV.night) * (1 - ENV.rain * .55); scene.fog.near = far * .12; scene.fog.far = far;
  MAT.sea.color.copy(P.sea); MAT.seabed.color.copy(P.seaDeep); MAT.lake.color.copy(P.sea); MAT.land.color.copy(P.land); MAT.mainland.color.copy(P.mainland); MAT.park.color.copy(P.park);
  MAT.road.color.copy(P.road); MAT.runway.color.copy(P.runway); MAT.roof.color.copy(P.roofbox); MAT.side.color.setScalar(lerp(1, .45, ENV.night)); if (MAT.plaza) MAT.plaza.color.copy(MAT.side.color);
  hemi.color.copy(P.hemiSky).lerp(C('#FFD7B0'), ENV.dusk * .4); hemi.groundColor.copy(P.hemiGnd); hemi.intensity = P.hemi * (1 - cloud * .15);
  sun.color.copy(P.sun).lerp(C('#FFB074'), ENV.dusk * .7); sun.intensity = P.sunI * (1 - cloud * .65);
  if (ENV.night < .5) SUN_DIR.set(Math.cos(th) * .85, Math.max(.18, alt) , .42).normalize(); else SUN_DIR.set(-.3, .8, .4).normalize();
  FU.uNight.value = ENV.night; FU.uWet.value = ENV.wetT;
  for (const [m, e] of glowMats) m.emissive.set(e).multiplyScalar(ENV.night);
  LAMPS.headMat && LAMPS.headMat.emissive.setRGB(1, .82, .55).multiplyScalar(ENV.night * 1.2); LAMPS.lanternMat && LAMPS.lanternMat.emissive.setRGB(1, .78, .45).multiplyScalar(ENV.night * 1.5);
  SIGNS.glow.value = 0.08 + ENV.night * 0.95;
  if (rainLines) { rainLines.visible = ENV.rain > .05; rainLines.material.opacity = .45 * ENV.rain; if (rainLines.visible) { const p = rainLines.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 6) { p[i + 1] -= dt * 28; p[i + 4] -= dt * 28; if (p[i + 1] < 0) { p[i + 1] += 40; p[i + 4] += 40; } } rainLines.geometry.attributes.position.needsUpdate = true; rainLines.position.set(focus.x, focus.y - 8, focus.z); } }
}

/* ---------- sign atlas pool ---------- */
const SIGNS = { recs: [], grid: new Map(), active: [], slotOf: new Map(), free: [], glow: { value: 0.1 }, face: null, back: null, canvas: null, ctx: null, tex: null, slotCanvas: null, slotTex: null, pend: [], ready: false, lastUpd: 0 };
const AW_ = 2048, AH_ = 2048, SW_ = 256, SH_ = 64, NCOL = 8;
function hexCss(n) { return '#' + (n >>> 0).toString(16).padStart(6, '0'); }
function buildSigns() {
  const R = SIGNS.recs;
  for (const s of W.signs) R.push({ x: s[0], z: s[1], y: s[2], ang: s[6] ? s[3] + Math.PI / 2 : s[3], w: s[4], h: s[5], kind: s[6] ? 1 : 0, text: S(s[7]), bg: s[8], fg: s[9], cat: S(s[10]), maxD: s[6] ? 200 : 230 });
  for (const p of W.plates) R.push({ x: p[0], z: p[1], y: p[2], ang: p[3], w: p[4], h: .55, kind: 2, text: S(p[5]), bg: 0x23201C, fg: 0xE6C77A, maxD: 85 });
  for (const s of W.stops) { const c = Math.cos(s[3]), sn = Math.sin(s[3]); R.push({ x: s[0] + sn * .8, z: s[1] + c * .8, y: s[2] + 2.95, ang: s[3], w: 3.2, h: .5, kind: 3, text: S(s[4]), bg: 0xF5F2E8, fg: 0x0F4C81, maxD: 110 }); }
  for (const r of R) { const gk = ckey(Math.floor(r.x / 100), Math.floor(r.z / 100)); let l = SIGNS.grid.get(gk); if (!l) { l = []; SIGNS.grid.set(gk, l); } l.push(r); }
  const N = Math.min(256, Qual().signs);
  for (let i = N - 1; i >= 0; i--) SIGNS.free.push(i);
  SIGNS.canvas = document.createElement('canvas'); SIGNS.canvas.width = AW_; SIGNS.canvas.height = AH_; SIGNS.ctx = SIGNS.canvas.getContext('2d');
  SIGNS.ctx.fillStyle = '#222'; SIGNS.ctx.fillRect(0, 0, AW_, AH_);
  SIGNS.tex = new THREE.CanvasTexture(SIGNS.canvas); SIGNS.tex.generateMipmaps = false; SIGNS.tex.minFilter = THREE.LinearFilter; SIGNS.tex.magFilter = THREE.LinearFilter; SIGNS.tex.anisotropy = 4;
  SIGNS.slotCanvas = document.createElement('canvas'); SIGNS.slotCanvas.width = SW_; SIGNS.slotCanvas.height = SH_; SIGNS.slotTex = new THREE.CanvasTexture(SIGNS.slotCanvas);
  const geo = new THREE.PlaneGeometry(1, 1); const aSlot = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); const aVert = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  geo.setAttribute('aSlot', aSlot); geo.setAttribute('aVert', aVert);
  const mat = new THREE.MeshStandardMaterial({ map: SIGNS.tex, roughness: .55, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => { sh.uniforms.uGlow = SIGNS.glow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSlot;attribute float aVert;varying vec2 vLuv;varying vec2 vSO;varying float vVert;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLuv=uv;vSO=vec2(mod(aSlot,8.0)*256.0,floor(aSlot/8.0)*64.0);vVert=aVert;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vLuv;varying vec2 vSO;varying float vVert;uniform float uGlow;vec3 sTex;')
      .replace('#include <map_fragment>', `vec2 l=clamp(vLuv,.012,.988);if(!gl_FrontFacing)l.x=1.0-l.x;
vec2 cpx=vVert>0.5?vec2(vSO.x+(1.0-l.y)*256.0,vSO.y+64.0-l.x*64.0):vec2(vSO.x+l.x*256.0,vSO.y+(1.0-l.y)*64.0);
vec4 texelColor=texture2D(map,vec2(cpx.x/2048.0,1.0-cpx.y/2048.0));texelColor=mapTexelToLinear(texelColor);diffuseColor*=texelColor;sTex=texelColor.rgb;`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=sTex*uGlow;'); };
  SIGNS.face = new THREE.InstancedMesh(geo, mat, N); SIGNS.face.count = 0; SIGNS.face.frustumCulled = false; world.add(SIGNS.face);
  SIGNS.back = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .7 }), N); SIGNS.back.count = 0; SIGNS.back.frustumCulled = false; SIGNS.back.castShadow = true; world.add(SIGNS.back);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const r of SIGNS.active) r._drawn = false; SIGNS.lastUpd = 0; });
}
function fitFont(ctx, text, maxW, maxH, weight, fam) { let s = maxH; ctx.font = weight + ' ' + s + 'px ' + fam; const w = ctx.measureText(text).width; if (w > maxW) s = Math.max(10, s * maxW / w); ctx.font = weight + ' ' + Math.floor(s) + 'px ' + fam; return s; }
const SIGN_FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei","Hiragino Sans GB",sans-serif';
const SIGN_SERIF = '"LXGW WenKai TC","Kaiti TC","STKaiti","BiauKai",serif';
function drawSign(r) {
  const c = SIGNS.slotCanvas.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, SW_, SH_);
  const bg = hexCss(r.bg), fg = hexCss(r.fg);
  if (r.kind === 1) { // vertical blade: draw upright column on a 64x256 temp, rotate into slot
    const t = drawSign._t || (drawSign._t = document.createElement('canvas')); t.width = 64; t.height = 256; const x = t.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 64, 256); x.strokeStyle = fg; x.globalAlpha = .6; x.lineWidth = 3; x.strokeRect(4, 4, 56, 248); x.globalAlpha = 1;
    const chars = [...r.text].slice(0, 7); const n = chars.length; const cs = Math.min(46, 236 / n); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 ' + Math.floor(cs * .92) + 'px ' + SIGN_FONT;
    chars.forEach((ch, i) => x.fillText(ch, 32, 10 + cs * (i + .5) + (236 - cs * n) / 2));
    c.save(); c.translate(0, 64); c.rotate(-Math.PI / 2); c.drawImage(t, 0, 0); c.restore();
  } else if (r.kind === 2) { // granite name plate, gold letters
    const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#34302A'); g.addColorStop(1, '#1C1A17'); c.fillStyle = g; c.fillRect(0, 0, SW_, SH_);
    c.strokeStyle = '#8C7440'; c.lineWidth = 3; c.strokeRect(3, 3, SW_ - 6, SH_ - 6);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; fitFont(c, r.text, 236, 40, '700', SIGN_SERIF); c.fillText(r.text, 128, 34);
  } else if (r.kind === 3) { // bus stop
    c.fillStyle = bg; c.fillRect(0, 0, SW_, SH_); c.fillStyle = '#0F4C81'; c.fillRect(0, 0, 54, 64); c.fillStyle = '#fff'; c.font = '700 26px ' + SIGN_FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('巴士', 27, 33);
    c.fillStyle = fg; fitFont(c, r.text, 190, 30, '700', SIGN_FONT); c.fillText(r.text, 155, 34);
  } else if (r.kind === 5) { drawAzulejo(c, r);
  } else if (r.kind === 4) { // LRT station
    c.fillStyle = '#F4F7F6'; c.fillRect(0, 0, SW_, SH_); c.fillStyle = '#21A598'; c.fillRect(0, 0, SW_, 10); c.fillRect(0, 54, SW_, 10);
    c.fillStyle = '#1B2B2A'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitFont(c, r.text, 230, 34, '700', SIGN_FONT); c.fillText(r.text, 128, 33);
  } else { // shop board
    c.fillStyle = bg; c.fillRect(0, 0, SW_, SH_);
    const lum = ((r.bg >> 16) & 255) * .3 + ((r.bg >> 8) & 255) * .59 + (r.bg & 255) * .11;
    c.fillStyle = lum > 150 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.16)'; c.fillRect(0, 56, SW_, 8); c.fillRect(0, 0, SW_, 3);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    const aspect = r.w / r.h; const maxW = Math.min(244, 64 * aspect * .94);
    fitFont(c, r.text, maxW, 40, '800', SIGN_FONT); c.fillText(r.text, 128, 31);
  }
}
const _so = new THREE.Object3D();
function updateSigns(fx, fz, force) {
  const now = performance.now(); if (!force && now - SIGNS.lastUpd < 450) return; SIGNS.lastUpd = now;
  const N = SIGNS.face.count === undefined ? 0 : Math.min(256, Qual().signs); const R = 2;
  const cand = []; const i0 = Math.floor(fx / 100), j0 = Math.floor(fz / 100);
  for (let i = i0 - R; i <= i0 + R; i++) for (let j = j0 - R; j <= j0 + R; j++) { const l = SIGNS.grid.get(ckey(i, j)); if (!l) continue;
    for (const r of l) { const d2 = (r.x - fx) ** 2 + (r.z - fz) ** 2; if (d2 > r.maxD * r.maxD) continue; r._d = d2 * (r.kind === 2 ? 1.8 : 1); cand.push(r); } }
  cand.sort((a, b) => a._d - b._d); const want = cand.slice(0, N); const wantSet = new Set(want);
  for (const r of SIGNS.active) if (!wantSet.has(r)) { SIGNS.free.push(SIGNS.slotOf.get(r)); SIGNS.slotOf.delete(r); r._drawn = false; }
  let uploads = 0; const maxUp = force ? 999 : 28;
  for (const r of want) { if (!SIGNS.slotOf.has(r)) { if (!SIGNS.free.length) continue; SIGNS.slotOf.set(r, SIGNS.free.pop()); r._drawn = false; }
    if (!r._drawn && uploads < maxUp) { const slot = SIGNS.slotOf.get(r); drawSign(r); const sx = (slot % NCOL) * SW_, sy = Math.floor(slot / NCOL) * SH_;
      SIGNS.ctx.clearRect(sx, sy, SW_, SH_); SIGNS.ctx.drawImage(SIGNS.slotCanvas, sx, sy);
      if (SIGNS.ready && renderer.copyTextureToTexture) { try { SIGNS.slotTex.needsUpdate = true; renderer.copyTextureToTexture(new THREE.Vector2(sx, AH_ - sy - SH_), SIGNS.slotTex, SIGNS.tex); } catch (e) { SIGNS.tex.needsUpdate = true; } } else SIGNS.tex.needsUpdate = true;
      r._drawn = true; uploads++; } }
  SIGNS.active = want.filter(r => SIGNS.slotOf.has(r));
  const aSlot = SIGNS.face.geometry.attributes.aSlot, aVert = SIGNS.face.geometry.attributes.aVert; let k = 0; const bc = new THREE.Color();
  for (const r of SIGNS.active) { if (!r._drawn) continue;
    const vert = r.kind === 1; const off = vert ? 0 : (r.kind === 2 || r.kind === 5 ? .03 : .085);
    const sn = Math.sin(r.ang), cs = Math.cos(r.ang);
    _so.position.set(r.x + sn * off, r.y, r.z + cs * off); _so.rotation.set(0, r.ang, 0); _so.scale.set(r.w, r.h, 1); _so.updateMatrix(); SIGNS.face.setMatrixAt(k, _so.matrix);
    aSlot.array[k] = SIGNS.slotOf.get(r); aVert.array[k] = vert ? 1 : 0;
    const bd = vert ? .22 : r.kind === 2 || r.kind === 5 ? .05 : .14; _so.position.set(r.x - sn * (vert ? 0 : bd / 2 - off * .5), r.y, r.z - cs * (vert ? 0 : bd / 2 - off * .5)); if (vert) _so.scale.set(.0001, .0001, .0001); else _so.scale.set(r.w + .1, r.h + .1, bd); _so.updateMatrix(); SIGNS.back.setMatrixAt(k, _so.matrix);
    SIGNS.back.setColorAt(k, bc.setHex(r.kind === 5 ? 0xE9E9E3 : r.kind === 2 ? 0x2a2620 : r.kind === 3 ? 0x0F4C81 : r.kind === 4 ? 0x21A598 : 0x2B2B2B));
    k++; }
  SIGNS.face.count = k; SIGNS.back.count = k; aSlot.needsUpdate = true; aVert.needsUpdate = true; SIGNS.face.instanceMatrix.needsUpdate = true; SIGNS.back.instanceMatrix.needsUpdate = true; if (SIGNS.back.instanceColor) SIGNS.back.instanceColor.needsUpdate = true;
}
function signsAfterFirstFrame() { if (SIGNS.ready) return; if (renderer.initTexture) { try { renderer.initTexture(SIGNS.tex); } catch (e) {} } SIGNS.ready = true; }
function nearestShop(x, z, r) { let best = null, bd = r * r; for (const s of SHOPS) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } } return best; }
const SHOPS = [];
function buildShops() { const SG2 = new Map(); for (const s of W.shops) SHOPS.push({ x: s[0], z: s[1], name: S(s[2]), cat: S(s[3]) }); }

/* ---------- traffic lights ---------- */
const LIGHTS = { list: [], grid: new Map(), lamp: null, pole: null, head: null, t: 0, last: [] };
function buildLights() {
  const L = LIGHTS.list;
  for (const l of W.lights) L.push({ x: l[0], z: l[1], y: l[2], ang: l[3], off: l[4], cluster: -1, group: 0, state: -1 });
  let nc = 0; for (const a of L) { if (a.cluster >= 0) continue; a.cluster = nc; a.ref = a.ang; for (const b of L) if (b.cluster < 0 && (b.x - a.x) ** 2 + (b.z - a.z) ** 2 < 45 * 45) { b.cluster = nc; } nc++; }
  const refs = {}; for (const a of L) { if (refs[a.cluster] == null) refs[a.cluster] = a.ang; a.group = Math.abs(Math.cos(a.ang - refs[a.cluster])) > 0.7071 ? 0 : 1; a.phase = hsh(a.cluster * 7 + 3) * 26; }
  for (const a of L) { const gk = ckey(Math.floor(a.x / 50), Math.floor(a.z / 50)); let l = LIGHTS.grid.get(gk); if (!l) { l = []; LIGHTS.grid.set(gk, l); } l.push(a); }
  const n = L.length; const o = new THREE.Object3D();
  LIGHTS.pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .11, 4.6, 6).translate(0, 2.3, 0), new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: .6, metalness: .3 }), n);
  LIGHTS.head = new THREE.InstancedMesh(new THREE.BoxGeometry(.36, 1.05, .32), new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: .6 }), n);
  LIGHTS.lamp = new THREE.InstancedMesh(new THREE.BoxGeometry(.24, .24, .38), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
  L.forEach((a, i) => { const nx = Math.cos(a.ang), nz = -Math.sin(a.ang); a.px = a.x - nx * a.off; a.pz = a.z - nz * a.off;
    o.position.set(a.px, a.y, a.pz); o.rotation.set(0, a.ang, 0); o.scale.set(1, 1, 1); o.updateMatrix(); LIGHTS.pole.setMatrixAt(i, o.matrix);
    o.position.set(a.px, a.y + 4.1, a.pz); o.updateMatrix(); LIGHTS.head.setMatrixAt(i, o.matrix); });
  for (const m of [LIGHTS.pole, LIGHTS.head, LIGHTS.lamp]) { m.frustumCulled = false; m.castShadow = m !== LIGHTS.lamp; world.add(m); }
}
function lightState(a, t) { const p = (t + a.phase) % 26; if (a.group === 0) return p < 11 ? 0 : p < 13 ? 1 : 2; return p < 13 ? 2 : p < 24 ? 0 : 1; }
function updateLights(dt) { LIGHTS.t += dt; const o = new THREE.Object3D(); const cols = [new THREE.Color(0x35e06a), new THREE.Color(0xffb020), new THREE.Color(0xff3b30)]; let ch = false;
  LIGHTS.list.forEach((a, i) => { const s = lightState(a, LIGHTS.t); if (s === a.state) return; a.state = s; ch = true;
    o.position.set(a.px, a.y + 4.1 + (s === 2 ? .32 : s === 1 ? 0 : -.32), a.pz); o.rotation.set(0, a.ang, 0); o.updateMatrix(); LIGHTS.lamp.setMatrixAt(i, o.matrix); LIGHTS.lamp.setColorAt(i, cols[s]); });
  if (ch) { LIGHTS.lamp.instanceMatrix.needsUpdate = true; if (LIGHTS.lamp.instanceColor) LIGHTS.lamp.instanceColor.needsUpdate = true; } }
function redLightAhead(x, z, fx, fz, hw) { const gx = Math.floor(x / 50), gz = Math.floor(z / 50); let best = 1e9;
  for (let i = gx - 1; i <= gx + 1; i++) for (let j = gz - 1; j <= gz + 1; j++) { const l = LIGHTS.grid.get(ckey(i, j)); if (!l) continue;
    for (const a of l) { if (a.state === 0) continue; const dx = a.x - x, dz = a.z - z; const ahead = dx * fx + dz * fz; if (ahead < 2 || ahead > 24) continue; const lat = Math.abs(dx * fz - dz * fx); if (lat > hw + 3) continue;
      const along = Math.abs(Math.sin(a.ang) * fx + Math.cos(a.ang) * fz); if (along < 0.7) continue; if (a.state === 1 && ahead < 8) continue; best = Math.min(best, ahead); } }
  return best; }

/* ---------- bus stops ---------- */
function buildStops() {
  const n = W.stops.length; const o = new THREE.Object3D(); const parts = [
    [new THREE.BoxGeometry(3.6, .12, 1.7), 0x0F4C81, [0, 2.65, -.1]], [new THREE.BoxGeometry(3.3, 1.9, .06), 0x9fc2d4, [0, 1.35, -.85]], [new THREE.BoxGeometry(.1, 2.6, .1), 0x9aa0a4, [-1.6, 1.3, -.85]],
    [new THREE.BoxGeometry(.1, 2.6, .1), 0x9aa0a4, [1.6, 1.3, -.85]], [new THREE.BoxGeometry(2.4, .1, .45), 0x6b6f72, [0, .5, -.55]], [new THREE.BoxGeometry(.08, 3.1, .08), 0x9aa0a4, [1.95, 1.55, .3]]];
  for (const [geo, col, off] of parts) { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: .6, transparent: col === 0x9fc2d4, opacity: col === 0x9fc2d4 ? .45 : 1 }), n);
    W.stops.forEach((s, i) => { const c = Math.cos(s[3]), sn = Math.sin(s[3]); o.position.set(s[0] + off[0] * c + off[2] * sn, s[2] + off[1], s[1] - off[0] * sn + off[2] * c); o.rotation.set(0, s[3], 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.castShadow = true; m.frustumCulled = false; world.add(m); }
}

/* ---------- street lamps ---------- */
const LAMPS = { headMat: null };
function buildLamps() {
  const sp = 40 * Qual().lamps; const pts = [];
  for (const rd of ROADS) { if (rd.cls > 2) continue; const sides = rd.cls <= 1 ? [1, -1] : [1]; let s = sp * .5 * (hsh(pts.length) + .5);
    while (s < rd.len) { const p = roadPoint(rd, s); const nx = -p[4], nz = p[3]; for (const sd of sides) { const off = rd.hw + (rd.br ? .4 : 1.1); const x = p[0] + nx * off * sd, z = p[1] + nz * off * sd; const y = rd.br ? p[2] : groundAt(x, z); if (!rd.br && !isLand(x, z)) continue; pts.push([x, y, z, Math.atan2(-nx * sd, -nz * sd)]); } s += sp; }
    if (pts.length > 9000) break; }
  LAMPS.pts = pts;
  // historic centres get black cast-iron lantern posts; everywhere else modern arm lamps
  const HC = [['senado', 900], ['stpaul', 500], ['cunha', 420], ['chapel', 350], ['ama', 350]].map(([k, r]) => { const p = PL(k); return p && [p.x, p.z, r]; }).filter(Boolean);
  const isHist = (x, z) => HC.some(h => Math.hypot(h[0] - x, h[1] - z) < h[2]);
  const hp = pts.filter(p => isHist(p[0], p[2])); const mp = pts.filter(p => !isHist(p[0], p[2]));
  if (hp.length) { const iron = new THREE.MeshStandardMaterial({ color: 0x1d2022, roughness: .5, metalness: .6 });
    const post = new THREE.InstancedMesh(partsGeo([{ g: new THREE.CylinderGeometry(.22, .28, .6, 8), y: .3 }, { g: new THREE.CylinderGeometry(.07, .11, 3.6, 8), y: 2.4 }, { g: new THREE.CylinderGeometry(.16, .1, .25, 8), y: 4.3 }, { g: new THREE.ConeGeometry(.32, .35, 4), y: 5.25 }, { g: new THREE.SphereGeometry(.07, 6, 4), y: 5.5 }]), iron, hp.length);
    LAMPS.lanternMat = new THREE.MeshStandardMaterial({ color: 0xf3e6c4, roughness: .3, emissive: 0x000000, transparent: true, opacity: .92 });
    const lan = new THREE.InstancedMesh(new THREE.CylinderGeometry(.26, .19, .62, 4).rotateY(Math.PI / 4).translate(0, 4.75, 0), LAMPS.lanternMat, hp.length); const oo = new THREE.Object3D();
    hp.forEach((p, i) => { oo.position.set(p[0], p[1], p[2]); oo.rotation.set(0, p[3], 0); oo.updateMatrix(); post.setMatrixAt(i, oo.matrix); lan.setMatrixAt(i, oo.matrix); }); for (const m of [post, lan]) { m.frustumCulled = false; m.castShadow = m === post; world.add(m); } }
  pts.length = 0; for (const p of mp) pts.push(p); LAMPS.pts = mp.concat(hp.map(p => [p[0] - Math.sin(p[3]) * 1.55, p[1], p[2] - Math.cos(p[3]) * 1.55, p[3]]));
  const o = new THREE.Object3D();
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(.08, .13, 8, 6).translate(0, 4, 0), new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: .6, metalness: .35 }), pts.length);
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(.08, .08, 1.6).translate(0, 7.9, .75), pole.material, pts.length);
  LAMPS.headMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: .5, emissive: 0x000000 });
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(.32, .14, .6).translate(0, 7.85, 1.55), LAMPS.headMat, pts.length);
  pts.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3], 0); o.updateMatrix(); pole.setMatrixAt(i, o.matrix); arm.setMatrixAt(i, o.matrix); head.setMatrixAt(i, o.matrix); });
  for (const m of [pole, arm, head]) { m.frustumCulled = false; m.castShadow = m === pole; world.add(m); }
}

/* ---------- LRT: viaduct, stations, train ---------- */
const LRT = { stations: [], path: null, cum: null, len: 0, train: null, s: 0, dir: 1, wait: 0, stopS: [] };
function lrtDeckY(x, z) { return Math.max(BASE, heightAt(x, z)) + 11.5; }
function buildLRT() {
  const P = [], N = [], Cc = []; const conc = C('#C9C6BE'), rail = C('#4b4d50');
  const quad = (a, b, c, d, n, col) => { for (const q of [a, b, c, a, c, d]) { P.push(q[0], q[1], q[2]); N.push(n[0], n[1], n[2]); Cc.push(col.r, col.g, col.b); } };
  const piers = [];
  for (const l of W.lrt) { const pts = decRing(l, 2); let acc = 0;
    for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1]; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (surfaceAt(mx, mz, 99) > 22) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < .1) continue; const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len, nx = -tz, nz = tx;
      const ya = lrtDeckY(a[0], a[1]), yb = lrtDeckY(b[0], b[1]); const hw = 4.4, dp = 2.2;
      const A = (p, s, y) => [p[0] + nx * hw * s, y, p[1] + nz * hw * s];
      quad(A(a, -1, ya), A(b, -1, yb), A(b, 1, yb), A(a, 1, ya), [0, 1, 0], conc);
      quad(A(a, 1, ya), A(b, 1, yb), A(b, 1, yb - dp), A(a, 1, ya - dp), [nx, 0, nz], conc.clone().multiplyScalar(.9));
      quad(A(a, -1, ya - dp), A(b, -1, yb - dp), A(b, -1, yb), A(a, -1, ya), [-nx, 0, -nz], conc.clone().multiplyScalar(.9));
      quad(A(a, 1, ya - dp), A(b, 1, yb - dp), A(b, -1, yb - dp), A(a, -1, ya - dp), [0, -1, 0], conc.clone().multiplyScalar(.6));
      for (const off of [-2.6, -1.1, 1.1, 2.6]) { const r0 = [a[0] + nx * off, ya + .12, a[1] + nz * off], r1 = [b[0] + nx * off, yb + .12, b[1] + nz * off]; const w = .09;
        quad([r0[0] - nx * w, r0[1], r0[2] - nz * w], [r1[0] - nx * w, r1[1], r1[2] - nz * w], [r1[0] + nx * w, r1[1], r1[2] + nz * w], [r0[0] + nx * w, r0[1], r0[2] + nz * w], [0, 1, 0], rail); }
      for (const s of [1, -1]) { const e0 = A(a, s, ya), e1 = A(b, s, yb); quad(e0, e1, [e1[0], e1[1] + 1.1, e1[2]], [e0[0], e0[1] + 1.1, e0[2]], [nx * s, 0, nz * s], conc); }
      acc += len; if (acc > 32) { acc = 0; piers.push([a[0], a[1], ya - dp]); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; world.add(m);
  const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(.9, 1.1, 1, 10).translate(0, .5, 0), new THREE.MeshStandardMaterial({ color: 0xbdbab2, roughness: .9 }), piers.length); const o = new THREE.Object3D();
  piers.forEach((p, i) => { const g0 = groundAt(p[0], p[1]); const bot = isLand(p[0], p[1]) ? g0 : -6; o.position.set(p[0], bot, p[1]); o.scale.set(1, p[2] - bot, 1); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); });
  pm.frustumCulled = false; pm.castShadow = true; world.add(pm);
  // path for train
  const pts = decRing(W.lrtpath, 2); LRT.path = pts.map(p => [p[0], p[1], lrtDeckY(p[0], p[1])]);
  // smooth heights
  for (let it = 0; it < 6; it++) for (let i = 1; i < LRT.path.length - 1; i++) LRT.path[i][2] = (LRT.path[i - 1][2] + LRT.path[i][2] * 2 + LRT.path[i + 1][2]) / 4;
  LRT.cum = [0]; for (let i = 1; i < LRT.path.length; i++) LRT.cum.push(LRT.cum[i - 1] + Math.hypot(LRT.path[i][0] - LRT.path[i - 1][0], LRT.path[i][1] - LRT.path[i - 1][1])); LRT.len = LRT.cum[LRT.cum.length - 1];
  // stations
  const gb = new GB();
  for (const s of W.stations) { let best = null, bd = 1e18;
    for (const l of W.lrt) { const pts = decRing(l, 2); for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1]; const ex = b[0] - a[0], ez = b[1] - a[1]; const L2 = ex * ex + ez * ez || 1; const t = clamp(((s[0] - a[0]) * ex + (s[1] - a[1]) * ez) / L2, 0, 1); const px = a[0] + ex * t, pz = a[1] + ez * t; const d = (px - s[0]) ** 2 + (pz - s[1]) ** 2; if (d < bd) { bd = d; best = { x: px, z: pz, ang: Math.atan2(ex, ez) }; } } }
    if (!best) continue; const y = lrtDeckY(best.x, best.z); const name = S(s[2]);
    gb.add(new THREE.BoxGeometry(17, 7, 76), TRS(best.x, y + 3.6, best.z, best.ang), '#E9ECEB', 2, y);
    gb.add(new THREE.BoxGeometry(19, .8, 80), TRS(best.x, y + 7.4, best.z, best.ang), '#21A598', 0, y);
    const sn = Math.sin(best.ang), cs = Math.cos(best.ang);
    for (const sd of [1, -1]) SIGNS.recs.push({ x: best.x + cs * 8.6 * sd, z: best.z - sn * 8.6 * sd, y: y + 5.6, ang: best.ang + (sd > 0 ? Math.PI / 2 : -Math.PI / 2), w: 8, h: 2, kind: 4, text: name, bg: 0xffffff, fg: 0, maxD: 420 });
    const ent = roadPos(best.x, best.z, { noBridge: true }); let ex = best.x, ez = best.z;
    if (ent) { const nx = -ent.dz, nz = ent.dx; const sd = ((best.x - ent.x) * nx + (best.z - ent.z) * nz) >= 0 ? 1 : -1; ex = ent.x + nx * (ent.hw + 2.4) * sd; ez = ent.z + nz * (ent.hw + 2.4) * sd; }
    LRT.stations.push({ name, x: best.x, z: best.z, y, ex, ez, ey: groundAt(ex, ez), idx: LRT.stations.length, wi: W.stations.indexOf(s) });
    let bs = 0, bsd = 1e18; for (let i = 0; i < LRT.path.length; i++) { const d = (LRT.path[i][0] - best.x) ** 2 + (LRT.path[i][1] - best.z) ** 2; if (d < bsd) { bsd = d; bs = LRT.cum[i]; } } if (bsd < 40 * 40) LRT.stopS.push(bs); }
  for (const r of SIGNS.recs) if (r.kind === 4) { const gk = ckey(Math.floor(r.x / 100), Math.floor(r.z / 100)); let l = SIGNS.grid.get(gk); if (!l) { l = []; SIGNS.grid.set(gk, l); } if (!l.includes(r)) l.push(r); }
  world.add(gb.mesh()); LRT.stopS.sort((a, b) => a - b);
  // ground entrances (column with sign)
  const em = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, 3.2, .5).translate(0, 1.6, 0), new THREE.MeshStandardMaterial({ color: 0x21A598, roughness: .5, emissive: 0x0b4a44 }), LRT.stations.length);
  LRT.stations.forEach((s, i) => { o.position.set(s.ex, s.ey, s.ez); o.scale.set(1, 1, 1); o.rotation.set(0, 0, 0); o.updateMatrix(); em.setMatrixAt(i, o.matrix); }); em.frustumCulled = false; world.add(em);
  // train: 4 cars
  const car = partsGeo([{ g: new THREE.BoxGeometry(2.7, 3.1, 11.6), y: 1.9, c: '#F2F4F3' }, { g: new THREE.BoxGeometry(2.74, .9, 11.0), y: 2.4, c: '#22323A' }, { g: new THREE.BoxGeometry(2.76, .28, 11.64), y: 1.1, c: '#21A598' }, { g: new THREE.BoxGeometry(2.2, .4, 9), y: 3.55, c: '#C9CED0' }]);
  LRT.train = []; const tm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: .2 });
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(car, tm); m.castShadow = true; world.add(m); LRT.train.push(m); }
  LRT.s = LRT.len * .3;
}
function lrtAt(s) { s = clamp(s, 0, LRT.len); let lo = 0, hi = LRT.cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (LRT.cum[m] <= s) lo = m; else hi = m; }
  const a = LRT.path[lo], b = LRT.path[hi]; const t = (s - LRT.cum[lo]) / ((LRT.cum[hi] - LRT.cum[lo]) || 1); return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t + .1, a[1] + (b[1] - a[1]) * t]; }
function updateLRT(dt) { if (!LRT.train) return;
  if (LRT.wait > 0) LRT.wait -= dt; else { const v = 16; const ns = LRT.s + LRT.dir * v * dt;
    for (const st of LRT.stopS) if ((LRT.s - st) * (ns - st) < 0) { LRT.s = st; LRT.wait = 12; LRT.lastStop = st; break; }
    if (LRT.wait <= 0) LRT.s = ns; if (LRT.s > LRT.len - 30 || LRT.s < 30) { LRT.dir *= -1; LRT.s = clamp(LRT.s, 30, LRT.len - 30); LRT.wait = 10; } }
  for (let i = 0; i < 4; i++) { const sc = LRT.s - LRT.dir * i * 12.2; const p = lrtAt(sc), q = lrtAt(sc + 1); const m = LRT.train[i]; m.position.set(p[0], p[1], p[2]); m.rotation.set(0, Math.atan2(q[0] - p[0], q[2] - p[2]), 0); } }
function lrtFare(a, b) { const h = W.hops[a] ? W.hops[a][b] : 6; return h <= 3 ? 6 : h <= 6 ? 8 : h <= 9 ? 10 : 12; }

/* ---------- egg tarts ---------- */
const TARTS = { mesh: null, pos: [] };
function buildTarts() {
  const crust = new THREE.CylinderGeometry(.5, .38, .3, 14); const custard = new THREE.CylinderGeometry(.42, .42, .08, 14); custard.translate(0, .16, 0);
  const g = mergeGeos([crust, custard]); const n = W.tarts.length;
  const cols = []; const pa = g.attributes.position.count; const crustN = (crust.index ? crust.toNonIndexed() : crust).attributes.position.count;
  for (let i = 0; i < pa; i++) { const c = i < crustN ? C('#C98A2E') : C('#F5C542'); cols.push(c.r, c.g, c.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  TARTS.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, emissive: 0x6a4200, emissiveIntensity: .7 }), n); TARTS.mesh.frustumCulled = false; world.add(TARTS.mesh);
  W.tarts.forEach((t, i) => TARTS.pos.push({ x: t[0], z: t[1], y: t[2] + .9, i }));
  const ring = new THREE.InstancedMesh(new THREE.TorusGeometry(1.1, .06, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xF5C542, transparent: true, opacity: .6 }), n); ring.frustumCulled = false; world.add(ring); TARTS.ring = ring;
}
function updateTarts(t) { const o = new THREE.Object3D(); for (const p of TARTS.pos) { const got = save.tarts.includes(p.i); o.position.set(p.x, p.y + Math.sin(t * 2 + p.i) * .15, p.z); o.rotation.set(.35, t * 1.6 + p.i, 0); o.scale.setScalar(got ? 0.0001 : 1.25); o.updateMatrix(); TARTS.mesh.setMatrixAt(p.i, o.matrix);
  o.position.y = p.y - .75; o.rotation.set(0, 0, 0); o.scale.setScalar(got ? 0.0001 : 1 + .15 * Math.sin(t * 3 + p.i)); o.updateMatrix(); TARTS.ring.setMatrixAt(p.i, o.matrix); }
  TARTS.mesh.instanceMatrix.needsUpdate = true; TARTS.ring.instanceMatrix.needsUpdate = true; }

/* ---------- shared: merge part list into one coloured geometry ---------- */
function partsGeo(parts) { const geos = []; for (const p of parts) { const g = p.g.clone(); if (p.rx) g.rotateX(p.rx); if (p.r) g.rotateZ(p.r); if (p.ry) g.rotateY(p.ry); g.translate(p.x || 0, p.y || 0, p.z || 0); const gg = g.index ? g.toNonIndexed() : g; gg.computeVertexNormals(); const c = C(p.c || '#ffffff'); const n = gg.attributes.position.count; const cols = new Float32Array(n * 3); for (let i = 0; i < n; i++) { cols[3 * i] = c.r; cols[3 * i + 1] = c.g; cols[3 * i + 2] = c.b; } gg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geos.push(gg); }
  let n = 0; for (const g of geos) n += g.attributes.position.count; const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.computeBoundingSphere(); return out; }
