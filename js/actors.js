'use strict';
/* =====================================================================
   actors: player characters, vehicles (incl. scooters), traffic AI that
   obeys the real traffic lights, pedestrians on the pavements, parked
   vehicles.
   ===================================================================== */

/* ---------- characters ---------- */
const CHARS = [
  { name: '阿明', en: 'Ming', desc: '外賣仔，熟悉半島每條橫街窄巷。', skin: '#D6AC86', hair: '#1B1816', style: 'short', shirt: '#2F6FD6', pants: '#2A3038', shoes: '#E9E9E6' },
  { name: '小欣', en: 'Yan', desc: '澳大學生，週末四圍打工儲錢。', skin: '#EBC6A4', hair: '#2A1C16', style: 'long', shirt: '#E8577A', pants: '#33415E', shoes: '#F4F4F2' },
  { name: '阿樂', en: 'Lok', desc: '開咗廿年的士，識晒澳門捷徑。', skin: '#C9976E', hair: '#262626', style: 'cap', shirt: '#F2C14E', pants: '#4A4A4A', shoes: '#2B2B2B' },
  { name: 'Maria', en: 'Maria', desc: '土生葡人，講得一口流利葡文同廣東話。', skin: '#E2B590', hair: '#5A3822', style: 'bun', shirt: '#2E7D5B', pants: '#E6DECB', shoes: '#6B4A33' }
];
const SHIRTS = ['#2F6FD6', '#E8577A', '#F2C14E', '#2E7D5B', '#EDEAE3', '#8E6CC9', '#C0392B', '#1F2A33', '#E58A5B', '#4BA3C3'];
function makeCharacter(def, shirtOverride) {
  const g = new THREE.Group(); const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
  const shirt = M(shirtOverride || def.shirt), skin = M(def.skin), pants = M(def.pants), hair = M(def.hair), shoe = M(def.shoes || '#222');
  const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; };
  const torso = add(new THREE.BoxGeometry(.5, .6, .28), shirt, 0, 1.23, 0);
  add(new THREE.BoxGeometry(.46, .18, .26), pants, 0, .95, 0);
  const neck = add(new THREE.CylinderGeometry(.06, .07, .1, 8), skin, 0, 1.58, 0);
  const head = add(new THREE.SphereGeometry(.165, 16, 12), skin, 0, 1.75, 0); head.scale.set(1, 1.08, 1);
  add(new THREE.BoxGeometry(.05, .03, .02), M('#2a2420'), -.06, 1.79, .155); add(new THREE.BoxGeometry(.05, .03, .02), M('#2a2420'), .06, 1.79, .155);
  if (def.style === 'short') { add(new THREE.SphereGeometry(.172, 14, 10, 0, Math.PI * 2, 0, Math.PI * .5), hair, 0, 1.77, -.01); }
  if (def.style === 'long') { add(new THREE.SphereGeometry(.176, 14, 10, 0, Math.PI * 2, 0, Math.PI * .55), hair, 0, 1.77, 0); add(new THREE.BoxGeometry(.34, .42, .1), hair, 0, 1.56, -.13); }
  if (def.style === 'cap') { add(new THREE.CylinderGeometry(.175, .175, .1, 16), M('#C0392B'), 0, 1.87, 0); add(new THREE.BoxGeometry(.24, .03, .16), M('#C0392B'), 0, 1.83, .18); }
  if (def.style === 'bun') { add(new THREE.SphereGeometry(.172, 14, 10, 0, Math.PI * 2, 0, Math.PI * .5), hair, 0, 1.77, -.01); add(new THREE.SphereGeometry(.08, 10, 8), hair, 0, 1.86, -.16); }
  const limb = (x, y, w, h, d, mat, end, endMat) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); add(new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0), mat, 0, 0, 0, p); if (end) add(end, endMat, 0, -h - .02, .04, p); return p; };
  const legL = limb(-.12, .9, .18, .84, .2, pants, new THREE.BoxGeometry(.19, .09, .28), shoe), legR = limb(.12, .9, .18, .84, .2, pants, new THREE.BoxGeometry(.19, .09, .28), shoe);
  const armL = limb(-.32, 1.5, .12, .58, .14, shirt, new THREE.SphereGeometry(.065, 8, 6), skin), armR = limb(.32, 1.5, .12, .58, .14, shirt, new THREE.SphereGeometry(.065, 8, 6), skin);
  return { group: g, torso, head, legL, legR, armL, armR, shirtMat: shirt, phase: 0 };
}
function animChar(ch, speed, dt, mode) {
  if (mode === 'sit') { ch.legL.rotation.x = ch.legR.rotation.x = -1.35; ch.armL.rotation.x = ch.armR.rotation.x = -1.0; ch.torso.position.y = 1.23; return; }
  if (mode === 'air') { ch.legL.rotation.x = -.5; ch.legR.rotation.x = .3; ch.armL.rotation.x = -2.2; ch.armR.rotation.x = -2.0; return; }
  ch.phase += speed * dt * 1.9; const k = Math.min(1, speed / 4); const sw = Math.sin(ch.phase) * k * (speed > 6 ? .95 : .65);
  ch.legL.rotation.x = sw; ch.legR.rotation.x = -sw; ch.armL.rotation.x = -sw * .85; ch.armR.rotation.x = sw * .85;
  ch.torso.position.y = 1.23 + Math.abs(Math.sin(ch.phase)) * .045 * k; ch.torso.rotation.x = speed > 6 ? .12 : 0;
}

/* ---------- vehicle geometry ---------- */
const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d); const Wheel = r => new THREE.CylinderGeometry(r, r, .26, 14);
const GLASS = '#1F2A31', TYRE = '#1B1C1E', HEAD = '#F6F1D8', TAIL = '#C2271F';
function wheels(len, wid, r) { const o = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) o.push({ g: Wheel(r), r: Math.PI / 2, x: sx * (wid / 2 - 0.08), y: r, z: sz * (len / 2 - 0.85), c: TYRE }); return o; }
const RIDER = (shirt, helmet) => [{ g: Bx(.42, .55, .26), y: 1.28, z: -.15, c: shirt }, { g: new THREE.SphereGeometry(.2, 10, 8), y: 1.72, z: -.1, c: helmet }, { g: Bx(.16, .55, .5), x: -.12, y: .78, z: .05, c: '#2a3038' }, { g: Bx(.16, .55, .5), x: .12, y: .78, z: .05, c: '#2a3038' }, { g: Bx(.1, .5, .12), x: -.26, y: 1.28, z: .15, rx: -.9, c: shirt }, { g: Bx(.1, .5, .12), x: .26, y: 1.28, z: .15, rx: -.9, c: shirt }];
const CARS = {
  sedan: { len: 4.5, wid: 1.8, maxV: 42, acc: 7.5, body: partsGeo([{ g: Bx(1.8, .7, 4.5), y: .62 }, { g: Bx(1.6, .08, 2.1), y: 1.6, z: -.2 }]), trim: partsGeo([{ g: Bx(1.64, .56, 2.3), y: 1.28, z: -.2, c: GLASS }, ...wheels(4.5, 1.8, .34), { g: Bx(.4, .14, .06), x: -.6, y: .78, z: 2.25, c: HEAD }, { g: Bx(.4, .14, .06), x: .6, y: .78, z: 2.25, c: HEAD }, { g: Bx(.4, .14, .06), x: -.62, y: .82, z: -2.25, c: TAIL }, { g: Bx(.4, .14, .06), x: .62, y: .82, z: -2.25, c: TAIL }, { g: Bx(1.5, .16, .06), y: .5, z: 2.26, c: '#888' }]) },
  sport: { len: 4.4, wid: 1.9, maxV: 56, acc: 11, body: partsGeo([{ g: Bx(1.9, .55, 4.4), y: .52 }, { g: Bx(1.6, .06, 1.5), y: 1.22, z: -.35 }]), trim: partsGeo([{ g: Bx(1.66, .45, 1.7), y: 1.0, z: -.3, c: GLASS }, ...wheels(4.4, 1.9, .33), { g: Bx(1.3, .06, .3), y: .92, z: -2.05, c: '#202020' }, { g: Bx(.45, .1, .06), x: -.62, y: .66, z: 2.2, c: HEAD }, { g: Bx(.45, .1, .06), x: .62, y: .66, z: 2.2, c: HEAD }, { g: Bx(1.5, .1, .06), y: .72, z: -2.2, c: TAIL }]) },
  taxi: { len: 4.5, wid: 1.8, maxV: 42, acc: 7.5, body: partsGeo([{ g: Bx(1.8, .7, 4.5), y: .62 }, { g: Bx(1.6, .08, 2.1), y: 1.6, z: -.2 }]), trim: partsGeo([{ g: Bx(1.64, .56, 2.3), y: 1.28, z: -.2, c: GLASS }, ...wheels(4.5, 1.8, .34), { g: Bx(.72, .22, .3), y: 1.75, z: -.1, c: '#F4E7B8' }, { g: Bx(1.82, .12, 4.52), y: .62, c: '#E8D9A6' }, { g: Bx(.4, .14, .06), x: -.6, y: .78, z: 2.25, c: HEAD }, { g: Bx(.4, .14, .06), x: .6, y: .78, z: 2.25, c: HEAD }, { g: Bx(.4, .14, .06), x: -.62, y: .82, z: -2.25, c: TAIL }, { g: Bx(.4, .14, .06), x: .62, y: .82, z: -2.25, c: TAIL }]) },
  van: { len: 4.9, wid: 1.9, maxV: 36, acc: 6, body: partsGeo([{ g: Bx(1.9, 1.55, 4.9), y: 1.02 }]), trim: partsGeo([{ g: Bx(1.94, .5, 3.7), y: 1.5, z: -.35, c: GLASS }, { g: Bx(1.7, .6, .06), y: 1.42, z: 2.46, c: GLASS }, ...wheels(4.9, 1.9, .36), { g: Bx(.36, .16, .06), x: -.65, y: .75, z: 2.46, c: HEAD }, { g: Bx(.36, .16, .06), x: .65, y: .75, z: 2.46, c: HEAD }]) },
  bus: { len: 11, wid: 2.5, maxV: 22, acc: 3.5, body: partsGeo([{ g: Bx(2.5, 2.7, 11), y: 1.75 }]), trim: partsGeo([{ g: Bx(2.54, .95, 9.6), y: 2.25, z: -.3, c: GLASS }, { g: Bx(2.2, 1.3, .06), y: 2.1, z: 5.51, c: GLASS }, { g: Bx(2.52, .3, 11.02), y: .75, c: '#2B6CB3' }, ...[-3.6, 3.6].flatMap(z => [-1, 1].map(sx => ({ g: Wheel(.5), r: Math.PI / 2, x: sx * 1.15, y: .5, z, c: TYRE }))), { g: Bx(1.6, .25, .4), y: 3.18, z: 4.9, c: '#F0A733' }]) },
  scooter: { len: 1.9, wid: .7, maxV: 24, acc: 9, body: partsGeo([{ g: Bx(.56, .5, 1.0), y: .62, z: -.32 }, { g: Bx(.5, .7, .14), y: .78, z: .58 }, { g: Bx(.44, .12, .7), y: .36, z: .15 }]),
    trim: partsGeo([{ g: Bx(.38, .14, .62), y: .94, z: -.3, c: '#1d1d1d' }, { g: Bx(.62, .05, .05), y: 1.18, z: .62, c: '#333' }, { g: new THREE.CylinderGeometry(.03, .03, .55, 6), y: .92, z: .62, c: '#555' }, { g: Wheel(.26), r: Math.PI / 2, y: .26, z: .66, c: TYRE }, { g: Wheel(.26), r: Math.PI / 2, y: .26, z: -.66, c: TYRE }, { g: Bx(.16, .1, .05), y: 1.02, z: .66, c: HEAD }, { g: Bx(.2, .08, .05), y: .72, z: -.84, c: TAIL }]) }
};
CARS.scooterR = { len: 1.9, wid: .7, maxV: 24, acc: 9, body: CARS.scooter.body, trim: partsGeo([{ g: Bx(.38, .14, .62), y: .94, z: -.3, c: '#1d1d1d' }, { g: Wheel(.26), r: Math.PI / 2, y: .26, z: .66, c: TYRE }, { g: Wheel(.26), r: Math.PI / 2, y: .26, z: -.66, c: TYRE }, { g: Bx(.16, .1, .05), y: 1.02, z: .66, c: HEAD }, ...RIDER('#555', '#ddd')]) };
const CAR_COLORS = ['#F2F2EF', '#C9CCCF', '#2A2D30', '#7E8489', '#B22B2B', '#2D4F8C', '#1E2F4D', '#CDBB98', '#F2F2EF', '#3B4E3F'];
const SCOOTER_COLORS = ['#E9E6DF', '#C62828', '#1F3A5F', '#F2C14E', '#2E7D5B', '#9C9C9C', '#E8577A', '#111'];
const bodyMats = new Map(); function bodyMat(hex) { let m = bodyMats.get(hex); if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, roughness: .38, metalness: .35 }); nearFade(m, 2.6); bodyMats.set(hex, m); } return m; }
const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .2 }); nearFade(trimMat, 2.6);
function makeCarMesh(type, hex) { const t = CARS[type]; const g = new THREE.Group(); const b = new THREE.Mesh(t.body, bodyMat(hex)); const tr = new THREE.Mesh(t.trim, trimMat); b.castShadow = tr.castShadow = true; g.add(b, tr); return g; }

/* ---------- traffic ---------- */
const SPD = [15, 12, 9.5, 7]; const LANE = [3.0, 2.4, 2.0, 1.4];
const TRAFFIC = []; const tPools = {};
function buildTraffic() {
  const n = Qual().cars; const POOL = { sedan: Math.round(n * .5), taxi: Math.round(n * .14), van: Math.round(n * .1), bus: Math.max(3, Math.round(n * .06)), scooterR: Math.round(n * .22) };
  for (const type in POOL) { const cnt = POOL[type]; const bm = new THREE.MeshStandardMaterial({ roughness: .4, metalness: .3 }); nearFade(bm, 2.6); const body = new THREE.InstancedMesh(CARS[type].body, bm, cnt); const trim = new THREE.InstancedMesh(CARS[type].trim, trimMat, cnt);
    body.castShadow = trim.castShadow = true; body.frustumCulled = trim.frustumCulled = false; world.add(body, trim); tPools[type] = { body, trim };
    for (let i = 0; i < cnt; i++) { const hex = type === 'taxi' ? '#17191B' : type === 'bus' ? '#EEF1F3' : type === 'scooterR' ? SCOOTER_COLORS[i % SCOOTER_COLORS.length] : CAR_COLORS[i % CAR_COLORS.length]; body.setColorAt(i, C(hex)); TRAFFIC.push({ type, i, alive: false, len: CARS[type].len, wid: CARS[type].wid }); hideInst(TRAFFIC[TRAFFIC.length - 1]); }
    body.instanceColor.needsUpdate = true; }
}
const _o = new THREE.Object3D();
function placeInst(car) { const pool = tPools[car.type]; _o.position.set(car.x, car.y, car.z); _o.rotation.set(0, car.th, car.roll || 0, 'YXZ'); _o.scale.set(1, 1, 1); _o.updateMatrix(); pool.body.setMatrixAt(car.i, _o.matrix); pool.trim.setMatrixAt(car.i, _o.matrix); }
function hideInst(car) { const pool = tPools[car.type]; _o.position.set(0, -200, 0); _o.scale.set(.001, .001, .001); _o.rotation.set(0, 0, 0); _o.updateMatrix(); pool.body.setMatrixAt(car.i, _o.matrix); pool.trim.setMatrixAt(car.i, _o.matrix); }
function spawnTraffic(t, px, pz) { for (let tries = 0; tries < 12; tries++) { const a = rnd() * Math.PI * 2, d = 140 + rnd() * 420; const nr = nearestRoad(px + Math.cos(a) * d, pz + Math.sin(a) * d, { maxCls: t.type === 'bus' ? 1 : 3 }); if (!nr) continue; const rd = ROADS[nr.ri]; if (rd.len < 30) continue;
  if (t.type === 'bus' && rd.cls > 1) continue; t.ri = nr.ri; t.s = nr.s; t.th = null; t.dir = rnd() < .5 ? 1 : -1; t.v = SPD[rd.cls] * .7; t.alive = true; t.wait = 0; t.lane = t.type === 'scooterR' ? .55 : 0; positionTraffic(t); return true; } return false; }
function positionTraffic(t) { const rd = ROADS[t.ri]; const p = roadPoint(rd, t.s); const dx = p[3] * t.dir, dz = p[4] * t.dir; const off = Math.min(rd.hw - .6, LANE[rd.cls] + (t.lane || 0) * 1.6);
  // drive on the LEFT (Macau): left of travel direction (dx,dz) is (dz,-dx)... left-hand normal = (dz, -dx) in x/z with +z south
  t.x = p[0] + dz * off; t.z = p[1] - dx * off;
  t.y = rd.br ? p[2] + 0.05 : surfaceAt(t.x, t.z, p[2] + 1); const th = Math.atan2(dx, dz); let d = th - (t.th == null ? th : t.th); d = Math.atan2(Math.sin(d), Math.cos(d)); t.th = (t.th == null ? th : t.th) + d * 0.25; t.fx = dx; t.fz = dz; placeInst(t); }
function updateTraffic(dt, px, pz, playerCar) {
  for (const t of TRAFFIC) { if (t.reserved) continue; if (!t.alive) { if (rnd() < 0.05) spawnTraffic(t, px, pz); if (!t.alive) continue; }
    if ((t.x - px) ** 2 + (t.z - pz) ** 2 > 820 * 820) { t.alive = false; hideInst(t); continue; }
    const rd = ROADS[t.ri]; let target = SPD[rd.cls] * (t.type === 'bus' ? .8 : t.type === 'scooterR' ? .95 : 1); const rem = t.dir > 0 ? rd.len - t.s : t.s; if (rem < 18) target = Math.min(target, 5 + rem * 0.4);
    const fx = Math.sin(t.th), fz = Math.cos(t.th);
    const ahead = (ox, oz, gap, w) => { const dx = ox - t.x, dz = oz - t.z; const a = dx * fx + dz * fz; if (a <= 0 || a > gap) return; const l = Math.abs(dx * fz - dz * fx); if (l < (w || 2.4)) target = Math.min(target, Math.max(0, (a - t.len * 0.6 - 4) * 0.9)); };
    for (const o of TRAFFIC) if (o !== t && o.alive && Math.abs(o.x - t.x) < 26 && Math.abs(o.z - t.z) < 26) ahead(o.x, o.z, 22, t.type === 'scooterR' ? 1.2 : 2.4);
    ahead(player.x, player.z, 24); for (const p of PEDS) if (p.alive && Math.abs(p.x - t.x) < 16 && Math.abs(p.z - t.z) < 16) ahead(p.x, p.z, 12, 1.6);
    const red = redLightAhead(t.x, t.z, fx, fz, rd.hw); if (red < 30) target = Math.min(target, Math.max(0, (red - 3) * 0.7));
    if (t.wait > 0) { t.wait -= dt; target = 0; }
    t.v += (target > t.v ? 2.8 : -9) * dt; t.v = Math.max(0, Math.min(t.v, Math.max(target, 0) + 0.01));
    t.s += t.dir * t.v * dt;
    if (t.s < 0 || t.s > rd.len) { const key = t.s > rd.len ? rd.kb : rd.ka; const node = NODES.get(key); const opts = node.links.filter(l => l.ri !== t.ri && !(t.type === 'bus' && ROADS[l.ri].cls > 1));
      const ln = opts.length ? opts[(rnd() * opts.length) | 0] : { ri: t.ri, end: t.s > rd.len ? 1 : 0 }; const nr = ROADS[ln.ri]; t.ri = ln.ri; if (ln.end === 0) { t.dir = 1; t.s = 0.5; } else { t.dir = -1; t.s = nr.len - 0.5; } }
    t.roll = t.type === 'scooterR' ? clamp(-(t.lastTh != null ? Math.atan2(Math.sin(t.th - t.lastTh), Math.cos(t.th - t.lastTh)) : 0) / Math.max(dt, .001) * t.v * .02, -.35, .35) : 0; t.lastTh = t.th;
    positionTraffic(t); }
  for (const type in tPools) { tPools[type].body.instanceMatrix.needsUpdate = true; tPools[type].trim.instanceMatrix.needsUpdate = true; }
}

/* ---------- pedestrians ---------- */
const PEDS = []; let pedM = null;
function buildPeds() {
  const n = Qual().peds; const mk = (geo, col, vc) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: col || 0xffffff, roughness: .85 }), n); m.castShadow = true; m.frustumCulled = false; world.add(m); return m; };
  const body = partsGeo([{ g: Bx(.48, .6, .28), y: 1.23 }, { g: Bx(.12, .56, .14), x: -.31, y: 1.22 }, { g: Bx(.12, .56, .14), x: .31, y: 1.22 }]);
  pedM = { body: mk(body), head: mk(new THREE.SphereGeometry(.16, 10, 8).translate(0, 1.74, 0), 0xffffff), hair: mk(new THREE.SphereGeometry(.17, 10, 6, 0, Math.PI * 2, 0, Math.PI * .5).translate(0, 1.77, -.01), 0xffffff),
    legL: mk(Bx(.18, .86, .2).translate(0, -.43, 0), 0xffffff), legR: mk(Bx(.18, .86, .2).translate(0, -.43, 0), 0xffffff) };
  const SK = ['#E8C3A0', '#D6AC86', '#C9976E', '#B0805A', '#F0D2B6'], HR = ['#1B1816', '#2A1C16', '#5A3822', '#3a3a3a', '#8a8a8a'], PT = ['#2A3038', '#33415E', '#4A4A4A', '#6B5A44', '#1E1E1E', '#C8BFAF'];
  for (let i = 0; i < n; i++) { pedM.body.setColorAt(i, C(SHIRTS[(i * 7) % SHIRTS.length])); pedM.head.setColorAt(i, C(SK[i % SK.length])); pedM.hair.setColorAt(i, C(HR[(i * 3) % HR.length])); const pc = C(PT[(i * 5) % PT.length]); pedM.legL.setColorAt(i, pc); pedM.legR.setColorAt(i, pc); PEDS.push({ i, alive: false }); }
  for (const k in pedM) pedM[k].instanceColor.needsUpdate = true;
}
function spawnPed(p, px, pz) { for (let tries = 0; tries < 8; tries++) { const a = rnd() * Math.PI * 2, d = 30 + rnd() * 200; const nr = nearestRoad(px + Math.cos(a) * d, pz + Math.sin(a) * d, { noBridge: true }); if (!nr) continue; const rd = ROADS[nr.ri]; if (rd.cls === 0 || rd.len < 20) continue;
  p.ri = nr.ri; p.s = nr.s; p.dir = rnd() < .5 ? 1 : -1; p.side = rnd() < .5 ? 1 : -1; p.v = 1.1 + rnd() * .6; p.alive = true; p.dodge = 0; p.ph = rnd() * 6; p.x = p.z = null; return; } }
function hidePed(i) { _o.position.set(0, -200, 0); _o.scale.set(.001, .001, .001); _o.rotation.set(0, 0, 0); _o.updateMatrix(); for (const k in pedM) pedM[k].setMatrixAt(i, _o.matrix); }
function updatePeds(dt, px, pz, carObj) {
  for (const p of PEDS) {
    if (!p.alive) { if (rnd() < .08) spawnPed(p, px, pz); if (!p.alive) { hidePed(p.i); continue; } }
    if (p.x != null && (p.x - px) ** 2 + (p.z - pz) ** 2 > 320 * 320) { p.alive = false; continue; }
    const rd = ROADS[p.ri]; p.s += p.dir * p.v * dt;
    if (p.s < 0 || p.s > rd.len) { const key = p.s > rd.len ? rd.kb : rd.ka; const node = NODES.get(key); const opts = node.links.filter(l => l.ri !== p.ri && ROADS[l.ri].cls > 0 && !ROADS[l.ri].br);
      if (!opts.length) { p.dir *= -1; p.s = clamp(p.s, 0, rd.len); } else { const ln = opts[(rnd() * opts.length) | 0]; p.ri = ln.ri; const nr = ROADS[ln.ri]; if (ln.end === 0) { p.dir = 1; p.s = .3; } else { p.dir = -1; p.s = nr.len - .3; } } }
    const r2 = ROADS[p.ri]; const q = roadPoint(r2, p.s); const sw = r2.cls === 3 ? 1.8 : 2.6; const off = (r2.hw + sw * .55) * p.side + p.dodge * p.side; let x = q[0] - q[4] * off, z = q[1] + q[3] * off;
    if (carObj) { const dx = x - carObj.x, dz = z - carObj.z; if (dx * dx + dz * dz < 36 && Math.hypot(carObj.vx, carObj.vz) > 2) p.dodge = Math.min(3.5, p.dodge + dt * 12); }
    p.dodge = Math.max(0, p.dodge - dt * 0.8);
    if (!carObj) { const dx = x - px, dz = z - pz; if (dx * dx + dz * dz < 0.6) p.dodge = Math.min(2, p.dodge + dt * 4); }
    const th = Math.atan2(q[3] * p.dir, q[4] * p.dir); p.x = x; p.z = z; p.ph += dt * p.v * 3.2; const y = surfaceAt(x, z, 99) - .02 + Math.abs(Math.sin(p.ph)) * 0.035;
    _o.position.set(x, y, z); _o.rotation.set(0, th, 0); _o.scale.set(1, 1, 1); _o.updateMatrix(); pedM.body.setMatrixAt(p.i, _o.matrix); pedM.head.setMatrixAt(p.i, _o.matrix); pedM.hair.setMatrixAt(p.i, _o.matrix);
    const sw2 = Math.sin(p.ph) * .55; const cs = Math.cos(th), sn = Math.sin(th);
    for (const [m, side, a] of [[pedM.legL, -1, sw2], [pedM.legR, 1, -sw2]]) { _o.position.set(x + cs * .11 * side, y + .9, z - sn * .11 * side); _o.rotation.set(a, th, 0, 'YXZ'); _o.updateMatrix(); m.setMatrixAt(p.i, _o.matrix); } }
  for (const k in pedM) pedM[k].instanceMatrix.needsUpdate = true;
}

/* ---------- parked vehicles ---------- */
const PARKED = [];
function addParked(type, hex, x, z, th, keep) { const g = makeCarMesh(type, hex); const y = surfaceAt(x, z, 99); g.position.set(x, y, z); g.rotation.y = th; world.add(g); const c = { type, hex, x, z, y, th, mesh: g, keep: !!keep }; PARKED.push(c); return c; }
function spawnParkedAround(cx, cz, n) { let tries = 0; while (n > 0 && tries < 220) { tries++; const ang = rnd() * Math.PI * 2, dist = 50 + rnd() * 420; const nr = nearestRoad(cx + Math.cos(ang) * dist, cz + Math.sin(ang) * dist, { noBridge: true }); if (!nr) continue;
  const rd = ROADS[nr.ri]; if (rd.cls < 2) continue; const p = roadPoint(rd, nr.s); const lx = -p[4], lz = p[3]; const side = rnd() < .5 ? 1 : -1;
  const scooterRow = rnd() < .42;
  if (scooterRow) { const k = 3 + (rnd() * 4 | 0); const off = rd.hw + .55; for (let j = 0; j < k; j++) { const s2 = nr.s + (j - k / 2) * .95; if (s2 < 1 || s2 > rd.len - 1) continue; const q = roadPoint(rd, s2); const x = q[0] + lx * off * side, z = q[1] + lz * off * side;
      if (collide(x, z, .5, groundAt(x, z), 2).hit || !isLand(x, z)) continue; addParked('scooter', SCOOTER_COLORS[(rnd() * SCOOTER_COLORS.length) | 0], x, z, Math.atan2(lx * side, lz * side) + (rnd() - .5) * .3); } n--; continue; }
  const off = rd.hw - 1.1; const x = p[0] + lx * off * side, z = p[1] + lz * off * side;
  if (collide(x, z, 2.4, groundAt(x, z), 2).hit || !isLand(x, z)) continue; if (PARKED.some(c => (c.x - x) ** 2 + (c.z - z) ** 2 < 64)) continue;
  const type = rnd() < .12 ? 'van' : rnd() < .2 ? 'taxi' : 'sedan'; addParked(type, type === 'taxi' ? '#17191B' : CAR_COLORS[(rnd() * CAR_COLORS.length) | 0], x, z, Math.atan2(p[3], p[4]) + (side > 0 ? 0 : Math.PI)); n--; } }
function recycleParked(cx, cz) { for (let i = PARKED.length - 1; i >= 0; i--) { const c = PARKED[i]; if (!c.keep && (c.x - cx) ** 2 + (c.z - cz) ** 2 > 700 * 700) { world.remove(c.mesh); PARKED.splice(i, 1); } } const want = 30; if (PARKED.length < want) spawnParkedAround(cx, cz, want - PARKED.length); }

/* ---------- player ---------- */
const player = { x: 0, y: 10, z: 0, vy: 0, th: 0, grounded: false, mode: 'foot', car: null, safe: null, lastSafeT: 0, stamina: 100, boost: 0, ch: null };
let headlight, hlTarget;
function buildPlayer() {
  setCharacter(save.char || 0);
  headlight = new THREE.SpotLight(0xfff1cc, 0, 90, 0.55, 0.5, 1.2); hlTarget = new THREE.Object3D(); scene.add(headlight, hlTarget); headlight.target = hlTarget;
}
function setCharacter(i) { if (player.ch) world.remove(player.ch.group); save.char = i; const def = CHARS[i]; player.ch = makeCharacter(def, save.outfit && save.outfit[i]); world.add(player.ch.group); player.ch.group.visible = player.mode === 'foot' || (player.car && player.car.type === 'scooter'); }
function enterVehicle(pc) { PARKED.splice(PARKED.indexOf(pc), 1); const t = CARS[pc.type];
  player.car = { type: pc.type, hex: pc.hex, mesh: pc.mesh, x: pc.x, z: pc.z, y: pc.y, th: pc.th, vx: 0, vz: 0, vy: 0, air: false, steer: 0, pitch: 0, roll: 0, len: t.len, wid: t.wid, keep: pc.keep, job: pc.job };
  player.mode = 'car'; player.ch.group.visible = pc.type === 'scooter'; headlight.intensity = ENV.night > .5 ? 2.6 : 0; }
function exitVehicle() { const c = player.car; const rx = Math.cos(c.th), rz = -Math.sin(c.th); let ex = c.x - rx * (c.wid / 2 + .9), ez = c.z - rz * (c.wid / 2 + .9); const r = collide(ex, ez, .45, c.y, 1.8); ex = r.x; ez = r.z;
  const pc = { type: c.type, hex: c.hex, mesh: c.mesh, x: c.x, z: c.z, y: c.y, th: c.th, keep: c.keep, job: c.job }; c.mesh.rotation.set(0, c.th, 0); PARKED.push(pc);
  player.car = null; player.mode = 'foot'; player.ch.group.visible = true; player.x = ex; player.z = ez; player.y = surfaceAt(ex, ez, c.y + 1); player.vy = 0; headlight.intensity = 0; return pc; }
function spawnVehicleNear(type, hex, x, z, keep) { const rp = roadPos(x, z, { noBridge: true }); if (!rp) return null; const lx = rp.dz, lz = -rp.dx; const off = type === 'scooter' ? rp.hw + .5 : rp.hw - 1.1; const vx = rp.x + lx * off, vz = rp.z + lz * off;
  return addParked(type, hex, vx, vz, Math.atan2(rp.dx, rp.dz), keep); }
