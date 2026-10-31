'use strict';
/* =====================================================================
   streets (v2.6): finer street modeling on the existing city outline.
   - carriageways sit a kerb's height below the pavement (raised sidewalks
     with granite kerb faces); pavements are cut where they would cross
     another road
   - junction-aware markings: lane lines stop before junctions, zebra
     crossings and stop lines (left-hand traffic), yellow kerb lines,
     drains, manholes, worn asphalt and patch repairs
   - pavement styles: Portuguese calçada in the historic centres, red brick
     elsewhere; calçada wave plazas (Senado Square, St Paul's, Barra)
   - pedestrian railings at crossings on main roads
   - azulejo-style street name plates (Chinese + Portuguese) on corner walls
   ===================================================================== */
const MASK = { a: null, x0: 0, z0: 0, w: 0, h: 0, cs: 2 };
function maskSet(i, j) { const k = j * MASK.w + i; MASK.a[k >> 3] |= 1 << (k & 7); }
function onRoad(x, z) { if (!MASK.a) return false; const i = Math.floor((x - MASK.x0) / MASK.cs), j = Math.floor((z - MASK.z0) / MASK.cs); if (i < 0 || j < 0 || i >= MASK.w || j >= MASK.h) return false; const k = j * MASK.w + i; return (MASK.a[k >> 3] >> (k & 7) & 1) === 1; }
const KERB = .13; // kerb height: carriageways sit this much below pavements
const STREETS3D = { junctions: [] };

function buildStreets() {
  // ---- 1. carriageway mask (non-bridge roads) ----
  MASK.x0 = G.x0; MASK.z0 = G.z0; MASK.w = Math.ceil((GW - 1) * G.step / MASK.cs) + 1; MASK.h = Math.ceil((GH - 1) * G.step / MASK.cs) + 1; MASK.a = new Uint8Array(Math.ceil(MASK.w * MASK.h / 8));
  for (const rd of ROADS) { if (rd.br) continue; const hw = rd.hw;
    for (let k = 0; k < rd.pts.length - 1; k++) { const a = rd.pts[k], b = rd.pts[k + 1]; const ex = b[0] - a[0], ez = b[1] - a[1]; const L2 = ex * ex + ez * ez || 1;
      const i0 = Math.floor((Math.min(a[0], b[0]) - hw - MASK.x0) / MASK.cs), i1 = Math.floor((Math.max(a[0], b[0]) + hw - MASK.x0) / MASK.cs), j0 = Math.floor((Math.min(a[1], b[1]) - hw - MASK.z0) / MASK.cs), j1 = Math.floor((Math.max(a[1], b[1]) + hw - MASK.z0) / MASK.cs);
      for (let j = Math.max(0, j0); j <= Math.min(MASK.h - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(MASK.w - 1, i1); i++) { const x = MASK.x0 + (i + .5) * MASK.cs, z = MASK.z0 + (j + .5) * MASK.cs;
        let t = ((x - a[0]) * ex + (z - a[1]) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t; const dx = x - a[0] - ex * t, dz = z - a[1] - ez * t; if (dx * dx + dz * dz <= (hw - .4) * (hw - .4)) maskSet(i, j); } } }
  // ---- 2. junctions: vertices where three or more road arms meet ----
  const occ = new Map(); const K = p => Math.round(p[0] * 2) + '_' + Math.round(p[1] * 2);
  ROADS.forEach((rd, ri) => { if (rd.br) return; rd.pts.forEach((p, i) => { const k = K(p); let o = occ.get(k); if (!o) { o = { x: p[0], z: p[1], arms: 0, hw: [], roads: [] }; occ.set(k, o); } o.arms += (i === 0 || i === rd.pts.length - 1) ? 1 : 2; o.hw.push(rd.hw); o.roads.push([ri, i]); }); });
  const J = []; for (const o of occ.values()) if (o.arms >= 3 && o.roads.length >= 2) J.push(o);
  STREETS3D.junctions = J;
  const jByRoad = new Map(); for (const o of J) for (const [ri, i] of o.roads) { let l = jByRoad.get(ri); if (!l) { l = []; jByRoad.set(ri, l); } l.push({ i, r: Math.max(...o.hw.filter((h, k) => o.roads[k][0] !== ri), 0) + .6 }); }
  // ---- 3. meshes: carriageway, pavements, kerbs ----
  const P = [], N = [], Cc = [], R = [], Jd = []; const SP = [], SN = [], SR = []; const RAIL = [];
  const hist = [PL('senado'), PL('stpaul'), PL('cunha'), PL('chapel'), PL('ama')].filter(Boolean); const histR = [900, 500, 420, 350, 350];
  const zone = (x, z) => { for (let i = 0; i < hist.length; i++) if (Math.hypot(hist[i].x - x, hist[i].z - z) < histR[i]) return 31; return hsh(Math.floor(x / 300) * 7 + Math.floor(z / 300) * 13) < .55 ? 32 : 30; };
  const push = (x, y, z, c, u, v, f, jd, jdir) => { P.push(x, y, z); N.push(0, 1, 0); Cc.push(c, c, c); R.push(u, v, f); Jd.push(jd, jdir); };
  const spush = (x, y, z, nx, ny, nz, u, v, f) => { SP.push(x, y, z); SN.push(nx, ny, nz); SR.push(u, v, f); };
  ROADS.forEach((rd, ri) => { if (rd.br) return; const pts = rd.pts, hw = rd.hw, cls = rd.cls, U = rd.cum; const n = pts.length;
    // distance along the road to the nearest junction, beyond the crossing road's half-width; and which way it lies
    const js = jByRoad.get(ri) || []; const JD = [], JS = [];
    for (let k = 0; k < n; k++) { let bd = 1e4, sg = 0; for (const j of js) { const d = Math.abs(U[k] - U[j.i]) - j.r; if (d < bd) { bd = d; sg = U[j.i] >= U[k] ? 1 : -1; } } JD.push(bd); JS.push(sg); }
    // ends of a dead-end lane get no junction markings
    const NR = []; for (let k = 0; k < n; k++) { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; NR.push([-dz / l, dx / l]); }
    const yR = k => pts[k][2] - KERB - .01;
    for (let k = 0; k < n - 1; k++) { const a = pts[k], b = pts[k + 1], na = NR[k], nb = NR[k + 1];
      const l0 = [a[0] + na[0] * hw, a[1] + na[1] * hw], r0 = [a[0] - na[0] * hw, a[1] - na[1] * hw], l1 = [b[0] + nb[0] * hw, b[1] + nb[1] * hw], r1 = [b[0] - nb[0] * hw, b[1] - nb[1] * hw];
      const f = cls; push(l0[0], yR(k), l0[1], 1, U[k], 1, f, JD[k], JS[k]); push(l1[0], yR(k + 1), l1[1], 1, U[k + 1], 1, f, JD[k + 1], JS[k + 1]); push(r0[0], yR(k), r0[1], 1, U[k], -1, f, JD[k], JS[k]);
      push(r0[0], yR(k), r0[1], 1, U[k], -1, f, JD[k], JS[k]); push(l1[0], yR(k + 1), l1[1], 1, U[k + 1], 1, f, JD[k + 1], JS[k + 1]); push(r1[0], yR(k + 1), r1[1], 1, U[k + 1], -1, f, JD[k + 1], JS[k + 1]);
      // pavements + kerb faces (not on expressways), cut where they would land on another carriageway
      if (cls >= 1) { const sw = cls === 3 ? 1.6 : 2.8; const zc = zone((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); const segL = U[k + 1] - U[k]; const steps = Math.max(1, Math.ceil(segL / 4));
        for (const s of [1, -1]) { const keep = [];
          const at = t => { const Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], nt = [na[0] + (nb[0] - na[0]) * t, na[1] + (nb[1] - na[1]) * t]; return { P: Pt, n: nt, y: a[2] + (b[2] - a[2]) * t - .02, u: U[k] + segL * t }; };
          for (let q = 0; q < steps; q++) { const m = at((q + .5) / steps); const mx = m.P[0] + m.n[0] * (hw + sw * .5) * s, mz = m.P[1] + m.n[1] * (hw + sw * .5) * s; keep.push(!onRoad(mx, mz) && isLand(mx, mz));
            if (keep[q] && cls <= 1) { const jd = JD[k] + (JD[k + 1] - JD[k]) * (q + .5) / steps; if (jd > 5 && jd < 22) { const e0 = at(q / steps), e1 = at((q + 1) / steps);
              RAIL.push([(e0.P[0] + e1.P[0]) / 2 + m.n[0] * (hw + .25) * s, (e0.y + e1.y) / 2, (e0.P[1] + e1.P[1]) / 2 + m.n[1] * (hw + .25) * s, Math.atan2(e1.P[0] - e0.P[0], e1.P[1] - e0.P[1]), Math.hypot(e1.P[0] - e0.P[0], e1.P[1] - e0.P[1])]); } } }
          for (let q = 0; q < steps;) { if (!keep[q]) { q++; continue; } let q2 = q; while (q2 < steps && keep[q2]) q2++;
            const e0 = at(q / steps), e1 = at(q2 / steps); q = q2;
            const A0 = [e0.P[0] + e0.n[0] * hw * s, e0.P[1] + e0.n[1] * hw * s], B0 = [e0.P[0] + e0.n[0] * (hw + sw) * s, e0.P[1] + e0.n[1] * (hw + sw) * s], A1 = [e1.P[0] + e1.n[0] * hw * s, e1.P[1] + e1.n[1] * hw * s], B1 = [e1.P[0] + e1.n[0] * (hw + sw) * s, e1.P[1] + e1.n[1] * (hw + sw) * s];
            spush(A0[0], e0.y, A0[1], 0, 1, 0, e0.u, 0, zc); spush(A1[0], e1.y, A1[1], 0, 1, 0, e1.u, 0, zc); spush(B0[0], e0.y, B0[1], 0, 1, 0, e0.u, sw, zc);
            spush(B0[0], e0.y, B0[1], 0, 1, 0, e0.u, sw, zc); spush(A1[0], e1.y, A1[1], 0, 1, 0, e1.u, 0, zc); spush(B1[0], e1.y, B1[1], 0, 1, 0, e1.u, sw, zc);
            const nx = -e0.n[0] * s, nz = -e0.n[1] * s; const k0 = e0.y - KERB - .01, k1 = e1.y - KERB - .01;
            spush(A0[0], e0.y, A0[1], nx, 0, nz, e0.u, 0, 33); spush(A0[0], k0, A0[1], nx, 0, nz, e0.u, .2, 33); spush(A1[0], e1.y, A1[1], nx, 0, nz, e1.u, 0, 33);
            spush(A1[0], e1.y, A1[1], nx, 0, nz, e1.u, 0, 33); spush(A0[0], k0, A0[1], nx, 0, nz, e0.u, .2, 33); spush(A1[0], k1, A1[1], nx, 0, nz, e1.u, .2, 33); } } } }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('ruv', new THREE.Float32BufferAttribute(R, 3)); g.setAttribute('rj', new THREE.Float32BufferAttribute(Jd, 2));
  const rm = new THREE.Mesh(g, MAT.road); rm.receiveShadow = true; world.add(rm);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(SP, 3)); sg.setAttribute('normal', new THREE.Float32BufferAttribute(SN, 3)); sg.setAttribute('ruv', new THREE.Float32BufferAttribute(SR, 3)); sg.setAttribute('rj', new THREE.Float32BufferAttribute(new Float32Array(SP.length / 3 * 2).fill(1e4), 2));
  const sm = new THREE.Mesh(sg, MAT.side); sm.receiveShadow = true; world.add(sm);
  // railings: posts + two rails, one instance per pavement step
  if (RAIL.length) { const geo = partsGeo([{ g: new THREE.BoxGeometry(.06, 1.0, .06), y: .5, z: -.5 }, { g: new THREE.BoxGeometry(.05, .05, 1.02), y: .95 }, { g: new THREE.BoxGeometry(.04, .04, 1.02), y: .45 }]);
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x8A9792, roughness: .5, metalness: .5 }), RAIL.length); const o = new THREE.Object3D();
    RAIL.forEach((r, i) => { o.position.set(r[0], r[1], r[2]); o.rotation.set(0, r[3], 0); o.scale.set(1, 1, r[4]); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); m.frustumCulled = false; m.castShadow = true; world.add(m); }
}

/* ---------- calçada plazas: flood the open space around the real squares ---------- */
function buildPlazas() {
  // seeds at the real squares; the open (non-road, non-building) area around each is flood-filled and the largest region kept
  const seeds = [[22.19343, 113.53993, 120], [22.19715, 113.54085, 60], [22.18625, 113.53105, 55]]; const cs = 1.5; const P = [], R = [], BOL = [];
  for (const [la, lo, rad] of seeds) { const [cx, cz] = toXZ(lo, la); const n = Math.ceil(rad * 2 / cs); const seen = new Uint8Array(n * n); const ox = cx - rad, oz = cz - rad;
    const free = (i, j) => { const x = ox + (i + .5) * cs, z = oz + (j + .5) * cs; if (Math.hypot(x - cx, z - cz) > rad) return false; if (onRoad(x, z) || !isLand(x, z)) return false; return !insideBuilding(x, z, groundAt(x, z) + 1); };
    const cand = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const d = Math.hypot(ox + (i + .5) * cs - cx, oz + (j + .5) * cs - cz); if (d < 35) cand.push([d, i, j]); } cand.sort((a, b) => a[0] - b[0]);
    let best = []; let tries = 0;
    for (const [, si, sj] of cand) { if (tries > 8 || best.length > 400) break; if (seen[sj * n + si] || !free(si, sj)) continue; tries++;
      const st = [[si, sj]], reg = []; seen[sj * n + si] = 1;
      while (st.length && reg.length < 20000) { const [i, j] = st.pop(); reg.push([i, j]); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n || seen[b * n + a]) continue; seen[b * n + a] = 1; if (free(a, b)) st.push([a, b]); } }
      if (reg.length > best.length) best = reg; }
    // black bollards where the square meets the road
    const inReg = new Set(best.map(([i, j]) => j * n + i)); for (const [i, j] of best) { if ((i + j) % 2) continue; const x = ox + (i + .5) * cs, z = oz + (j + .5) * cs; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => !inReg.has((j + dj) * n + i + di) && onRoad(x + di * cs, z + dj * cs))) BOL.push([x, groundAt(x, z) + .29, z]); }
    for (const [i, j] of best) { const x = ox + i * cs, z = oz + j * cs; const y = groundAt(x + cs / 2, z + cs / 2) + .29;
      for (const q of [[x, z], [x, z + cs], [x + cs, z], [x + cs, z], [x, z + cs], [x + cs, z + cs]]) { P.push(q[0], y, q[1]); R.push(q[0], q[1], 34); } } }
  if (!P.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(P.length).map((_, i) => i % 3 === 1 ? 1 : 0), 3)); g.setAttribute('ruv', new THREE.Float32BufferAttribute(R, 3)); g.setAttribute('rj', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3 * 2).fill(1e4), 2));
  const mat = MAT.side.clone(); mat.onBeforeCompile = roadShader; mat.polygonOffsetFactor = -2.5; mat.polygonOffsetUnits = -2.5; mat.side = THREE.DoubleSide; const m = new THREE.Mesh(g, mat); m.receiveShadow = true; world.add(m); MAT.plaza = mat; MAT.plazaCells = P.length / 18;
  if (BOL.length) { const bm = new THREE.InstancedMesh(partsGeo([{ g: new THREE.CylinderGeometry(.09, .11, .85, 8), y: .42 }, { g: new THREE.SphereGeometry(.11, 8, 6), y: .88 }]), new THREE.MeshStandardMaterial({ color: 0x1d2022, roughness: .5, metalness: .5 }), BOL.length); const o = new THREE.Object3D();
    BOL.forEach((b, i) => { o.position.set(b[0], b[1], b[2]); o.updateMatrix(); bm.setMatrixAt(i, o.matrix); }); bm.frustumCulled = false; bm.castShadow = true; world.add(bm); }
}

/* ---------- azulejo street name plates ---------- */
function addStreetSigns() { if (!W.ssigns) return; for (const s of W.ssigns) { const r = { x: s[0], z: s[1], y: s[2], ang: s[3], w: 1.36, h: .44, kind: 5, text: S(s[4]), text2: S(s[5]), bg: 0xF6F6F1, fg: 0x1F4E9C, maxD: 70 };
    SIGNS.recs.push(r); const gk = ckey(Math.floor(r.x / 100), Math.floor(r.z / 100)); let l = SIGNS.grid.get(gk); if (!l) { l = []; SIGNS.grid.set(gk, l); } l.push(r); } }
function drawAzulejo(c, r) { c.fillStyle = '#F6F6F1'; c.fillRect(0, 0, 256, 64); c.strokeStyle = 'rgba(31,78,156,.12)'; c.lineWidth = 1; for (let x = 32; x < 256; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 64); c.stroke(); } c.beginPath(); c.moveTo(0, 32); c.lineTo(256, 32); c.stroke();
  c.strokeStyle = '#1F4E9C'; c.lineWidth = 4; c.strokeRect(3, 3, 250, 58); c.lineWidth = 1.5; c.strokeRect(8, 8, 240, 48);
  c.fillStyle = '#1F4E9C'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitFont(c, r.text, 220, 22, '700', SIGN_FONT); c.fillText(r.text, 128, 22); fitFont(c, r.text2 || '', 226, 14, '600', '"Times New Roman",Georgia,serif'); c.fillText(r.text2 || '', 128, 44); }
