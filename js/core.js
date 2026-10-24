'use strict';
/* =====================================================================
   濠江飛馳 v2 · core
   renderer, data loading, terrain, land, roads, buildings (with real
   street frontage), landmarks, trees, collision and the road network.
   All files are classic scripts sharing one global scope.
   ===================================================================== */
const $ = id => document.getElementById(id);
const tick0 = () => new Promise(r => setTimeout(r, 0));
const C = h => new THREE.Color(h);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hsh = i => { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
let seedR = 12345; const rnd = () => { seedR = (seedR * 1664525 + 1013904223) >>> 0; return seedR / 4294967296; };
const isTouchDevice = matchMedia('(pointer: coarse)').matches;
const bigScreen = Math.min(screen.width, screen.height) > 700;

/* ---------- save ---------- */
const SAVE_KEY = 'haojiang-v2';
const save = Object.assign({ money: 500, done: {}, jobs: {}, jobRuns: {}, tarts: [], lms: [], best: {}, char: 0, outfit: null, time: 17 * 60 + 10,
  ctl: null, quality: null, sound: true, radio: 1, day: 1, stamina: 100, intro: false }, (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch (e) { return {}; } })());
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
if (!save.ctl) save.ctl = isTouchDevice ? 'touch' : 'keys';
if (!save.quality) save.quality = (!isTouchDevice && bigScreen) ? 'high' : 'mid';
const Qual = () => ({ high: { pr: 1.75, shadow: 2048, trees: 1, signs: 256, lamps: 1, peds: 120, cars: 70 }, mid: { pr: 1.25, shadow: 1024, trees: 2, signs: 160, lamps: 2, peds: 70, cars: 46 }, low: { pr: 1, shadow: 0, trees: 4, signs: 96, lamps: 3, peds: 40, cars: 30 } })[save.quality];

/* ---------- loader ui ---------- */
function progress(msg, f) { const m = $('ld-msg'); if (m) m.textContent = msg; const b = $('ld-bar'); if (b && f != null) b.style.width = (clamp(f, 0, 1) * 100).toFixed(1) + '%'; }
function fail(msg) { const m = $('ld-msg'); if (m) { m.textContent = msg; m.classList.add('err'); } const b = $('ld-bar'); if (b) b.parentNode.hidden = true; }

/* ---------- renderer ---------- */
let renderer, scene, camera, hemi, sun, world;
const SUN_DIR = new THREE.Vector3(-0.42, 0.82, 0.39).normalize();
function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: save.quality !== 'low', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Qual().pr));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('stage').appendChild(renderer.domElement);
  scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xc3d7e2, 500, 3600);
  camera = new THREE.PerspectiveCamera(62, 1, 0.3, 6000);
  hemi = new THREE.HemisphereLight(0xffffff, 0x88aaaa, 0.55); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 0.9);
  const sm = Qual().shadow; sun.castShadow = sm > 0; if (sm) sun.shadow.mapSize.set(sm, sm);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35;
  const c = sun.shadow.camera; c.left = -150; c.right = 150; c.top = 150; c.bottom = -150; c.near = 10; c.far = 900;
  scene.add(sun); scene.add(sun.target);
  world = new THREE.Group(); scene.add(world);
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
}

/* ---------- data ---------- */
let D, W, Q, BASE, G, GW, GH;
let HG;
async function loadJSON(url, f0, f1, label) {
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  const total = +(r.headers.get('content-length') || 0);
  if (!r.body || !total) { progress(label, f1); return r.json(); }
  const rd = r.body.getReader(); const parts = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; progress(label + ' ' + (got / 1048576).toFixed(1) + ' MB', f0 + (f1 - f0) * Math.min(1, got / total)); }
  const buf = new Uint8Array(got); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
  return JSON.parse(new TextDecoder().decode(buf));
}
const S = i => (W && W.str[i]) || '';
const toXZ = (lon, lat) => [(lon - D.lon0) * D.mx, -(lat - D.lat0) * D.mz];
const toLL = (x, z) => [D.lon0 + x / D.mx, D.lat0 - z / D.mz];
function decRing(r, q) { q = q || Q; const n = r.length >> 1, out = new Array(n); let x = 0, z = 0; for (let k = 0; k < n; k++) { x += r[2 * k]; z += r[2 * k + 1]; out[k] = [x / q, z / q]; } return out; }
function decRingOff(r, off, q) { const n = (r.length - off) >> 1, out = new Array(n); let x = 0, z = 0; for (let k = 0; k < n; k++) { x += r[off + 2 * k]; z += r[off + 2 * k + 1]; out[k] = [x / q, z / q]; } return out; }
function decLine(r, off) { const n = (r.length - off) / 3, out = new Array(n); let x = 0, z = 0, y = 0; for (let k = 0; k < n; k++) { const o = off + 3 * k; x += r[o]; z += r[o + 1]; y += r[o + 2]; out[k] = [x / Q, z / Q, y / 10]; } return out; }
function ringArea(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return a / 2; }
function pipRing(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], zi = r[i][1], xj = r[j][0], zj = r[j][1]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c; } return c; }

/* ---------- terrain ---------- */
const gAt = (i, j) => HG[j * GW + i];
function heightAt(x, z) {
  const fx = (x - G.x0) / G.step, fz = (z - G.z0) / G.step;
  if (fx < 0 || fz < 0 || fx >= GW - 1 || fz >= GH - 1) return -1;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j; const a = gAt(i, j), b = gAt(i + 1, j), c = gAt(i, j + 1), d = gAt(i + 1, j + 1);
  if (a < 0 || b < 0 || c < 0 || d < 0) return Math.max(a, b, c, d);
  return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d);
}
const groundAt = (x, z) => Math.max(BASE, heightAt(x, z));
const landRings = [];
function landClass(x, z) { for (const L of landRings) { const b = L.box; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue; if (pipRing(x, z, L.rings[0])) { let hole = false; for (let h = 1; h < L.rings.length; h++) if (pipRing(x, z, L.rings[h])) { hole = true; break; } if (!hole) return L.cls; } } return 0; }
function isLand(x, z) { const fx = (x - G.x0) / G.step, fz = (z - G.z0) / G.step; if (fx < 0 || fz < 0 || fx >= GW - 1 || fz >= GH - 1) return false; const i = fx | 0, j = fz | 0;
  const a = gAt(i, j), b = gAt(i + 1, j), c = gAt(i, j + 1), d = gAt(i + 1, j + 1); if (a >= 0 && b >= 0 && c >= 0 && d >= 0) return true; return landClass(x, z) > 0; }

/* ---------- materials registry (day/night colours handled in props.js) ---------- */
const MAT = {};
function shapeOf(poly) { const rings = poly.map(r => decRing(r)); const sh = new THREE.Shape(rings[0].map(p => new THREE.Vector2(p[0], -p[1]))); for (let k = 1; k < rings.length; k++) sh.holes.push(new THREE.Path(rings[k].map(p => new THREE.Vector2(p[0], -p[1])))); return sh; }
function mergeGeos(geos) { let n = 0; for (const g of geos) { g._ni = g.index ? g.toNonIndexed() : g; n += g._ni.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { const gg = g._ni; pos.set(gg.attributes.position.array, o * 3); if (gg.attributes.normal) nor.set(gg.attributes.normal.array, o * 3); o += gg.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out; }
let hillMo, hillCn; const hillInfo = {};
function buildLand() {
  MAT.sea = new THREE.MeshStandardMaterial({ color: 0x6593a8, transparent: true, opacity: .86, roughness: .25, metalness: .05 });
  MAT.seabed = new THREE.MeshStandardMaterial({ color: 0x355f73, roughness: 1 });
  const seabed = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2), MAT.seabed); seabed.position.y = -6; scene.add(seabed);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2), MAT.sea); water.position.y = 0.05; water.receiveShadow = true; scene.add(water);
  for (const [polys, cls] of [[D.mo, 1], [D.cn, 2]]) for (const p of polys) { const rings = p.map(r => decRing(r)); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of rings[0]) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); } landRings.push({ rings, box: [x0, x1, z0, z1], cls }); }
  MAT.land = new THREE.MeshStandardMaterial({ roughness: 1 }); MAT.mainland = new THREE.MeshStandardMaterial({ roughness: 1 });
  const slab = (polys, mat) => { const g = new THREE.ExtrudeGeometry(polys.map(shapeOf), { depth: BASE + 6, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, -6, 0); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; world.add(m); return m; };
  slab(D.mo, MAT.land); slab(D.cn, MAT.mainland);
  const thr = BASE + 0.15; const vmap = new Int32Array(GW * GH).fill(-1); const posA = [], hA = [], clsA = [], nzA = [], idxMo = [], idxCn = [];
  const vid = (i, j) => { const k = j * GW + i; if (vmap[k] < 0) { vmap[k] = hA.length; const x = G.x0 + i * G.step, z = G.z0 + j * G.step; posA.push(x, HG[k], z); hA.push(HG[k]); clsA.push(landClass(x, z) === 2 ? 2 : 1); nzA.push(Math.sin(x * .013) * Math.cos(z * .017) * .5 + Math.sin((x - z) * .031) * .5); } return vmap[k]; };
  for (let j = 0; j < GH - 1; j++) for (let i = 0; i < GW - 1; i++) { const a = gAt(i, j), b = gAt(i + 1, j), c = gAt(i, j + 1), d = gAt(i + 1, j + 1);
    if (a > thr && b > thr && c > thr && d > thr) { const va = vid(i, j), vb = vid(i + 1, j), vc = vid(i, j + 1), vd = vid(i + 1, j + 1); (clsA[va] === 1 ? idxMo : idxCn).push(va, vc, vb, vb, vc, vd); } }
  const pos = new Float32Array(posA);
  const mk = idx => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); m.receiveShadow = true; m.castShadow = true; world.add(m); return m; };
  hillMo = mk(idxMo); hillCn = mk(idxCn); hillCn.receiveShadow = false; Object.assign(hillInfo, { h: hA, cls: clsA, nz: nzA });
  const flatPolys = (list, mat, dy) => { const geos = []; for (const p of list) { const g = new THREE.ShapeGeometry(shapeOf(p.slice(1))); g.rotateX(-Math.PI / 2); g.translate(0, p[0] / 10 + dy, 0); geos.push(g); } const m = new THREE.Mesh(mergeGeos(geos), mat); m.receiveShadow = true; world.add(m); return m; };
  MAT.park = new THREE.MeshStandardMaterial({ roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT.lake = new THREE.MeshStandardMaterial({ roughness: .25, metalness: .05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  flatPolys(D.p, MAT.park, 0.02); flatPolys(D.w, MAT.lake, 0.04);
}
function colorHills(P) {
  const c = new THREE.Color(), lo1 = C(P.hillLo), hi1 = C(P.hillHi), lo2 = C(P.cnLo), hi2 = C(P.cnHi), l1 = C(P.land), l2 = C(P.mainland); const n = hillInfo.h.length;
  for (const m of [hillMo, hillCn]) { const col = m.geometry.attributes.color.array;
    for (let v = 0; v < n; v++) { const h = hillInfo.h[v]; const s = clamp((h - BASE - 1) / 10, 0, 1); const t = clamp((h - BASE - 10) / 120, 0, 1);
      if (hillInfo.cls[v] === 1) c.copy(l1).lerp(lo1, s * s * (3 - 2 * s)).lerp(hi1, t); else c.copy(l2).lerp(lo2, s * s * (3 - 2 * s)).lerp(hi2, t);
      c.multiplyScalar(1 + hillInfo.nz[v] * 0.07); col[3 * v] = c.r; col[3 * v + 1] = c.g; col[3 * v + 2] = c.b; }
    m.geometry.attributes.color.needsUpdate = true; }
}

/* ---------- facade material: windows, residential grilles + AC units, street shopfronts, night lights ---------- */
const FU = { uNight: { value: 0 }, uWet: { value: 0 }, uClosed: { value: 0 } };
function facadeShader(sh) {
  sh.uniforms.uNight = FU.uNight; sh.uniforms.uClosed = FU.uClosed;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 fx;\nattribute vec2 fy;\nvarying vec3 vFx;\nvarying vec2 vFy;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFx=fx;vFy=fy;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vFx;varying vec2 vFy;uniform float uNight;uniform float uClosed;
float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float bx(vec2 g,vec2 a,vec2 b){vec2 s=step(a,g)*step(g,b);return s.x*s.y;}
vec3 pal6(float h){if(h<.17)return vec3(.74,.15,.13);if(h<.33)return vec3(.12,.3,.52);if(h<.5)return vec3(.93,.78,.26);if(h<.67)return vec3(.16,.46,.28);if(h<.83)return vec3(.9,.88,.84);return vec3(.5,.1,.3);}`)
  .replace('#include <color_fragment>', `#include <color_fragment>
float winLit=0.0;float glassAmt=0.0;vec3 bcol0=diffuseColor.rgb;
float st=floor(vFx.z+0.5);
if(st>0.5){
  float fh=st==1.0?3.0:st==2.0?4.0:st==3.0?3.8:st==5.0?4.2:6.0;
  float ww=st==1.0?2.8:st==2.0?1.6:st==3.0?3.4:st==5.0?1.4:7.0;
  vec2 f=vec2(vFx.x/ww,vFx.y/fh);vec2 gg=fract(f);vec2 fw=fwidth(f);
  float aa=clamp(1.0-max(fw.x,fw.y)*1.3,0.0,1.0);
  vec2 cell=floor(f);float hc=h12(cell+vec2(floor(vFx.x/53.0)*7.0,3.0));
  float win=0.0;float mean=0.0;
  if(st==1.0){win=bx(gg,vec2(.18,.32),vec2(.82,.86));mean=.33;}
  else if(st==2.0){win=bx(gg,vec2(.05,.1),vec2(.95,.92));mean=.74;}
  else if(st==3.0){win=bx(gg,vec2(.32,.28),vec2(.68,.8));mean=.19;}
  else if(st==5.0){float d1=abs(fract((vFx.x+vFx.y*.9)/9.0)-.5);float d2=abs(fract((vFx.x-vFx.y*.9)/9.0)-.5);win=smoothstep(.035,.07,min(d1,d2));mean=.82;}
  else{win=bx(gg,vec2(0.,.42),vec2(1.,.5));mean=.08;}
  float wv=mix(mean,win,aa);
  vec3 bcol=diffuseColor.rgb;
  vec3 glass=(st==2.0||st==5.0)?mix(bcol*.5,vec3(.33,.43,.52),.5):(st==4.0?bcol*.78:vec3(.2,.25,.3)+bcol*.14);
  float k=st==4.0?.5:st==5.0?.95:st==1.0?.78:.86;
  diffuseColor.rgb=mix(bcol,glass,wv*k);
  if(st==5.0)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.9,.92,.93),(1.0-wv));
  if(st==1.0){
    float bar=step(fract(gg.x*7.0),0.15)*win*step(.35,hc);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.81,.8),bar*.6*aa);
    float ac=bx(gg,vec2(.56,.05),vec2(.88,.27))*step(.58,hc);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.88,.86)*(.86+.14*step(.5,fract(gg.y*26.))),ac*aa);
    diffuseColor.rgb*=1.0-.16*step(gg.y,.045)*aa;
  }
  if(st==3.0){diffuseColor.rgb*=1.0-.12*bx(gg,vec2(.28,.24),vec2(.72,.27))*aa;}
  glassAmt=(st==2.0||st==5.0)?wv:0.0;
  float on=st==1.0?.42:st==2.0?.58:st==3.0?.38:st==5.0?.62:0.0;
  winLit=uNight*(step(1.0-on,hc)*win*aa+wv*(1.0-aa)*on*.32);
  if(st==2.0)winLit+=uNight*.10;
  if(vFy.x>0.5&&vFx.y<4.75){
    float bu=vFx.x/4.2;float bi=floor(bu);float bf=fract(bu);float hs=h12(vec2(bi,vFy.y*97.0));
    vec3 conc=bcol0*.9;vec3 sc;float lit=0.0;float y=vFx.y;
    float pil=step(bf,.05)+step(.95,bf);
    if(y<3.2){
      if(pil>.5)sc=conc;
      else if(hs<.26+.55*uClosed){float s2=fract(y*6.5);sc=mix(vec3(.5,.52,.53),vec3(.66,.68,.69),step(.5,s2));lit=0.04;}
      else{vec3 ins=mix(vec3(.2,.17,.14),vec3(.78,.64,.44),h12(vec2(bi,5.0)));float fr=clamp(step(fract(bf*3.0),.035)+step(2.75,y)*step(y,2.85)+step(y,.75)*.6,0.,1.);
        sc=mix(ins*.5+vec3(.05,.06,.08),vec3(.16),fr);lit=(1.0-fr)*(.7+.3*hs);glassAmt=.6*(1.0-fr);}
    }else if(y<3.6){sc=conc*.72;}
    else{sc=mix(conc,pal6(h12(vec2(bi,vFy.y*13.0))),.55*step(.3,hs));lit=.12;}
    diffuseColor.rgb=sc;winLit=lit*uNight*.62;
  }
}`)
  .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.3,glassAmt);')
  .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=mix(vec3(1.0,.74,.42),vec3(.82,.9,1.0),st==2.0?.55:0.0)*winLit*(st==2.0?.85:1.2);');
}
let facadeMat;
function makeFacadeMat() { facadeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0 }); facadeMat.extensions = { derivatives: true }; facadeMat.onBeforeCompile = facadeShader; }

/* geometry builder for landmark models (feeds the facade material) */
class GB {
  constructor() { this.P = []; this.N = []; this.C = []; this.F = []; this.Y = []; }
  add(geo, mtx, hex, style, baseY, uOff) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()); g.applyMatrix4(mtx); g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array; const c = C(hex); const uo = uOff || 0;
    for (let i = 0; i < p.length; i += 3) { const vert = Math.abs(n[i + 1]) < 0.6;
      this.P.push(p[i], p[i + 1], p[i + 2]); this.N.push(n[i], n[i + 1], n[i + 2]); this.C.push(c.r, c.g, c.b);
      this.F.push((Math.abs(n[i]) > Math.abs(n[i + 2]) ? p[i + 2] : p[i]) + uo, p[i + 1] - (baseY || 0), vert ? (style || 0) : 0); this.Y.push(0, 0); }
    g.dispose(); return this; }
  raw(pos, nor, hex, fx) { const c = C(hex); for (let i = 0; i < pos.length; i += 3) { this.P.push(pos[i], pos[i + 1], pos[i + 2]); this.N.push(nor[i], nor[i + 1], nor[i + 2]); this.C.push(c.r, c.g, c.b); this.F.push(fx[i], fx[i + 1], fx[i + 2]); this.Y.push(0, 0); } return this; }
  geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3)); g.setAttribute('fx', new THREE.Float32BufferAttribute(this.F, 3)); g.setAttribute('fy', new THREE.Float32BufferAttribute(this.Y, 2)); g.computeBoundingSphere(); return g; }
  mesh(mat) { const m = new THREE.Mesh(this.geo(), mat || facadeMat); m.castShadow = true; m.receiveShadow = true; return m; }
}
const M4 = () => new THREE.Matrix4();
function TRS(x, y, z, ry, sx, sy, sz) { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0), new THREE.Vector3(sx || 1, sy || 1, sz || 1)); return m; }
const BOX1 = new THREE.BoxGeometry(1, 1, 1);
function beam(gb, a, b, t, hex) { const d = new THREE.Vector3().subVectors(b, a); const L = d.length(); if (L < 0.01) return; const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()), new THREE.Vector3(t, t, L)); gb.add(BOX1, m, hex, 0, 0); }

/* ---------- roads + sidewalks ---------- */
const RW = [11, 8.5, 7, 5.2];
const ROADS = [];
function roadShader(sh) {
  sh.uniforms.uNight = FU.uNight; sh.uniforms.uWet = FU.uWet;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 ruv;\nvarying vec3 vR;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvR=ruv;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vR;uniform float uNight;uniform float uWet;')
  .replace('#include <color_fragment>', `#include <color_fragment>
float kind=floor(vR.z/10.0+.001);float cls=vR.z-kind*10.0;float rl=0.0;float av=abs(vR.y);
if(kind>2.5){
  vec2 t=fract(vec2(vR.x*.9,av*2.6));float joint=step(t.x,.05)+step(t.y,.07);
  diffuseColor.rgb=mix(vec3(.68,.66,.62),vec3(.6,.58,.55),clamp(joint,0.,1.));
  float curb=smoothstep(.0,.08,av-1.0)*(1.0-smoothstep(.08,.16,av-1.0));
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.79,.76),curb);
}else if(kind<1.5){float fv=fwidth(vR.y)*1.5;float fade=clamp(1.0-fv*3.0,0.0,1.0);
 float dash=step(fract(vR.x/9.0),.5);
 float edge=smoothstep(.80-fv,.80,av)*(1.0-smoothstep(.87,.87+fv,av));
 float cen=(1.0-smoothstep(.035,.035+fv,av))*(cls<1.5?1.0:dash);
 float lane=cls<.5?(1.0-smoothstep(.035,.035+fv,abs(av-.42)))*dash:0.0;
 rl=(cls<2.5?max(edge,max(cen,lane)):edge*.6)*fade;
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.93,.9),rl*.85);}
diffuseColor.rgb*=1.0-uWet*.28;`)
  .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.22,uWet*step(kind,1.5));')
  .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.0,.72,.4)*uNight*(kind<1.5?(cls<1.5?.11:.06):(kind>2.5?.035:0.0))+rl*uNight*.05;');
}
function buildRoads() {
  MAT.road = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  MAT.road.extensions = { derivatives: true }; MAT.road.onBeforeCompile = roadShader;
  MAT.side = new THREE.MeshStandardMaterial({ roughness: .95, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5 });
  MAT.side.extensions = { derivatives: true }; MAT.side.onBeforeCompile = roadShader;
  const Pp = [], Nn = [], Cc = [], Rr = []; const Sp = [], Sn = [], Sr = []; const piers = [];
  const push = (x, y, z, nx, ny, nz, c, u, v, f) => { Pp.push(x, y, z); Nn.push(nx, ny, nz); Cc.push(c, c, c); Rr.push(u, v, f); };
  const spush = (x, y, z, u, v) => { Sp.push(x, y, z); Sn.push(0, 1, 0); Sr.push(u, v, 30); };
  for (const r of D.r) {
    const cls = r[0], br = r[1] === 1; const pts = decLine(r, 2); if (pts.length < 2) continue;
    const w = RW[cls] * (br ? 1.15 : 1), hw = w / 2, off = (3 - cls) * 0.035;
    if (!br) for (const p of pts) { const t = heightAt(p[0], p[1]); if (t > 0) p[2] = Math.max(p[2], t + 0.3); p[2] += off; } else for (const p of pts) p[2] += off;
    const L = [], R = [], U = [0];
    for (let k = 1; k < pts.length; k++) U.push(U[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    ROADS.push({ cls, br, pts, cum: U, len: U[U.length - 1], hw });
    const sw = (!br && cls >= 1) ? (cls === 3 ? 1.8 : 2.6) : 0;
    const NRM = [];
    for (let k = 0; k < pts.length; k++) { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const nx = -dz, nz = dx; NRM.push([nx, nz]);
      L.push([pts[k][0] + nx * hw, pts[k][2], pts[k][1] + nz * hw, nx, nz]); R.push([pts[k][0] - nx * hw, pts[k][2], pts[k][1] - nz * hw]); }
    const ct = br ? 1.32 : 1, f = cls + (br ? 10 : 0);
    for (let k = 0; k < pts.length - 1; k++) { const l0 = L[k], l1 = L[k + 1], r0 = R[k], r1 = R[k + 1], u0 = U[k], u1 = U[k + 1];
      push(l0[0], l0[1], l0[2], 0, 1, 0, ct, u0, 1, f); push(l1[0], l1[1], l1[2], 0, 1, 0, ct, u1, 1, f); push(r0[0], r0[1], r0[2], 0, 1, 0, ct, u0, -1, f);
      push(r0[0], r0[1], r0[2], 0, 1, 0, ct, u0, -1, f); push(l1[0], l1[1], l1[2], 0, 1, 0, ct, u1, 1, f); push(r1[0], r1[1], r1[2], 0, 1, 0, ct, u1, -1, f);
      if (sw) { const e = 1 + sw / hw; const y0 = pts[k][2] - 0.02, y1 = pts[k + 1][2] - 0.02;
        for (const s of [1, -1]) { const n0 = NRM[k], n1 = NRM[k + 1];
          const a0 = [pts[k][0] + n0[0] * hw * s, pts[k][1] + n0[1] * hw * s], b0 = [pts[k][0] + n0[0] * (hw + sw) * s, pts[k][1] + n0[1] * (hw + sw) * s];
          const a1 = [pts[k + 1][0] + n1[0] * hw * s, pts[k + 1][1] + n1[1] * hw * s], b1 = [pts[k + 1][0] + n1[0] * (hw + sw) * s, pts[k + 1][1] + n1[1] * (hw + sw) * s];
          spush(a0[0], y0, a0[1], u0, 1); spush(a1[0], y1, a1[1], u1, 1); spush(b0[0], y0, b0[1], u0, e);
          spush(b0[0], y0, b0[1], u0, e); spush(a1[0], y1, a1[1], u1, 1); spush(b1[0], y1, b1[1], u1, e); } }
      if (br) { const dh = 1.7, cs = 1.05, fs = 20 + cls;
        for (const [e0, e1, s] of [[l0, l1, 1], [r0, r1, -1]]) { const nx = l0[3] * s, nz = l0[4] * s;
          push(e0[0], e0[1] + .6, e0[2], nx, 0, nz, cs, 0, 0, fs); push(e0[0], e0[1] - dh, e0[2], nx, 0, nz, cs, 0, 0, fs); push(e1[0], e1[1] + .6, e1[2], nx, 0, nz, cs, 0, 0, fs);
          push(e1[0], e1[1] + .6, e1[2], nx, 0, nz, cs, 0, 0, fs); push(e0[0], e0[1] - dh, e0[2], nx, 0, nz, cs, 0, 0, fs); push(e1[0], e1[1] - dh, e1[2], nx, 0, nz, cs, 0, 0, fs); }
        push(l0[0], l0[1] - dh, l0[2], 0, -1, 0, .8, 0, 0, fs); push(r0[0], r0[1] - dh, r0[2], 0, -1, 0, .8, 0, 0, fs); push(l1[0], l1[1] - dh, l1[2], 0, -1, 0, .8, 0, 0, fs);
        push(r0[0], r0[1] - dh, r0[2], 0, -1, 0, .8, 0, 0, fs); push(r1[0], r1[1] - dh, r1[2], 0, -1, 0, .8, 0, 0, fs); push(l1[0], l1[1] - dh, l1[2], 0, -1, 0, .8, 0, 0, fs); } }
    if (br) { let acc = 0; for (let k = 1; k < pts.length; k++) { acc += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      if (acc >= 50) { acc = 0; const g = heightAt(pts[k][0], pts[k][1]); const bot = g < 0 ? -6 : g; const top = pts[k][2] - 1.7; if (top - bot > 3) piers.push([pts[k][0], pts[k][1], bot, top, Math.atan2(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]), w]); } } }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('ruv', new THREE.Float32BufferAttribute(Rr, 3));
  const rm = new THREE.Mesh(g, MAT.road); rm.receiveShadow = true; rm.castShadow = true; world.add(rm);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(Sp, 3)); sg.setAttribute('normal', new THREE.Float32BufferAttribute(Sn, 3)); sg.setAttribute('ruv', new THREE.Float32BufferAttribute(Sr, 3));
  const sm = new THREE.Mesh(sg, MAT.side); sm.receiveShadow = true; world.add(sm);
  const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, .5, 0);
  const pm = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0xbab8b2, roughness: .9 }), Math.max(1, piers.length)); const o = new THREE.Object3D();
  piers.forEach((p, i) => { o.position.set(p[0], p[2], p[1]); o.rotation.set(0, p[4], 0); o.scale.set(p[5] * 0.55, p[3] - p[2], 3.2); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); });
  pm.count = piers.length; pm.castShadow = true; pm.frustumCulled = false; world.add(pm);
  MAT.runway = new THREE.MeshStandardMaterial({ roughness: .95 });
  const c = [3268.2, 1259.4], ax = [0.3019, 0.9533], yaw = Math.atan2(ax[0], ax[1]);
  const rw = new THREE.Mesh(new THREE.BoxGeometry(45, 0.3, 3360), MAT.runway); rw.position.set(c[0], BASE + 0.15, c[1]); rw.rotation.y = yaw; rw.receiveShadow = true; world.add(rw);
  const dm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.1, 30), new THREE.MeshStandardMaterial({ color: 0xeeeeea }), 60);
  for (let i = 0; i < 60; i++) { const t = (i / 59 - 0.5) * 3200; o.position.set(c[0] + ax[0] * t, BASE + 0.36, c[1] + ax[1] * t); o.rotation.set(0, yaw, 0); o.scale.set(1, 1, 1); o.updateMatrix(); dm.setMatrixAt(i, o.matrix); }
  dm.frustumCulled = false; world.add(dm);
}

/* cut away an object's fragments close to the camera (awnings over the pavement would otherwise hide the player) */
function nearFade(mat, r) { mat.customProgramCacheKey = () => 'nf' + r + (mat.userData.ck || ''); mat.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNfW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 nfp=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nnfp=instanceMatrix*nfp;\n#endif\nvNfW=(modelMatrix*nfp).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNfW;').replace('void main() {', 'void main() {\nfloat nfd=distance(vNfW,cameraPosition);if(nfd<' + r.toFixed(1) + '){float th=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);if(th>(nfd-' + (r * .55).toFixed(1) + ')/' + (r * .45).toFixed(1) + ')discard;}'); }; }
/* ---------- buildings ---------- */
const COL = { rings: [], top: [], base: [], box: [] };
const BINFO = []; // per OSM building: {cx,cz,base,top,area}
const AWN_COLS = ['#2E6B4F', '#B3362C', '#2C4F7C', '#D9D4C7', '#5B5E61', '#7A2E46', '#C9A04A', '#3D7A8C'];
async function buildBuildings() {
  const B = D.b, NB = B.length;
  const frontMap = new Map();
  for (let i = 0; i < W.front.length;) { const bi = W.front[i], n = W.front[i + 1]; frontMap.set(bi, new Set(W.front.slice(i + 2, i + 2 + n))); i += 2 + n; }
  const CH = 700, map = new Map();
  for (let bi = 0; bi < NB; bi++) { const r = B[bi][5]; const key = Math.floor(r[0] / Q / CH) + ',' + Math.floor(r[1] / Q / CH); if (!map.has(key)) map.set(key, []); map.get(key).push(bi); }
  const roofBoxes = []; const AW = { P: [], N: [], C: [] };
  const awBox = (ax, az, bx, bz, nx, nz, y, depth, hex) => { const c = C(hex); const t = 0.16;
    const p = [[ax, az], [bx, bz], [bx + nx * depth, bz + nz * depth], [ax + nx * depth, az + nz * depth]];
    const quad = (a, b, cc, d, n, sh) => { for (const q of [a, b, cc, a, cc, d]) { AW.P.push(q[0], q[1], q[2]); AW.N.push(n[0], n[1], n[2]); AW.C.push(c.r * sh, c.g * sh, c.b * sh); } };
    const T = p.map(q => [q[0], y + t, q[1]]), Bt = p.map(q => [q[0], y, q[1]]);
    quad(T[0], T[3], T[2], T[1], [0, 1, 0], 1); quad(Bt[0], Bt[1], Bt[2], Bt[3], [0, -1, 0], .55);
    quad(Bt[3], T[3], T[2], Bt[2], [nx, 0, nz], .85); quad(Bt[1], T[1], T[2], Bt[2], [nz, 0, -nx], .8); quad(Bt[0], T[0], T[3], Bt[3], [-nz, 0, nx], .8); };
  let done = 0, last = performance.now();
  const wc = new THREE.Color(), rc = new THREE.Color();
  for (const list of map.values()) {
    const Pp = [], Nn = [], Cc = [], FX = [], FY = [];
    for (const bi of list) {
      const b = B[bi]; const base = b[0] / 10 - 0.6, top = b[1] / 10, style = D.bs[bi];
      wc.setHex(D.bw[bi]).multiplyScalar(0.96 + 0.08 * hsh(bi)); rc.setHex(D.br[bi]).multiplyScalar(0.97 + 0.06 * hsh(bi + 5));
      const rings = []; for (let k = 5; k < b.length; k++) rings.push(decRing(b[k]));
      const outer = rings[0]; const n0 = outer.length; const rev = ringArea(outer) > 0; if (rev) outer.reverse();
      const holes = rings.slice(1).map(h => ringArea(h) < 0 ? h.reverse() : h);
      let cx = 0, cz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of outer) { cx += p[0]; cz += p[1]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); } cx /= outer.length; cz /= outer.length;
      COL.rings.push(outer); COL.top.push(top); COL.base.push(base); COL.box.push([x0, x1, z0, z1]);
      const area = Math.abs(ringArea(outer)); BINFO.push({ cx, cz, base, top, area });
      const hgt = top - base; const aoB = hgt > 40 ? 0.6 : 0.72; const uo = hsh(bi) * 400; const fset = frontMap.get(bi);
      const pushV = (x, y, z, nx, nz, ao, u, h, st, fr, sd) => { Pp.push(x, y, z); Nn.push(nx, 0, nz); Cc.push(wc.r * ao, wc.g * ao, wc.b * ao); FX.push(u, h, st); FY.push(fr, sd); };
      let ringIdx = 0;
      for (const ring of [outer, ...holes]) { let u = uo;
        for (let i = 0; i < ring.length; i++) { const a = ring[i], c = ring[(i + 1) % ring.length]; const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
          let nx = -(c[1] - a[1]), nz = c[0] - a[0]; const l = len || 1; nx /= l; nz /= l;
          let fr = 0, sd = 0;
          if (ringIdx === 0 && fset) { const k = rev ? ((n0 - 2 - i) % n0 + n0) % n0 : i; if (fset.has(k)) { fr = 1; sd = hsh(bi * 31 + i); } }
          pushV(a[0], base, a[1], nx, nz, aoB, u, 0, style, fr, sd); pushV(c[0], base, c[1], nx, nz, aoB, u + len, 0, style, fr, sd); pushV(c[0], top, c[1], nx, nz, 1, u + len, hgt, style, fr, sd);
          pushV(a[0], base, a[1], nx, nz, aoB, u, 0, style, fr, sd); pushV(c[0], top, c[1], nx, nz, 1, u + len, hgt, style, fr, sd); pushV(a[0], top, a[1], nx, nz, 1, u, hgt, style, fr, sd);
          if (fr && len > 3.2 && hgt > 5) { const ox = nx, oz = nz; const tx = (c[0] - a[0]) / l, tz = (c[1] - a[1]) / l; const dep = (sd < .5 ? 1.2 : 1.6);
            awBox(a[0] + tx * .15, a[1] + tz * .15, c[0] - tx * .15, c[1] - tz * .15, ox, oz, base + 0.6 + 3.22, dep, AWN_COLS[(sd * 97 | 0) % AWN_COLS.length]); }
          u += len; }
        ringIdx++; }
      const contour = outer.map(p => new THREE.Vector2(p[0], p[1])), hv = holes.map(h => h.map(p => new THREE.Vector2(p[0], p[1])));
      let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(contour, hv); } catch (e) {}
      const all = contour.concat(...hv);
      for (const t of tris) { const p0 = all[t[0]], p1 = all[t[1]], p2 = all[t[2]]; if (!p0 || !p1 || !p2) continue;
        const ny = (p1.y - p0.y) * (p2.x - p0.x) - (p1.x - p0.x) * (p2.y - p0.y); const q = ny >= 0 ? [p0, p1, p2] : [p0, p2, p1];
        for (const v of q) { Pp.push(v.x, top, v.y); Nn.push(0, 1, 0); Cc.push(rc.r, rc.g, rc.b); FX.push(0, 0, 0); FY.push(0, 0); } }
      if ((style === 1 || style === 2) && hgt > 25 && area > 250 && pipRing(cx, cz, outer)) { const s = Math.min(9, Math.sqrt(area) * 0.17), hh = 2.6 + hsh(bi + 7) * 2.4; roofBoxes.push([cx, top, cz, s, hh, s * (0.8 + hsh(bi + 3) * .6)]); }
      done++;
      if (performance.now() - last > 40) { progress('擠出建築 ' + done.toLocaleString() + ' / ' + NB.toLocaleString(), 0.46 + 0.26 * done / NB); await tick0(); last = performance.now(); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('fx', new THREE.Float32BufferAttribute(FX, 3)); g.setAttribute('fy', new THREE.Float32BufferAttribute(FY, 2));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, facadeMat); m.castShadow = true; m.receiveShadow = true; world.add(m);
  }
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(AW.P, 3)); ag.setAttribute('normal', new THREE.Float32BufferAttribute(AW.N, 3)); ag.setAttribute('color', new THREE.Float32BufferAttribute(AW.C, 3));
  const amat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }); nearFade(amat, 7.5);
  const am = new THREE.Mesh(ag, amat); am.castShadow = true; am.receiveShadow = true; world.add(am);
  MAT.roof = new THREE.MeshStandardMaterial({ roughness: .95 });
  const rm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), MAT.roof, Math.max(1, roofBoxes.length)); const o = new THREE.Object3D();
  roofBoxes.forEach((r, i) => { o.position.set(r[0], r[1], r[2]); o.scale.set(r[3], r[4], r[5]); o.updateMatrix(); rm.setMatrixAt(i, o.matrix); }); rm.castShadow = true; rm.receiveShadow = true; rm.frustumCulled = false; world.add(rm);
}

/* ---------- landmark models ---------- */
const MOD = {}; const glowMats = []; const LMPICK = [];
function addCol(ring, base, top) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of ring) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); } COL.rings.push(ring); COL.base.push(base); COL.top.push(top); COL.box.push([x0, x1, z0, z1]); }
function rectRing(cx, cz, w, d, a) { const c = Math.cos(a), s = Math.sin(a); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(q => { const lx = q[0] * w / 2, lz = q[1] * d / 2; return [cx + lx * c - lz * s, cz + lx * s + lz * c]; }); }
function circRing(cx, cz, r, n) { const o = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; o.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]); } return o; }
function buildLandmarks() {
  for (const m of D.m) MOD[m.k] = m;
  const rot = a => -a;
  { const [tx, tz] = D.tower; const g0 = groundAt(tx, tz); const gb = new GB(); const add = (geo, y, hex, st) => gb.add(geo, TRS(tx, g0 + y, tz), hex, st || 0, g0);
    add(new THREE.CylinderGeometry(6.5, 10, 214, 24), 107, '#C9C7C0', 4);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + .3; gb.add(new THREE.BoxGeometry(4, 60, 7), TRS(tx + Math.cos(a) * 9, g0 + 30, tz + Math.sin(a) * 9, -a), '#BDBBB4', 0, g0); }
    add(new THREE.CylinderGeometry(19, 14, 12, 36), 220, '#3E5563', 2); add(new THREE.CylinderGeometry(20, 19, 1.4, 36), 226.7, '#D2D2CD');
    add(new THREE.CylinderGeometry(17, 20, 9, 36), 232, '#4A6170', 2); add(new THREE.CylinderGeometry(11, 13, 6, 30), 239.5, '#D2D2CD');
    add(new THREE.CylinderGeometry(1.1, 3.6, 94, 12), 289, '#E6E6E2');
    for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(2.6 - k * .25, 2.7 - k * .25, 2, 12), 252 + k * 12, k % 2 ? '#E6E6E2' : '#B8463A');
    world.add(gb.mesh()); addCol(circRing(tx, tz, 12, 10), g0 - 1, g0 + 338); }
  if (MOD.lisboa_podium) { const m = MOD.lisboa_podium; const ring = decRing(m.ring); let cx = 0, cz = 0; for (const p of ring) { cx += p[0]; cz += p[1]; } cx /= ring.length; cz /= ring.length;
    if (ringArea(ring) > 0) ring.reverse(); const K = 12, H = 48, y0 = m.y, lv = [];
    for (let k = 0; k <= K; k++) { const t = k / K; const s = Math.cos(t * Math.PI / 2) * .98 + .02, y = y0 + H * Math.sin(t * Math.PI / 2); lv.push(ring.map(p => [cx + (p[0] - cx) * s, y, cz + (p[1] - cz) * s])); }
    const arr = [], fxa = [];
    for (let k = 0; k < K; k++) { let u = 0; for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; const a = lv[k][i], b = lv[k][j], c = lv[k + 1][j], d = lv[k + 1][i]; const du = Math.hypot(b[0] - a[0], b[2] - a[2]);
      arr.push(...a, ...b, ...c, ...a, ...c, ...d); fxa.push(u, a[1] - y0, 2, u + du, b[1] - y0, 2, u + du, c[1] - y0, 2, u, a[1] - y0, 2, u + du, c[1] - y0, 2, u, d[1] - y0, 2); u += du; } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); geo.computeVertexNormals();
    world.add(new GB().raw(arr, geo.attributes.normal.array, '#CDA650', fxa).mesh()); addCol(lv[2].map(p => [p[0], p[2]]), y0 - 1, y0 + H); }
  if (MOD.lisboa_tower) { const m = MOD.lisboa_tower; const mtx = TRS(m.x, m.y, m.z, rot(m.a));
    const Wd = m.w / 2, Dd = m.d / 2, N = 48, lv = []; const hs = []; for (let h = 0; h <= 200; h += 6.25) hs.push(h); hs.push(206, 211);
    for (const h of hs) { const s = Math.pow(Math.min(h, 200) / 200, 1.5); let a = Wd * (0.74 + 0.26 * s), b = Dd * (0.62 + 0.72 * s); if (h > 200) { const k = (h - 200) / 11; a *= 1 - 0.25 * k; b *= 1 - 0.3 * k; }
      const ring = []; for (let i = 0; i < N; i++) { const th = i / N * Math.PI * 2; const c = Math.cos(th), sn = Math.sin(th); const r = 1 + 0.035 * Math.cos(8 * th);
        ring.push([Math.sign(c) * Math.pow(Math.abs(c), 2 / 3.2) * a * r, h, Math.sign(sn) * Math.pow(Math.abs(sn), 2 / 3.2) * b * r]); } lv.push(ring); }
    const arr = [], fxa = [];
    for (let k = 0; k < lv.length - 1; k++) { let u = 0; for (let i = 0; i < N; i++) { const j = (i + 1) % N; const a = lv[k][i], b = lv[k][j], c = lv[k + 1][j], d = lv[k + 1][i]; const du = Math.hypot(b[0] - a[0], b[2] - a[2]);
      arr.push(...a, ...c, ...b, ...a, ...d, ...c); fxa.push(u, a[1], 2, u + du, c[1], 2, u + du, b[1], 2, u, a[1], 2, u, d[1], 2, u + du, c[1], 2); u += du; } }
    const top = lv[lv.length - 1]; for (let i = 0; i < N; i++) { const j = (i + 1) % N; arr.push(0, 211, 0, ...top[j], ...top[i]); fxa.push(0, 0, 0, 0, 0, 0, 0, 0, 0); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); geo.applyMatrix4(mtx); geo.computeVertexNormals();
    const gb = new GB().raw(geo.attributes.position.array, geo.attributes.normal.array, '#C29A4A', fxa);
    const top2 = lv[lv.length - 3];
    for (let i = 0; i < N; i += 2) { const p = top2[i]; const ang = Math.atan2(p[2], p[0]); const L = 34 + 24 * Math.abs(Math.cos(ang));
      beam(gb, new THREE.Vector3(p[0] * 0.92, 198, p[2] * 0.92).applyMatrix4(mtx), new THREE.Vector3(p[0] * 1.18, 198 + L, p[2] * 1.25).applyMatrix4(mtx), 2.2, '#E0BE6C'); }
    gb.add(new THREE.CylinderGeometry(1.2, 5, 50, 10), TRS(m.x, m.y + 232, m.z), '#E0BE6C', 0, 0); gb.add(new THREE.SphereGeometry(7, 16, 10), TRS(m.x, m.y + 214, m.z), '#E8CC86', 0, 0);
    world.add(gb.mesh()); addCol(rectRing(m.x, m.z, m.w * .75, m.d * .62, m.a), m.y - 1, m.y + 258); }
  if (MOD.stpaul) { const m = MOD.stpaul; const ry = rot(m.a), s = m.s, Wd = Math.max(m.w, 22); const gb = new GB(); const st = '#A69E8F', dk = '#3B3732';
    const L = (x, y, z) => TRS(m.x, m.y, m.z, ry).multiply(TRS(x, y, z * s));
    gb.add(BOX1, L(0, 4.5, 0).multiply(TRS(0, 0, 0, 0, Wd, 9, 2.4)), st, 0, m.y); gb.add(BOX1, L(0, 12.3, 0).multiply(TRS(0, 0, 0, 0, Wd, 6.6, 2.2)), st, 0, m.y);
    gb.add(BOX1, L(0, 18.4, 0).multiply(TRS(0, 0, 0, 0, Wd * .62, 5.6, 2)), st, 0, m.y);
    const tri = new THREE.Shape([new THREE.Vector2(-Wd * .22, 0), new THREE.Vector2(Wd * .22, 0), new THREE.Vector2(0, 5.4)]);
    gb.add(new THREE.ExtrudeGeometry(tri, { depth: 1.8, bevelEnabled: false }).translate(0, 0, -.9), L(0, 21.2, 0), st, 0, m.y);
    gb.add(BOX1, L(0, 27.4, 0).multiply(TRS(0, 0, 0, 0, .5, 2.4, .5)), st, 0, m.y); gb.add(BOX1, L(0, 27.8, 0).multiply(TRS(0, 0, 0, 0, 1.6, .45, .5)), st, 0, m.y);
    for (let t = 0; t < 3; t++) { const y0 = [0, 9, 15.6][t], hh = [9, 6.6, 5.6][t], ww = [Wd, Wd, Wd * .62][t], nc = [10, 10, 6][t];
      for (let i = 0; i < nc; i++) { const x = -ww / 2 + 0.8 + i * (ww - 1.6) / (nc - 1); gb.add(new THREE.CylinderGeometry(.38, .42, hh - .6, 8), L(x, y0 + hh / 2, 1.35), '#B4AC9C', 0, m.y); } }
    for (const x of [-Wd * .3, 0, Wd * .3]) gb.add(BOX1, L(x, 2.8, 1.25).multiply(TRS(0, 0, 0, 0, x === 0 ? 3 : 2.4, x === 0 ? 5.4 : 4.6, .15)), dk, 0, m.y);
    for (const x of [-Wd * .25, Wd * .25]) gb.add(BOX1, L(x, 12.3, 1.15).multiply(TRS(0, 0, 0, 0, 2, 3, .15)), dk, 0, m.y);
    gb.add(BOX1, L(0, 19, 1.05).multiply(TRS(0, 0, 0, 0, 2.2, 2.8, .15)), dk, 0, m.y);
    for (let i = 0; i < 16; i++) { const z = 2.6 + i * 2.05, topY = -m.drop * (i + 1) / 16; const hh = m.drop + 4 + topY; gb.add(BOX1, L(0, topY - hh / 2, z).multiply(TRS(0, 0, 0, 0, i % 6 === 5 ? 30 : 26, hh, 2.1)), '#B3AA98', 0, m.y); }
    world.add(gb.mesh()); addCol(rectRing(m.x, m.z, Wd, 3, m.a), m.y - 1, m.y + 27); }
  if (MOD.guia) { const m = MOD.guia; const y0 = Math.max(m.y, groundAt(m.x, m.z) - 1.5); const gb = new GB(); const a = (geo, y, hex, st) => gb.add(geo, TRS(m.x, y0 + y, m.z), hex, st || 0, y0);
    a(new THREE.CylinderGeometry(4.6, 4.8, 1.2, 20), .6, '#D9D5CB'); a(new THREE.CylinderGeometry(2.7, 3.4, 11, 20), 6.7, '#F2F1EC', 3); a(new THREE.CylinderGeometry(3.9, 3.9, .5, 20), 12.4, '#E8E6DF');
    a(new THREE.CylinderGeometry(1.9, 1.9, 2.2, 16), 13.8, '#2E3F48', 2); a(new THREE.SphereGeometry(2.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 14.9, '#8E3A2F');
    world.add(gb.mesh()); addCol(circRing(m.x, m.z, 4.8, 10), y0 - 1, y0 + 17); }
  const eiffelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, metalness: .25 }); glowMats.push([eiffelMat, 0x6a4614]);
  if (MOD.eiffel) { const m = MOD.eiffel; const mtx = TRS(m.x, m.y, m.z, rot(m.a)); const gb = new GB(); const col = '#7C6852';
    const half = Math.min(m.w, m.d) / 2; const prof = [[0, half], [14, half * .74], [28.8, half * .55], [43, half * .42], [57.6, half * .33], [80, half * .26], [100, half * .21], [120, half * .17], [138, half * .145], [150, half * .09], [158, half * .05]];
    const wAt = h => { for (let i = 1; i < prof.length; i++) if (h <= prof[i][0]) { const t = (h - prof[i - 1][0]) / (prof[i][0] - prof[i - 1][0]); return prof[i - 1][1] + (prof[i][1] - prof[i - 1][1]) * t; } return prof[prof.length - 1][1]; };
    const V = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(mtx);
    const legH = []; for (let h = 0; h <= 57.6; h += 4.8) legH.push(h);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      for (let k = 0; k < legH.length - 1; k++) { const h0 = legH[k], h1 = legH[k + 1]; const w0 = wAt(h0), w1 = wAt(h1); const s0 = Math.max(5, 12 - h0 * .11), s1 = Math.max(5, 12 - h1 * .11);
        const c0 = [sx * (w0 - s0 / 2), sz * (w0 - s0 / 2)], c1 = [sx * (w1 - s1 / 2), sz * (w1 - s1 / 2)];
        const cor = (c, s, h) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(q => V(c[0] + q[0] * s / 2, h, c[1] + q[1] * s / 2)); const A = cor(c0, s0, h0), Bq = cor(c1, s1, h1);
        for (let q = 0; q < 4; q++) { beam(gb, A[q], Bq[q], 1.0, col); beam(gb, A[q], Bq[(q + 1) % 4], .45, col); beam(gb, A[(q + 1) % 4], Bq[q], .45, col); } }
      const lc = [sx * (half - 6), sz * (half - 6)]; const c = Math.cos(m.a), s = Math.sin(m.a); addCol(rectRing(m.x + lc[0] * c - lc[1] * s, m.z + lc[0] * s + lc[1] * c, 11, 11, m.a), m.y - 1, m.y + 30); }
    const shH = []; for (let h = 57.6; h <= 150; h += 5.6) shH.push(h);
    for (let k = 0; k < shH.length - 1; k++) { const h0 = shH[k], h1 = shH[k + 1], w0 = wAt(h0), w1 = wAt(h1);
      const A = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(q => V(q[0] * w0, h0, q[1] * w0)), Bq = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(q => V(q[0] * w1, h1, q[1] * w1));
      for (let q = 0; q < 4; q++) { beam(gb, A[q], Bq[q], Math.max(.5, 1.1 - h0 * .004), col); beam(gb, A[q], Bq[(q + 1) % 4], .35, col); beam(gb, A[(q + 1) % 4], Bq[q], .35, col); } }
    const plat = (h, w, t) => gb.add(BOX1, mtx.clone().multiply(TRS(0, h, 0, 0, w * 2, t, w * 2)), col, 0, m.y);
    plat(28.8, wAt(28.8) + 1.5, 2.4); plat(57.6, wAt(57.6) + 1, 1.8);
    gb.add(BOX1, mtx.clone().multiply(TRS(0, 140.5, 0, 0, wAt(138) * 2 + 1, 5, wAt(138) * 2 + 1)), col, 0, m.y);
    gb.add(new THREE.CylinderGeometry(.35, 1.4, 13, 8), mtx.clone().multiply(TRS(0, 155.5, 0)), col, 0, m.y);
    for (let sd = 0; sd < 4; sd++) { const ang = sd * Math.PI / 2; const pts = []; const R = half - 11, off = half - 6;
      for (let i = 0; i <= 16; i++) { const t = Math.PI * i / 16; pts.push(new THREE.Vector3(Math.cos(t) * R, Math.sin(t) * R * .95, 0)); }
      gb.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .7, 6, false), mtx.clone().multiply(new THREE.Matrix4().makeRotationY(ang)).multiply(TRS(0, 0, off)), col, 0, m.y); }
    world.add(gb.mesh(eiffelMat)); }
  if (MOD.morpheus) { const m = MOD.morpheus; const mtx = TRS(m.x, m.y, m.z, rot(m.a)); const Wd = m.w, Dd = m.d, H = 155.2; const gb = new GB();
    const voids = [[-.2, .16, 24, 52], [.2, .15, 72, 100], [-.02, .14, 114, 136]]; const cuts = [0, H]; for (const v of voids) cuts.push(v[2], v[3]); cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) { const y0 = cuts[i], y1 = cuts[i + 1]; if (y1 - y0 < 0.1) continue; const ym = (y0 + y1) / 2; const vd = voids.filter(v => ym > v[2] && ym < v[3]); let segs = [[-Wd / 2, Wd / 2]];
      for (const v of vd) { const a = v[0] * Wd - v[1] * Wd, b = v[0] * Wd + v[1] * Wd; segs = segs.flatMap(([s0, s1]) => { const out = []; if (a > s0) out.push([s0, Math.min(a, s1)]); if (b < s1) out.push([Math.max(b, s0), s1]); return out; }); }
      for (const [s0, s1] of segs) if (s1 - s0 > 1) gb.add(BOX1, mtx.clone().multiply(TRS((s0 + s1) / 2, ym, 0, 0, s1 - s0, y1 - y0, Dd)), '#4F5F69', 5, m.y, i * 13); }
    world.add(gb.mesh()); addCol(rectRing(m.x, m.z, Wd, Dd, m.a), m.y - 1, m.y + H); }
  if (MOD.bigben) { const m = MOD.bigben; const mtx = TRS(m.x, m.y, m.z, rot(m.a)); const s = Math.min(m.w, m.d) * 0.92; const gb = new GB(); const A = (geo, x, y, z, hex, st) => gb.add(geo, mtx.clone().multiply(TRS(x, y, z)), hex, st || 0, m.y);
    A(new THREE.BoxGeometry(s, 55, s), 0, 27.5, 0, '#CDBE98', 3); A(new THREE.BoxGeometry(s + 1.8, 11, s + 1.8), 0, 60.5, 0, '#D3C49E');
    for (let k = 0; k < 4; k++) gb.add(new THREE.CircleGeometry(3.6, 24), mtx.clone().multiply(new THREE.Matrix4().makeRotationY(k * Math.PI / 2)).multiply(TRS(0, 60.5, (s + 1.8) / 2 + .05)), '#F3EFE2', 0, m.y);
    A(new THREE.BoxGeometry(s * .9, 8, s * .9), 0, 70, 0, '#BFAF8A', 3);
    gb.add(new THREE.ConeGeometry(s * .7, 19, 4), mtx.clone().multiply(new THREE.Matrix4().makeTranslation(0, 83.5, 0)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 4)), '#4E5A56', 0, m.y);
    world.add(gb.mesh()); addCol(rectRing(m.x, m.z, s + 1.8, s + 1.8, m.a), m.y - 1, m.y + 96); }
  if (MOD.science) { const m = MOD.science; const gb = new GB();
    const ring = decRing(m.ring), hole = decRing(m.hole); const sh = new THREE.Shape(ring.map(p => new THREE.Vector2(p[0], -p[1]))); sh.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(p[0], -p[1]))));
    const pg = new THREE.ExtrudeGeometry(sh, { depth: 9, bevelEnabled: false }); pg.rotateX(-Math.PI / 2); gb.add(pg, TRS(0, m.y, 0), '#C5CBCF', 4, m.y);
    const [cx, cz, cr] = m.cone, [dx, dz, dr] = m.dome; let tx = cx - dx, tz = cz - dz; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    const cg = new THREE.CylinderGeometry(cr * .36, cr * .95, 46, 48, 8, false); cg.translate(0, 23, 0); const pa = cg.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setX(i, pa.getX(i) + tx * y * .2); pa.setZ(i, pa.getZ(i) + tz * y * .2); }
    gb.add(cg, TRS(cx, m.y, cz), '#D2D7DA', 2, m.y); gb.add(new THREE.SphereGeometry(dr * .95, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), TRS(dx, m.y + 3, dz), '#DADFE2', 0, m.y);
    world.add(gb.mesh()); addCol(ring, m.y - 1, m.y + 46); }
  const reelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .5 }); glowMats.push([reelMat, 0x7a5512]);
  if (MOD.studio) { const m = MOD.studio; const gb = new GB();
    const ext = (enc, h, hex, st) => { const r = decRing(enc); const sh = new THREE.Shape(r.map(p => new THREE.Vector2(p[0], -p[1]))); const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); gb.add(g, TRS(0, m.y, 0), hex, st, m.y); return r; };
    const pr = ext(m.podium, 38, '#D3C29C', 3); for (const t of m.towers) addCol(ext(t, 154.5, '#DCCCA6', 1), m.y - 1, m.y + 154.5); addCol(pr, m.y - 1, m.y + 38);
    world.add(gb.mesh());
    const g2 = new GB(); const tang = m.ra + Math.PI / 2; const tx = Math.cos(tang), tz = Math.sin(tang); const Hh = 72, Wd = 36, yc = m.y + 128; const pts = [];
    for (let i = 0; i < 64; i++) { const t = i / 64 * Math.PI * 2; const y = Hh / 2 * Math.sin(t), x = Wd * Math.sin(t) * Math.cos(t); pts.push(new THREE.Vector3(m.rx + tx * x, yc + y, m.rz + tz * x)); }
    const curve = new THREE.CatmullRomCurve3(pts, true); g2.add(new THREE.TubeGeometry(curve, 240, 2.1, 8, true), M4(), '#D7AE4D', 0, 0);
    for (let i = 0; i < 17; i++) { const p = curve.getPointAt(i / 17); g2.add(BOX1, TRS(p.x, p.y - 2.6, p.z, -tang, 3.6, 3.2, 3.6), '#EDE3C8', 0, 0); }
    world.add(g2.mesh(reelMat)); }
}

/* ---------- trees (tiled for distance culling) ---------- */
const treeTiles = [];
function buildTrees() {
  if (!D.t || !D.t.length) return; const tr = D.t; const n = tr.length / 4; const every = Qual().trees; const TS = 900; const tiles = new Map(); let x = 0, z = 0, y = 0;
  for (let i = 0; i < n; i++) { x += tr[4 * i]; z += tr[4 * i + 1]; y += tr[4 * i + 2]; if (i % every) continue; const k = Math.floor(x / TS) + ',' + Math.floor(z / TS); let t = tiles.get(k); if (!t) { t = { cx: (Math.floor(x / TS) + .5) * TS, cz: (Math.floor(z / TS) + .5) * TS, items: [] }; tiles.set(k, t); } t.items.push([x, y / 10, z, tr[4 * i + 3], i]); }
  const crown = new THREE.IcosahedronGeometry(1, 0); const trunk = new THREE.CylinderGeometry(.08, .12, 1, 5).translate(0, .5, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }); nearFade(mat, 4.5); const tmat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 }); const o = new THREE.Object3D();
  for (const t of tiles.values()) { const m = new THREE.InstancedMesh(crown, mat, t.items.length); const tk = new THREE.InstancedMesh(trunk, tmat, t.items.length); m.userData.cols = []; m.userData.ids = [];
    t.items.forEach((it, k) => { const sz = [3.2, 4.3, 5.6][it[3] >> 2] * (every > 1 ? 1.2 : 1); o.position.set(it[0], it[1] + sz * 0.95, it[2]); o.rotation.set(0, hsh(it[4]) * 6.28, 0); o.scale.set(sz, sz * (0.8 + hsh(it[4] + 1) * .3), sz); o.updateMatrix(); m.setMatrixAt(k, o.matrix);
      o.position.set(it[0], it[1], it[2]); o.scale.set(sz * 2.2, sz * 1.1, sz * 2.2); o.updateMatrix(); tk.setMatrixAt(k, o.matrix); m.userData.cols.push(it[3] & 3); m.userData.ids.push(it[4]); });
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; tk.frustumCulled = false; m.userData.cx = t.cx; m.userData.cz = t.cz; m.userData.trunk = tk; world.add(m); world.add(tk); treeTiles.push(m); }
}
function colorTrees(P) { const cs = P.trees.map(C); const c = new THREE.Color(); for (const m of treeTiles) { m.userData.cols.forEach((ci, i) => { c.copy(cs[ci]).multiplyScalar(0.92 + hsh(m.userData.ids[i]) * 0.16); m.setColorAt(i, c); }); if (m.instanceColor) m.instanceColor.needsUpdate = true; } }

/* ---------- spatial indices: collision, bridges, road graph ---------- */
const CS = 32; const colGrid = new Map(); const ckey = (i, j) => i * 100003 + j;
let colSeen, colStamp = 1;
function buildIndices() {
  for (let id = 0; id < COL.rings.length; id++) { const b = COL.box[id]; for (let i = Math.floor(b[0] / CS); i <= Math.floor(b[1] / CS); i++) for (let j = Math.floor(b[2] / CS); j <= Math.floor(b[3] / CS); j++) { const k = ckey(i, j); let l = colGrid.get(k); if (!l) { l = []; colGrid.set(k, l); } l.push(id); } }
  colSeen = new Int32Array(COL.rings.length);
  for (const rd of ROADS) { if (!rd.br) continue; for (let k = 0; k < rd.pts.length - 1; k++) { const a = rd.pts[k], b = rd.pts[k + 1]; const sg = { x0: a[0], z0: a[1], y0: a[2], x1: b[0], z1: b[1], y1: b[2], hw: rd.hw + 0.6 };
    for (let i = Math.floor((Math.min(a[0], b[0]) - sg.hw) / BS); i <= Math.floor((Math.max(a[0], b[0]) + sg.hw) / BS); i++) for (let j = Math.floor((Math.min(a[1], b[1]) - sg.hw) / BS); j <= Math.floor((Math.max(a[1], b[1]) + sg.hw) / BS); j++) { const kk = ckey(i, j); let l = brGrid.get(kk); if (!l) { l = []; brGrid.set(kk, l); } l.push(sg); } } }
  ROADS.forEach((rd, ri) => { const a = rd.pts[0], b = rd.pts[rd.pts.length - 1]; rd.ka = nkey(a[0], a[1]); rd.kb = nkey(b[0], b[1]);
    for (const [k, p, end] of [[rd.ka, a, 0], [rd.kb, b, 1]]) { let n = NODES.get(k); if (!n) { n = { x: p[0], z: p[1], links: [] }; NODES.set(k, n); } n.links.push({ ri, end }); } });
  for (const [k, n] of NODES) { const gk = ckey(Math.floor(n.x / 80), Math.floor(n.z / 80)); let l = NG.get(gk); if (!l) { l = []; NG.set(gk, l); } l.push(k); }
  ROADS.forEach((rd, ri) => { for (let k = 0; k < rd.pts.length; k += 3) { const p = rd.pts[k]; const gk = ckey(Math.floor(p[0] / 100), Math.floor(p[1] / 100)); let l = RG.get(gk); if (!l) { l = []; RG.set(gk, l); } l.push([ri, rd.cum[k]]); } });
}
function collide(x, z, r, yFeet, hgt) { let hit = false, nx = 0, nz = 0;
  for (let it = 0; it < 2; it++) { colStamp++;
    for (let i = Math.floor((x - r) / CS); i <= Math.floor((x + r) / CS); i++) for (let j = Math.floor((z - r) / CS); j <= Math.floor((z + r) / CS); j++) { const l = colGrid.get(ckey(i, j)); if (!l) continue;
      for (const id of l) { if (colSeen[id] === colStamp) continue; colSeen[id] = colStamp;
        if (COL.top[id] < yFeet + 0.6 || COL.base[id] > yFeet + hgt) continue; const b = COL.box[id]; if (x + r < b[0] || x - r > b[1] || z + r < b[2] || z - r > b[3]) continue;
        const ring = COL.rings[id]; const inside = pipRing(x, z, ring); let best = 1e18, bx = 0, bz = 0;
        for (let a = 0, c = ring.length - 1; a < ring.length; c = a++) { const ax = ring[c][0], az = ring[c][1], ex = ring[a][0] - ax, ez = ring[a][1] - az; const L2 = ex * ex + ez * ez || 1; let t = ((x - ax) * ex + (z - az) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t; const px = ax + ex * t, pz = az + ez * t; const d2 = (x - px) * (x - px) + (z - pz) * (z - pz); if (d2 < best) { best = d2; bx = px; bz = pz; } }
        const d = Math.sqrt(best) || 1e-4;
        if (inside) { const ux = (bx - x) / d, uz = (bz - z) / d; x = bx + ux * r; z = bz + uz * r; nx = ux; nz = uz; hit = true; }
        else if (d < r) { const ux = (x - bx) / d, uz = (z - bz) / d; x = bx + ux * r; z = bz + uz * r; nx = ux; nz = uz; hit = true; } } } }
  return { x, z, hit, nx, nz }; }
function insideBuilding(x, z, y) { const l = colGrid.get(ckey(Math.floor(x / CS), Math.floor(z / CS))); if (!l) return false; for (const id of l) { if (COL.top[id] < y || COL.base[id] > y) continue; const b = COL.box[id]; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue; if (pipRing(x, z, COL.rings[id])) return true; } return false; }
const BS = 30; const brGrid = new Map();
function surfaceAt(x, z, yRef) { let s = -50; if (isLand(x, z)) s = groundAt(x, z) + 0.28;
  const l = brGrid.get(ckey(Math.floor(x / BS), Math.floor(z / BS)));
  if (l) for (const sg of l) { const ex = sg.x1 - sg.x0, ez = sg.z1 - sg.z0; const L2 = ex * ex + ez * ez || 1; const t = ((x - sg.x0) * ex + (z - sg.z0) * ez) / L2; if (t < -0.02 || t > 1.02) continue;
    const px = sg.x0 + ex * t, pz = sg.z0 + ez * t; if ((x - px) * (x - px) + (z - pz) * (z - pz) > sg.hw * sg.hw) continue; const dy = sg.y0 + (sg.y1 - sg.y0) * clamp(t, 0, 1) + 0.08; if (yRef > dy - 3.2 && dy > s) s = dy; }
  return s; }
const nkey = (x, z) => Math.round(x / 2.5) + '_' + Math.round(z / 2.5);
const NODES = new Map(); const NG = new Map(); const RG = new Map();
function nearestNode(x, z) { let best = null, bd = 1e18; for (let r = 0; r < 6 && !best; r++) for (let i = Math.floor(x / 80) - r; i <= Math.floor(x / 80) + r; i++) for (let j = Math.floor(z / 80) - r; j <= Math.floor(z / 80) + r; j++) { const l = NG.get(ckey(i, j)); if (!l) continue; for (const k of l) { const n = NODES.get(k); const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = k; } } } return best; }
function roadPoint(rd, s) { let lo = 0, hi = rd.cum.length - 1; s = clamp(s, 0, rd.len); while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rd.cum[m] <= s) lo = m; else hi = m; }
  const a = rd.pts[lo], b = rd.pts[hi]; const seg = (rd.cum[hi] - rd.cum[lo]) || 1; const t = (s - rd.cum[lo]) / seg; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, (b[0] - a[0]) / seg, (b[1] - a[1]) / seg]; }
function nearestRoad(x, z, opt) { opt = opt || {}; let best = null, bd = 1e18; for (let r = 0; r < 5; r++) { for (let i = Math.floor(x / 100) - r; i <= Math.floor(x / 100) + r; i++) for (let j = Math.floor(z / 100) - r; j <= Math.floor(z / 100) + r; j++) { const l = RG.get(ckey(i, j)); if (!l) continue;
  for (const [ri, s] of l) { const rd = ROADS[ri]; if (opt.maxCls != null && rd.cls > opt.maxCls) continue; if (opt.minCls != null && rd.cls < opt.minCls) continue; if (opt.noBridge && rd.br) continue; if (opt.bridge && !rd.br) continue; const p = roadPoint(rd, s); const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; best = { ri, s, d: Math.sqrt(d) }; } } } if (best && r >= 1) break; } return best; }
function roadPos(x, z, opt) { const nr = nearestRoad(x, z, opt); if (!nr) return null; const p = roadPoint(ROADS[nr.ri], nr.s); return { x: p[0], z: p[1], y: p[2], dx: p[3], dz: p[4], ri: nr.ri, s: nr.s, hw: ROADS[nr.ri].hw }; }
function astar(sk, gk) { if (!sk || !gk) return null; const goal = NODES.get(gk); const open = [[0, sk]]; const g = new Map([[sk, 0]]); const from = new Map(); const closed = new Set();
  const push = (f, k) => { open.push([f, k]); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const top = open[0]; const last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
  let it = 0; while (open.length && it++ < 60000) { const [, k] = pop(); if (closed.has(k)) continue; if (k === gk) break; closed.add(k); const n = NODES.get(k);
    for (const ln of n.links) { const rd = ROADS[ln.ri]; const nk = ln.end === 0 ? rd.kb : rd.ka; if (closed.has(nk)) continue; const ng = g.get(k) + rd.len; if (ng < (g.has(nk) ? g.get(nk) : 1e18)) { g.set(nk, ng); from.set(nk, { k, ri: ln.ri, rev: ln.end === 1 }); const nn = NODES.get(nk); push(ng + Math.hypot(nn.x - goal.x, nn.z - goal.z), nk); } } }
  if (!from.has(gk)) return null; const path = []; let k = gk; while (k !== sk) { const f = from.get(k); const pts = ROADS[f.ri].pts.map(p => [p[0], p[1]]); if (f.rev) pts.reverse(); path.unshift(pts); k = f.k; } return path.flat(); }
function routeLen(path) { let L = 0; for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); return L; }

/* ---------- street names & parishes (location panel) ---------- */
const STREETS = []; const SG = new Map(); const PARISH = [];
function buildPlaces() {
  for (const s of W.streets) { const pts = decRingOff(s, 1, 1); const id = STREETS.length; STREETS.push({ name: S(s[0]), pts });
    for (let k = 0; k < pts.length; k++) { const gk = ckey(Math.floor(pts[k][0] / 60), Math.floor(pts[k][1] / 60)); let l = SG.get(gk); if (!l) { l = []; SG.set(gk, l); } if (!l.includes(id)) l.push(id); } }
  for (const p of W.parish) { const ring = decRingOff(p, 2, 1); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of ring) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); } PARISH.push({ name: S(p[0]), pt: S(p[1]), ring, box: [x0, x1, z0, z1] }); }
}
function streetAt(x, z) { let best = null, bd = 30 * 30; const i0 = Math.floor(x / 60), j0 = Math.floor(z / 60);
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const l = SG.get(ckey(i, j)); if (!l) continue;
    for (const id of l) { const pts = STREETS[id].pts; for (let k = 0; k < pts.length - 1; k++) { const ax = pts[k][0], az = pts[k][1], ex = pts[k + 1][0] - ax, ez = pts[k + 1][1] - az; const L2 = ex * ex + ez * ez || 1; let t = ((x - ax) * ex + (z - az) * ez) / L2; t = clamp(t, 0, 1); const d = (ax + ex * t - x) ** 2 + (az + ez * t - z) ** 2; if (d < bd) { bd = d; best = STREETS[id].name; } } } }
  return best; }
function parishAt(x, z) { for (const p of PARISH) { const b = p.box; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue; if (pipRing(x, z, p.ring)) return p; }
  if (landClass(x, z) === 2) return { name: z < -1500 ? '珠海' : '橫琴', pt: z < -1500 ? 'Zhuhai' : 'Hengqin' }; return null; }

/* ---------- static map image ---------- */
let MAPC, MPP = 6, MX0, MZ0, MW, MH;
function buildMapCanvas() {
  MX0 = G.x0; MZ0 = G.z0; MW = Math.ceil((GW - 1) * G.step / MPP); MH = Math.ceil((GH - 1) * G.step / MPP);
  MAPC = document.createElement('canvas'); MAPC.width = MW; MAPC.height = MH; const c = MAPC.getContext('2d'); c.fillStyle = '#173B4B'; c.fillRect(0, 0, MW, MH);
  const tp = (x, z) => [(x - MX0) / MPP, (z - MZ0) / MPP];
  const poly = (rings, fill) => { c.beginPath(); for (const r of rings) { r.forEach((p, i) => { const q = tp(p[0], p[1]); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); } c.fillStyle = fill; c.fill('evenodd'); };
  for (const L of landRings) poly(L.rings, L.cls === 1 ? '#D9D4C7' : '#B9B6AD');
  for (const p of D.p) poly(p.slice(1).map(r => decRing(r)), '#A9C48B'); for (const p of D.w) poly(p.slice(1).map(r => decRing(r)), '#5E95AE');
  c.fillStyle = '#BDB7AA'; for (let i = 0; i < D.b.length; i++) { const r = COL.rings[i]; c.beginPath(); r.forEach((p, k) => { const q = tp(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.fill(); }
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const cls of [3, 2, 1, 0]) for (const rd of ROADS) { if (rd.cls !== cls) continue; c.beginPath(); rd.pts.forEach((p, k) => { const q = tp(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.strokeStyle = rd.br ? '#FFFFFF' : cls < 1 ? '#FFE29A' : '#FFFFFF'; c.lineWidth = Math.max(1, RW[cls] / MPP * 1.3); c.stroke(); }
  if (W.lrt) { c.strokeStyle = '#2BB3A6'; c.lineWidth = 2.2; for (const l of W.lrt) { const pts = decRing(l, 2); c.beginPath(); pts.forEach((p, k) => { const q = tp(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); } }
}
