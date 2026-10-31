'use strict';
/* =====================================================================
   main: boot sequence, input (keyboard / on-screen buttons), on-foot and
   vehicle physics, camera, photo mode and the frame loop.
   ===================================================================== */
const GAME = { started: false, time: save.time, clock: 0, photo: false, shot: false, frame: 0 };
const TIME_RATE = 0.5; // game minutes per real second (a full day ≈ 48 minutes)
const keys = new Set(); const joy = { x: 0, y: 0 };
const cam = { yaw: 0, pitch: .3, dist: 6.5, distCar: 12, auto: 0 };
const camTgt = new THREE.Vector3(), camPos = new THREE.Vector3();

/* ---------- boot ---------- */
async function boot() {
  try {
    initRenderer(); UI.init(); applyControls(); UI.money(0);
    progress('下載城市模型', 0);
    D = await loadJSON('macau-data.json', 0, .42, '下載城市模型');
    W = await loadJSON('macau-world.json', .42, .52, '下載商舖同街道');
    Q = D.q; BASE = D.base; G = D.grid; GW = G.w; GH = G.h; HG = new Float32Array(GW * GH);
    { const raw = atob(G.data); for (let i = 0; i < GW * GH; i++) { const v = raw.charCodeAt(2 * i) | (raw.charCodeAt(2 * i + 1) << 8); HG[i] = v === 65535 ? -1 : v / 10; } }
    const steps = [['地形同海岸線', buildLand], ['道路', buildRoads], ['行人路、斑馬線同路緣', buildStreets], ['立面材質', makeFacadeMat], ['建築物同舖面', buildBuildings], ['重點地標', buildLandmarks], ['樹木', buildTrees], ['碰撞同路網', buildIndices], ['葡式碎石廣場', buildPlazas],
      ['街道同堂區', buildPlaces], ['地圖', buildMapCanvas], ['真實商舖', buildShops], ['招牌同大廈名牌', buildSigns], ['街道名牌', addStreetSigns], ['交通燈', buildLights], ['巴士站', buildStops], ['路燈', buildLamps], ['輕軌', buildLRT], ['葡撻', buildTarts],
      ['天氣', buildRain], ['車流', buildTraffic], ['行人', buildPeds], ['天空同路燈光暈', EX.build], ['街景細節', LIFE.build], ['地標燈光同任務角色', LIFE.buildMore], ['街貓同煙花', FUN.build], ['角色', buildPlayer], ['任務', buildMarkers]];
    for (let i = 0; i < steps.length; i++) { progress('建造' + steps[i][0], .52 + .46 * i / steps.length); await tick0(); await steps[i][1](); }
    ENV.weather = '晴'; ENV.nextWeather = 300 + Math.random() * 300; player.stamina = save.stamina != null ? save.stamina : 100;
    spawnHome(); spawnParkedAround(player.x, player.z, 26);
    updateEnv(0, GAME.time, player); updateSigns(player.x, player.z, true);
    progress('準備就緒', 1); const go = $('go'); go.disabled = false; go.addEventListener('click', startGame);
    if (new URLSearchParams(location.search).has('autostart')) startGame();
  } catch (e) { console.error(e); fail('載入失敗：' + (e && e.message ? e.message : e) + '。請重新整理頁面再試。'); }
}
function startGame() {
  if (GAME.started) return; GAME.started = true; AUDIO.init(); $('start').hidden = true; $('hud').hidden = false; applyControls(); requestLock();
  cam.yaw = player.th + Math.PI; camera.position.set(player.x + Math.sin(cam.yaw) * 6, player.y + 3, player.z + Math.cos(cam.yaw) * 6);
  if (!save.intro) { save.intro = true; persist(); setTimeout(() => UI.say('陳伯', '後生仔，終於到咗！我喺你身邊，行過嚟紅色「主」標記度，' + (save.ctl === 'touch' ? '按「互動」' : '按 E') + '同我傾吓。', null), 600); }
  else UI.toast('歡迎返嚟濠江', '完成度 ' + completion().pct + '% · 打開手機（' + (save.ctl === 'touch' ? '「手機」' : 'T') + '）睇任務同打工。', 5);
}
function applyControls() { const t = save.ctl === 'touch'; document.body.classList.toggle('touch', t); $('touch').hidden = !t || !GAME.started; if (t) releaseLock(); updateLockHint(); }
/* ---------- mouse look (pointer lock) for keyboard players ---------- */
const lockWanted = () => save.ctl === 'keys' && (save.mouseLook || 'lock') === 'lock' && GAME.started && !UI.dlgOpen && !UI.mapOpen && !UI.phoneOpen;
const isLocked = () => !!renderer && document.pointerLockElement === renderer.domElement;
function requestLock() { if (!renderer || !lockWanted() || isLocked() || !renderer.domElement.requestPointerLock) return; try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
function releaseLock() { if (isLocked()) { GAME.selfUnlock = true; document.exitPointerLock(); } }
function updateLockHint() { const el = $('lockhint'); if (el) el.hidden = isLocked() || !lockWanted() || isTouchDevice; }
document.addEventListener('pointerlockchange', () => { const locked = isLocked(); if (!locked && GAME.started && !GAME.selfUnlock && lockWanted()) { GAME.unlockT = performance.now(); UI.pause(); } GAME.selfUnlock = false; keys.clear(); updateLockHint(); });
document.addEventListener('mousemove', e => { if (!isLocked()) return; const k = save.mouseSens || 1; cam.yaw -= e.movementX * .0024 * k; cam.pitch = clamp(cam.pitch + e.movementY * .0018 * k, -.15, 1.3); cam.auto = 1.6; });

/* ---------- spawning & teleport ---------- */
function sidewalkNear(x, z, extra) { const r = roadPos(x, z, { noBridge: true }); if (!r) return { x, z, th: 0 }; const nx = r.dz, nz = -r.dx; const sd = ((x - r.x) * nx + (z - r.z) * nz) >= 0 ? 1 : -1; return { x: r.x + nx * (r.hw + (extra || 2.2)) * sd, z: r.z + nz * (r.hw + (extra || 2.2)) * sd, th: Math.atan2(-nx * sd, -nz * sd) }; }
function spawnHome() { const p = PL('start'); if (player.mode === 'car') exitVehicle(); const r = roadPos(p.x, p.z, { noBridge: true }); const mp = missionStartPos(MISSIONS[0]);
  const s = sidewalkNear(p.x - (r ? r.dx : 0) * 13, p.z - (r ? r.dz : 0) * 13);
  player.x = s.x; player.z = s.z; player.y = surfaceAt(s.x, s.z, 99); player.vy = 0; player.th = Math.atan2(mp.x - s.x, mp.z - s.z); player.safe = { x: player.x, z: player.z }; cam.yaw = player.th + Math.PI; recycleParked(player.x, player.z); }
function teleport(x, z) { if (player.mode === 'car') exitVehicle(); const s = sidewalkNear(x, z, 1.8); player.x = s.x; player.z = s.z; player.y = surfaceAt(s.x, s.z, 99); player.vy = 0; player.safe = { x: player.x, z: player.z }; cam.yaw = s.th + Math.PI;
  for (let i = PARKED.length - 1; i >= 0; i--) if (!PARKED[i].keep) { world.remove(PARKED[i].mesh); PARKED.splice(i, 1); } spawnParkedAround(player.x, player.z, 26); for (const t of TRAFFIC) if (!t.reserved) { t.alive = false; hideInst(t); } for (const p of PEDS) p.alive = false; updateSigns(player.x, player.z, true); }
function unstuck() { const nr = nearestRoad(player.x, player.z, {}); if (!nr) { spawnHome(); return; } const rd = ROADS[nr.ri]; const p = roadPoint(rd, nr.s);
  if (player.mode === 'car') { const c = player.car; c.x = p[0] + p[4] * LANE[rd.cls]; c.z = p[1] - p[3] * LANE[rd.cls]; c.y = surfaceAt(c.x, c.z, p[2] + 2); c.vx = c.vz = c.vy = 0; c.th = Math.atan2(p[3], p[4]); c.air = false; c.pitch = c.roll = 0; cam.yaw = c.th + Math.PI; }
  else { const s = sidewalkNear(p[0], p[1]); player.x = s.x; player.z = s.z; player.y = surfaceAt(s.x, s.z, 99); player.vy = 0; } }
function setWaypoint(x, z, label) { MS.wpt = { x, z, label }; showBeacon(MS.wp, MS.wpt); MS.routeT = 0; MS.route = null; }
function splash() { addMoney(-50); UI.toast('跌咗落海', '已經送你返上岸，拖車費 MOP 50。', 3.5); AUDIO.sfx('thump');
  const s = player.safe || { x: player.x, z: player.z }; const nr = nearestRoad(s.x, s.z, { noBridge: true }); if (!nr) { spawnHome(); return; } const rd = ROADS[nr.ri]; const p = roadPoint(rd, nr.s);
  if (player.mode === 'car') { const c = player.car; c.x = p[0] + p[4] * LANE[rd.cls]; c.z = p[1] - p[3] * LANE[rd.cls]; c.y = surfaceAt(c.x, c.z, 99); c.vx = c.vz = c.vy = 0; c.th = Math.atan2(p[3], p[4]); c.air = false; }
  else { const q = sidewalkNear(p[0], p[1]); player.x = q.x; player.z = q.z; player.y = surfaceAt(q.x, q.z, 99); player.vy = 0; } }

/* ---------- input ---------- */
addEventListener('keydown', e => { if (!GAME.started) return; const k = e.code; if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k) && !UI.dlgOpen) e.preventDefault();
  keys.add(k); if (!e.repeat) pressKey(k); });
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function pressKey(k) {
  if (!GAME.started) return;
  if (k === 'Escape') { if (performance.now() - (GAME.unlockT || 0) < 450) return; if (UI.dlgOpen) UI.closeDlg(); else if (UI.mapOpen) UI.closeMap(); else if (UI.phoneOpen) UI.phone(false); else if (GAME.photo) setPhoto(false); else UI.pause(); return; }
  if (UI.dlgOpen) return;
  if (k === 'KeyM') { if (UI.mapOpen) UI.closeMap(); else { UI.phone(false); UI.openMap(); } return; }
  if (k === 'KeyT') { if (UI.mapOpen) UI.closeMap(); UI.phone(); return; }
  if (UI.mapOpen || UI.phoneOpen) return;
  if (k === 'KeyE' || k === 'Enter') interact();
  else if (k === 'KeyF') toggleCar();
  else if (k === 'KeyQ') { if (player.mode !== 'car') { UI.toast('電台', '上車先可以聽電台。', 2); return; } const st = AUDIO.cycleRadio(); if (st) UI.toast(st.name, st.fm || '收音機已關閉', 2); }
  else if (k === 'KeyH') { AUDIO.sfx('horn'); hornReaction(); for (const p of PEDS) if (p.alive && Math.hypot(p.x - player.x, p.z - player.z) < 14) p.dodge = Math.max(p.dodge, 1.5); }
  else if (k === 'KeyV' || k === 'KeyC') { cam.distCar = cam.distCar > 14 ? 8 : cam.distCar < 10 ? 12 : 18; cam.dist = cam.dist > 7 ? 4.2 : cam.dist < 5 ? 6.5 : 9; }
  else if (k === 'KeyP') photoKey();
  else if (k === 'KeyR') { if (player.mode === 'car') { unstuck(); UI.toast('已重置車輛', '', 1.5); } }
}
function interact() {
  if (UI.sayOpen) { UI.sayNext(); return; }
  if (MS.nearStart) { UI.missionCard(MS.nearStart); return; }
  if (player.mode === 'car') { const rs = nearRepair(); if (rs && Math.hypot(player.car.vx, player.car.vz) < 3) repairDialog(rs); return; }
  const st = nearStation(); if (st) { UI.lrt(st); return; }
  const bs = nearStop(); if (bs != null) { busDialog(bs); return; }
  const sh = nearestShop(player.x, player.z, 6.5); if (sh) { UI.shop(sh); return; }
}
function nearStation() { for (const s of LRT.stations) if (Math.hypot(s.ex - player.x, s.ez - player.z) < 7) return s; return null; }
function nearParked() { let best = null, bd = 18; for (const c of PARKED) { const d = (c.x - player.x) ** 2 + (c.z - player.z) ** 2; if (d < bd) { bd = d; best = c; } } return best; }
function toggleCar() {
  if (player.mode === 'foot') { const pc = nearParked(); if (!pc) return; if (GAME.photo) setPhoto(false); enterVehicle(pc); cam.yaw = pc.th + Math.PI; cam.auto = 0; AUDIO.sfx('door');
    if (!save.done._car) { save.done._car = true; persist(); UI.toast(pc.type === 'scooter' ? '上咗電單車' : '上咗車', save.ctl === 'touch' ? '搖桿控制油門同方向，「手掣」可以漂移。澳門靠左行！' : 'W 加速、S 剎車／倒車、A D 轉向、空白鍵手掣。澳門靠左行！', 5); } }
  else { const c = player.car; if (Math.hypot(c.vx, c.vz) > 4) { UI.toast('停車先', '車速太快，減速再落車。', 2); return; } exitVehicle(); AUDIO.sfx('door'); }
}
const cv = () => renderer.domElement; let drag = null;
function bindPointer() { const el = cv();
  el.addEventListener('click', () => { if (isLocked()) { if (UI.sayOpen) UI.sayNext(); return; } requestLock(); });
  el.addEventListener('pointerdown', e => { if (!GAME.started || isLocked()) return; if (e.pointerType === 'mouse' && lockWanted()) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; cam.yaw -= dx * .006; cam.pitch = clamp(cam.pitch + dy * .004, -.15, 1.3); cam.auto = 1.8; });
  const end = e => { if (drag && drag.id === e.pointerId) drag = null; }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => { if (!GAME.started) return; e.preventDefault(); if (player.mode === 'car') cam.distCar = clamp(cam.distCar * (1 + e.deltaY * .001), 6, 32); else cam.dist = clamp(cam.dist * (1 + e.deltaY * .001), 2.4, 16); }, { passive: false });
  // on-screen controls
  const joyEl = $('joy'), knob = joyEl.querySelector('i'); let jid = null;
  const jm = e => { const r = joyEl.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const L = Math.hypot(dx, dy), R = r.width / 2 - 10; if (L > R) { dx *= R / L; dy *= R / L; } joy.x = dx / R; joy.y = -dy / R; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
  joyEl.addEventListener('pointerdown', e => { e.preventDefault(); jid = e.pointerId; joyEl.setPointerCapture(e.pointerId); jm(e); });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === jid) jm(e); });
  const je = e => { if (e.pointerId !== jid) return; jid = null; joy.x = joy.y = 0; knob.style.transform = ''; }; joyEl.addEventListener('pointerup', je); joyEl.addEventListener('pointercancel', je);
  document.querySelectorAll('#touch .tb').forEach(b => { const k = b.dataset.k, hold = b.dataset.hold;
    b.addEventListener('pointerdown', e => { e.preventDefault(); if (hold) { keys.add(k); b.setPointerCapture(e.pointerId); } else pressKey(k); });
    if (hold) { const up = () => keys.delete(k); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); }
    b.addEventListener('contextmenu', e => e.preventDefault()); });
}
function inputAxes() { let f = 0, s = 0; if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
  f += joy.y + GP.f; s += joy.x + GP.s; return { f: clamp(f, -1, 1), s: clamp(s, -1, 1), run: keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joy.x, joy.y) > .95 || GP.run, jump: keys.has('Space') || GP.jump }; }

/* ---------- photo mode ---------- */
function setPhoto(on) { if (on && player.mode !== 'foot') { UI.toast('落車先', '相機模式要喺行路時用。', 2); return; } GAME.photo = on; $('photo-frame').hidden = !on; $('photo-frame').querySelector('span').textContent = on ? (save.ctl === 'touch' ? '相機模式 · 按「影相」拍照 · 再按「鏡頭」或 Esc 離開' : '相機模式 · 按 P 影相 · Esc 離開') : ''; if (on) { cam.pitch = .08; } }
function photoKey() { const m = MS.cur, s = m && m.steps[MS.step]; const missionOk = s && s.k === 'photo' && MS.data.ok;
  if (!GAME.photo && !missionOk) { setPhoto(true); return; }
  if (s && s.k === 'photo') photoTaken(); else { AUDIO.sfx('shutter'); UI.flash(); FUN.catPhoto(); }
  GAME.shot = true; }
function capturePhoto() { try { const src = renderer.domElement; const w = 480, h = Math.round(w * src.height / src.width); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(src, 0, 0, w, h); UI.photos.unshift(c.toDataURL('image/jpeg', .85)); UI.photos.length = Math.min(UI.photos.length, 8); save.stats.photos++; UI.toast('影咗張相', '喺手機「相機」入面睇同下載。', 2.5); } catch (e) {} }

/* ---------- on foot ---------- */
let exhausted = false;
function updateFoot(dt, inp) {
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  let mx = fx * inp.f + rx * inp.s, mz = fz * inp.f + rz * inp.s; const ml = Math.hypot(mx, mz);
  if (player.stamina <= 0) exhausted = true; if (exhausted && player.stamina > 25) exhausted = false;
  const running = inp.run && !exhausted && ml > .2 && !GAME.photo;
  player.stamina = clamp(player.stamina + (running ? -13 : 8) * dt, 0, 100);
  const sp = (running ? 8.4 : GAME.photo ? 2.2 : 4.3) * Math.min(1, ml); player._sp = sp;
  if (ml > .05) { mx /= ml; mz /= ml; const tth = Math.atan2(mx, mz); let d = tth - player.th; d = Math.atan2(Math.sin(d), Math.cos(d)); player.th += d * Math.min(1, dt * 12); }
  let nx = player.x + mx * sp * dt, nz = player.z + mz * sp * dt;
  const ng = surfaceAt(nx, nz, player.y + .9); if (ng > player.y + .75 && player.grounded) { nx = player.x; nz = player.z; }
  const r = collide(nx, nz, .42, player.y, 1.8); nx = r.x; nz = r.z;
  for (const p of PEDS) if (p.alive && p.x != null) { const dx = nx - p.x, dz = nz - p.z, d2 = dx * dx + dz * dz; if (d2 < .6 && d2 > 1e-4) { const d = Math.sqrt(d2); nx = p.x + dx / d * .78; nz = p.z + dz / d * .78; } }
  for (const c of PARKED) { const dx = nx - c.x, dz = nz - c.z; if (dx * dx + dz * dz > 40) continue; const cs = Math.cos(c.th), sn = Math.sin(c.th); const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; const hx = CARS[c.type].wid / 2 + .35, hz = CARS[c.type].len / 2 + .35;
    if (Math.abs(lx) < hx && Math.abs(lz) < hz) { const px = hx - Math.abs(lx), pz = hz - Math.abs(lz); let ax = lx, az = lz; if (px < pz) ax = Math.sign(lx) * hx; else az = Math.sign(lz) * hz; nx = c.x + ax * cs + az * sn; nz = c.z - ax * sn + az * cs; } }
  player.x = nx; player.z = nz;
  const g = surfaceAt(player.x, player.z, player.y + .9);
  if (player.grounded && inp.jump && !player._jumpHeld) { player.vy = 7.2; player.grounded = false; } player._jumpHeld = inp.jump;
  player.vy -= 22 * dt; player.y += player.vy * dt;
  if (player.y <= g) { player.y = g; player.vy = 0; player.grounded = true; } else if (player.y - g > .35) player.grounded = false;
  if (g < -10 && player.y < -.8) { splash(); return; }
  if (player.grounded && g > 0 && performance.now() - player.lastSafeT > 1000) { player.safe = { x: player.x, z: player.z }; player.lastSafeT = performance.now(); }
  const ch = player.ch; ch.group.position.set(player.x, player.y, player.z); ch.group.rotation.set(0, player.th, 0); animChar(ch, player.grounded ? sp : 0, dt, player.grounded ? 'walk' : 'air');
}

/* ---------- vehicles ---------- */
let lastHit = 0;
function updateCar(dt, inp) {
  const c = player.car; const spec = CARS[c.type]; const scooter = c.type === 'scooter'; const fx = Math.sin(c.th), fz = Math.cos(c.th), rx = Math.cos(c.th), rz = -Math.sin(c.th);
  let vf = c.vx * fx + c.vz * fz, vl = c.vx * rx + c.vz * rz; const hb = inp.jump; const tune = 1 + .1 * (c.tune || 0); const dmgK = dmgSpeedFactor(c); const maxV = spec.maxV * tune * dmgK, acc = spec.acc * tune * (.5 + .5 * dmgK);
  if (!c.air) {
    if (inp.f > .05) { if (vf < -.5) vf += inp.f * 20 * dt; else vf += inp.f * acc * (1 - Math.max(0, vf) / maxV) * dt; }
    else if (inp.f < -.05) { if (vf > .5) vf += inp.f * 22 * dt; else vf = Math.max(scooter ? -4 : -11, vf + inp.f * 6 * dt); }
    vf -= vf * (inp.f > .05 ? .02 : .06) * dt + Math.sign(vf) * Math.min(Math.abs(vf), .4 * dt);
    if (hb) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 9 * dt);
    const maxSteer = (scooter ? .75 : .6) / (1 + Math.abs(vf) / (scooter ? 12 : 16)); c.steer += (inp.s * maxSteer - c.steer) * Math.min(1, dt * 7);
    c.th -= vf * Math.tan(c.steer) / (scooter ? 1.4 : 2.7) * dt * (hb ? 1.35 : 1);
    const grip = hb ? 1.2 : scooter ? 12 : 8.5; vl *= Math.exp(-grip * dt); }
  const nfx = Math.sin(c.th), nfz = Math.cos(c.th), nrx = Math.cos(c.th), nrz = -Math.sin(c.th);
  c.vx = nfx * vf + nrx * vl; c.vz = nfz * vf + nrz * vl;
  let nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
  const g0 = surfaceAt(nx, nz, c.y + .5); if (g0 > c.y + 1.1 && !c.air) { nx = c.x; nz = c.z; c.vx *= -.2; c.vz *= -.2; }
  let hit = false, hnx = 0, hnz = 0; const hr = c.wid / 2 + .1;
  for (const k of [-1, 0, 1]) { const ox = nfx * k * (c.len / 2 - hr), oz = nfz * k * (c.len / 2 - hr); const r = collide(nx + ox, nz + oz, hr, c.y, 1.6); if (r.hit) { nx += r.x - (nx + ox); nz += r.z - (nz + oz); hit = true; hnx = r.nx; hnz = r.nz; } }
  for (const t of TRAFFIC) { if (!t.alive && !t.reserved) continue; const dx = nx - t.x, dz = nz - t.z, d2 = dx * dx + dz * dz, rr = (c.len + t.len) * .3; if (d2 < rr * rr && d2 > 1e-4) { const d = Math.sqrt(d2); nx = t.x + dx / d * rr; nz = t.z + dz / d * rr; hit = true; hnx = dx / d; hnz = dz / d; t.v = 0; t.wait = 2; } }
  for (const a of RACERS.list) { const dx = nx - a.x, dz = nz - a.z, d2 = dx * dx + dz * dz, rr = c.len * .6; if (d2 < rr * rr && d2 > 1e-4) { const d = Math.sqrt(d2); nx = a.x + dx / d * rr; nz = a.z + dz / d * rr; hit = true; hnx = dx / d; hnz = dz / d; a.v *= .7; } }
  for (const p of PARKED) { const dx = nx - p.x, dz = nz - p.z, d2 = dx * dx + dz * dz, rr = (c.len + CARS[p.type].len) * (p.type === 'scooter' ? .22 : .3); if (d2 < rr * rr && d2 > 1e-4) { const d = Math.sqrt(d2); nx = p.x + dx / d * rr; nz = p.z + dz / d * rr; hit = true; hnx = dx / d; hnz = dz / d; } }
  if (hit) { const vn = c.vx * hnx + c.vz * hnz; if (vn < 0) { c.vx -= vn * hnx * 1.35; c.vz -= vn * hnz * 1.35; } c.vx *= .75; c.vz *= .75; const imp = -vn;
    if (imp > 4.5 && performance.now() - lastHit > 600) { lastHit = performance.now(); carImpact(imp); } }
  c.x = nx; c.z = nz;
  const g = surfaceAt(c.x, c.z, c.y + .6);
  if (c.air) { c.vy -= 22 * dt; c.y += c.vy * dt; if (c.y <= g) { c.y = g; c.vy = 0; c.air = false; } }
  else { if (g < c.y - .7) { c.air = true; c.vy = Math.max(0, (c.pitch || 0) * vf * -.4); } else c.y += (g - c.y) * Math.min(1, dt * 18); }
  if (g < -10 && c.y < -.8) { splash(); return; }
  if (!c.air && g > 0 && performance.now() - player.lastSafeT > 1000) { player.safe = { x: c.x, z: c.z }; player.lastSafeT = performance.now(); }
  const L = c.len * .45; const gf = surfaceAt(c.x + nfx * L, c.z + nfz * L, c.y + .6), gb = surfaceAt(c.x - nfx * L, c.z - nfz * L, c.y + .6);
  const tp = (gf > -10 && gb > -10 && !c.air) ? Math.atan2(gb - gf, 2 * L) : c.pitch; c.pitch += (clamp(tp, -.5, .5) - c.pitch) * Math.min(1, dt * 8);
  const roll = scooter ? clamp(c.steer * vf * .028, -.42, .42) : clamp(-c.steer * vf * .004, -.08, .08); c.roll += (roll - c.roll) * Math.min(1, dt * 5);
  c.mesh.position.set(c.x, c.y, c.z); c.mesh.rotation.set(c.pitch, c.th, c.roll, 'YXZ');
  player.x = c.x; player.z = c.z; player.y = c.y; player.th = c.th;
  if (scooter) { const ch = player.ch; ch.group.position.set(c.x - nfx * .28, c.y + .08, c.z - nfz * .28); ch.group.rotation.set(c.pitch, c.th, c.roll, 'YXZ'); animChar(ch, 0, dt, 'sit'); }
  headlight.intensity = ENV.night > .45 ? 2.6 : 0; headlight.position.set(c.x + nfx * 2, c.y + 1.1, c.z + nfz * 2); hlTarget.position.set(c.x + nfx * 20, c.y - 1, c.z + nfz * 20);
  c.vf = vf; c.vl = vl; c.thr = inp.f;
}

/* ---------- camera ---------- */
function updateCamera(dt) {
  const inCar = player.mode === 'car'; const c = player.car;
  if (inCar) { cam.auto -= dt; const spd = Math.hypot(c.vx, c.vz); if (cam.auto <= 0 && spd > 2) { let tgtYaw = c.th + Math.PI; if ((c.vf || 0) < -1) tgtYaw = c.th; let d = tgtYaw - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.yaw += d * Math.min(1, dt * 3); cam.pitch += (.22 - cam.pitch) * Math.min(1, dt * 1.5); } }
  const dist = GAME.photo ? 2.6 : inCar ? cam.distCar * (c.type === 'scooter' ? .7 : 1) * (1 + Math.min(.25, Math.hypot(c.vx, c.vz) / 120)) : cam.dist;
  camTgt.set(player.x, player.y + (GAME.photo ? 1.65 : inCar ? (c.type === 'scooter' ? 1.5 : 1.7) : 1.55), player.z);
  if (GAME.photo) { camTgt.x += Math.cos(cam.yaw) * .55; camTgt.z -= Math.sin(cam.yaw) * .55; }
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  let want = dist; for (let k = 1; k <= 8; k++) { const d = dist * k / 8; const x = camTgt.x + Math.sin(cam.yaw) * cp * d, z = camTgt.z + Math.cos(cam.yaw) * cp * d, y = camTgt.y + sp * d; if (insideBuilding(x, z, y) || y < groundAt(x, z) + .4) { want = Math.max(1.2, dist * (k - 1) / 8); break; } }
  camPos.set(camTgt.x + Math.sin(cam.yaw) * cp * want, camTgt.y + sp * want, camTgt.z + Math.cos(cam.yaw) * cp * want);
  const gy = surfaceAt(camPos.x, camPos.z, camPos.y); if (camPos.y < gy + .4) camPos.y = gy + .4; if (camPos.y < .6) camPos.y = .6;
  camera.position.lerp(camPos, Math.min(1, dt * (inCar ? 10 : 14))); camera.lookAt(camTgt);
  setNear(want < 3 ? .15 : .3);
}
function setNear(n) { if (Math.abs(camera.near - n) > 1e-3) { camera.near = n; camera.updateProjectionMatrix(); } }
function followSun(t) { sun.position.copy(t).addScaledVector(SUN_DIR, 400); sun.target.position.copy(t); for (const m of treeTiles) { const v = Math.abs(m.userData.cx - t.x) < 2400 && Math.abs(m.userData.cz - t.z) < 2400; m.visible = v; m.userData.trunk.visible = v && Math.abs(m.userData.cx - t.x) < 1400 && Math.abs(m.userData.cz - t.z) < 1400; } }

/* ---------- prompts & touch labels ---------- */
let promptT = 0, lastLbl = '';
function updatePrompt(dt) { promptT -= dt; if (promptT > 0) return; promptT = .15; const parts = []; const foot = player.mode === 'foot';
  if (!UI.sayOpen) {
    if (MS.nearStart) parts.push(keyHint('E', '互動') + ' 接任務：' + esc(MS.nearStart.title));
    if (foot) { const pc = nearParked(); if (pc) parts.push(keyHint('F', '上車') + (pc.type === 'scooter' ? ' 揸電單車' : pc.type === 'taxi' ? ' 揸的士' : ' 上車'));
      if (!MS.nearStart) { const st = nearStation(); if (st) parts.push(keyHint('E', '互動') + ' 搭輕軌 · ' + esc(st.name)); else if (nearStop() != null) parts.push(keyHint('E', '互動') + ' 搭巴士 · ' + esc(S(W.stops[nearStop()][4]))); else { const sh = nearestShop(player.x, player.z, 6.5); if (sh) parts.push(keyHint('E', '互動') + ' 入去 ' + esc(sh.name) + (shopOpen(sh, GAME.time) ? '' : '（已收舖）')); } } }
    else { const rs = nearRepair(); if (rs && Math.hypot(player.car.vx, player.car.vz) < 3) parts.push(keyHint('E', '互動') + ' 維修 · ' + esc(rs.name)); else if (Math.hypot(player.car.vx, player.car.vz) < 1.5 && !parts.length) parts.push(keyHint('F', '落車') + ' 落車'); }
  }
  UI.prompt(parts.join(' · '));
  const lbl = player.mode; if (lbl !== lastLbl) { lastLbl = lbl; $('tb-f').textContent = foot ? '上車' : '落車'; $('tb-sp').textContent = foot ? '跳' : '手掣'; $('tb-run').hidden = !foot; document.querySelectorAll('#tb-row [data-mode]').forEach(b => b.hidden = b.dataset.mode !== lbl); }
}

/* ---------- loop ---------- */
let lastT = performance.now(), parkT = 0, persistT = 0;
function frame(now) {
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now; GAME.frame++;
  if (W && player.ch) {
    if (GAME.started) {
      GP.poll(dt); const frozen = UI.dlgOpen || UI.mapOpen || UI.phoneOpen;
      if (!frozen) {
        GAME.clock += dt; { const nt = (GAME.time + dt * TIME_RATE) % 1440; if (nt < GAME.time) { save.day = (save.day || 1) + 1; persist(); } GAME.time = nt; }
        const inp = inputAxes(); if (MS.cur && MS.data && MS.data.raceId && !MS.data.started) inp.f = Math.min(0, inp.f);
        if (player.mode === 'car') updateCar(dt, inp); else { updateFoot(dt, inp); headlight.intensity = 0; }
        updateTraffic(dt, player.x, player.z, player.mode === 'car' ? player.car : null); updatePeds(dt, player.x, player.z, player.mode === 'car' ? player.car : null);
        updateMissions(dt); updateLights(dt); updateLRT(dt); updateTarts(GAME.clock);
        parkT -= dt; if (parkT <= 0) { parkT = 3; recycleParked(player.x, player.z); }
        updatePrompt(dt); smokeTick(dt); gpsTick(dt); honkTick(dt);
      }
      updateCamera(dt); feelCamera(dt); followSun(camTgt);
      UI.tick(dt); UI.hud(dt); if (GAME.frame % 10 === 0) updateLockHint(); if (GAME.frame % 3 === 0) UI.drawMini(); if (UI.mapOpen && GAME.frame % 20 === 0) UI.drawBig();
      const c = player.car; AUDIO.update(dt, player.mode === 'car' && !frozen, c ? c.vf || 0 : 0, c ? c.thr || 0 : 0, c ? Math.abs(c.vl || 0) : 0, c && c.type === 'sport');
      persistT -= dt; if (persistT <= 0) { persistT = 5; save.time = GAME.time; save.stamina = Math.round(player.stamina); persist(); }
    } else { const t = now / 1000; camTgt.set(player.x, player.y + 30, player.z); camera.position.set(player.x + Math.sin(t * .05) * 380, player.y + 170, player.z + Math.cos(t * .05) * 380); camera.lookAt(camTgt); setNear(2); followSun(camTgt); updateLights(dt); updateLRT(dt); updateTarts(t); }
    updateEnv(dt, GAME.time, camTgt); { const fr = GAME.started && (UI.dlgOpen || UI.mapOpen || UI.phoneOpen); EX.update(dt, fr); LIFE.update(dt, fr); if (W && LIFE.glows) LIFE.updateMore(dt); if (FUN.built) FUN.update(dt, fr); } updateSigns(player.x, player.z);
    renderer.render(scene, camera); if (GAME.frame > 2) signsAfterFirstFrame();
    if (GAME.shot) { GAME.shot = false; capturePhoto(); }
  } else if (renderer) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
boot().then(() => { if (W && player.ch) bindPointer(); });
requestAnimationFrame(frame);
window.__game = { LIFE, EX, GP, GAME, player, MS, save, keys, cam, pressKey, teleport, startMission, MISSIONS, completion, SIGNS, SHOPS, LRT, UI };
