'use strict';
/* =====================================================================
   extras (v2.1): performance (distance culling, adaptive resolution, FPS),
   garage (buy / tune / summon vehicles), traffic fines (red lights and
   speed cameras), achievements, sky dome, lamp light pools, animated sea,
   and game-controller support.
   ===================================================================== */
const EX = { time: { value: 0 }, chunks: [], cullT: 0, fpsN: 0, fpsT: 0, fps: 60, prT: 3, pr: 1, prBase: 1, sky: null, pools: null, cams: [], camMesh: null, redPrev: 1e9, fineT: 0, achT: 1, airT: 0, summoned: null, bridges: new Set() };
if (!save.garage) save.garage = []; if (!save.stats) save.stats = { dist: 0, clean: 0, photos: 0, lrt: 0, fines: 0 }; if (!save.ach) save.ach = {}; if (save.fines == null) save.fines = true; if (save.autoRes == null) save.autoRes = true; if (save.showFps == null) save.showFps = false;

/* ---------- vehicles for sale ---------- */
const DEALER = [
  { type: 'scooter', name: '電單車', price: 1500, desc: '窄巷穿梭最方便，泊車易。' },
  { type: 'sedan', name: '房車', price: 4000, desc: '四平八穩，載客送貨都得。' },
  { type: 'van', name: '客貨車', price: 5000, desc: '空間大，揸起嚟穩陣。' },
  { type: 'taxi', name: '黑色的士', price: 6500, desc: '澳門經典黑的士。' },
  { type: 'sport', name: '跑車', price: 12000, desc: '街上搵唔到，只可以喺車房買。極速最高。' }
];
const PAINT = ['#C62828', '#F2F2EF', '#2A2D30', '#2D4F8C', '#F2C14E', '#2E7D5B', '#E8577A', '#8E6CC9'];
const TUNE_COST = [1500, 2500, 4000];

/* ---------- achievements ---------- */
const ACH = [
  { id: 'drive', t: '揸車上路', d: '第一次上車或者上電單車', ok: () => !!save.done._car },
  { id: 'm1', t: '初到濠江', d: '完成第一個主線任務', ok: () => !!save.done.m1 },
  { id: 'story', t: '濠江傳奇', d: '完成全部主線任務', ok: () => !!save.done.m10 },
  { id: 'side', t: '街坊好幫手', d: '完成 5 個支線任務', ok: () => MISSIONS.filter(m => m.cat === 'side' && save.done[m.id]).length >= 5 },
  { id: 'race', t: '賽道之王', d: '完成全部 5 條競速', ok: () => MISSIONS.filter(m => m.cat === 'race' && save.done[m.id]).length >= 5 },
  { id: 'tart10', t: '葡撻獵人', d: '收集 10 個葡撻', ok: () => save.tarts.length >= 10 },
  { id: 'tart40', t: '葡撻大師', d: '收集全部 40 個葡撻', ok: () => save.tarts.length >= 40 },
  { id: 'lm10', t: '打卡達人', d: '打卡 10 個地標', ok: () => save.lms.length >= 10 },
  { id: 'lmall', t: '澳門通', d: '打卡全部地標', ok: () => save.lms.length >= (D ? D.lm.length : 25) },
  { id: 'jobs', t: '打工仔', d: '完成一份工嘅 5 單', ok: () => Object.keys(save.jobs).length >= 1 },
  { id: 'bridges', t: '跨海王者', d: '揸車經過全部澳氹大橋', ok: () => (save.stats.br || []).length >= (D ? D.lm.filter(l => l[0].startsWith('b-')).length : 5) },
  { id: 'air', t: '飛車', d: '車輛離地超過 1.2 秒', ok: () => !!save.stats.air },
  { id: 'clean', t: '守法司機', d: '連續 5 公里冇違例', ok: () => save.stats.clean >= 5000 },
  { id: 'km50', t: '老司機', d: '累積揸車 50 公里', ok: () => save.stats.dist >= 50000 },
  { id: 'lrt', t: '輕軌常客', d: '搭 3 次輕軌', ok: () => save.stats.lrt >= 3 },
  { id: 'photo', t: '街頭攝影師', d: '影 5 張相', ok: () => save.stats.photos >= 5 },
  { id: 'owner', t: '有車一族', d: '喺車房買第一架車', ok: () => save.garage.length >= 1 },
  { id: 'fleet', t: '車隊老闆', d: '擁有 4 架車', ok: () => save.garage.length >= 4 },
  { id: 'rich', t: '濠江富豪', d: '身家 MOP 20,000', ok: () => save.money >= 20000 },
  { id: 'night', t: '夜貓', d: '凌晨 2 點到 4 點喺街上', ok: () => GAME.started && GAME.time >= 120 && GAME.time < 240 }
];
const ACH_REWARD = 200;

/* ---------- build ---------- */
EX.build = function () {
  // building chunks for distance culling
  for (const m of world.children) if (m.isMesh && m.material === facadeMat && m.geometry.boundingSphere) EX.chunks.push(m);
  EX.prBase = Math.min(window.devicePixelRatio || 1, Qual().pr); EX.pr = EX.prBase;
  // sky dome
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uH: { value: new THREE.Color() }, uZ: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0 } },
    vertexShader: 'varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;gl_Position.z*=0.99999;}',
    fragmentShader: `uniform vec3 uH,uZ,uSun,uSunCol;uniform float uNight,uCloud;varying vec3 vD;
float hs(vec3 p){p=fract(p*.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
void main(){vec3 d=normalize(vD);float y=max(d.y,0.0);vec3 c=mix(uH,uZ,pow(y,.5));
vec3 sd=normalize(uSun);float s=max(dot(d,sd),0.0);float up=smoothstep(-.08,.05,sd.y);
c+=uSunCol*(smoothstep(.9994,.9997,s)*2.5*(1.0-uCloud)+pow(s,10.0)*.28*(1.0-uCloud*.6))*up;
float m=max(dot(d,-sd),0.0);c+=vec3(.86,.9,1.0)*(smoothstep(.99955,.9998,m)*.9+pow(m,60.0)*.06)*uNight*(1.0-uCloud*.8);
vec3 q=floor(d*380.0);float st=step(.9978,hs(q))*smoothstep(.8,1.0,uNight)*(1.0-uCloud)*smoothstep(.04,.35,d.y);c+=vec3(st*(.5+.5*hs(q+3.1)));
if(d.y<0.0)c=uH;gl_FragColor=vec4(c,1.0);}` });
  EX.sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), skyMat); EX.sky.renderOrder = -1000; EX.sky.frustumCulled = false; scene.add(EX.sky);
  // warm light pools under street lamps
  const pts = LAMPS.pts || []; if (pts.length) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,214,150,1)'); g.addColorStop(.45, 'rgba(255,190,120,.45)'); g.addColorStop(1, 'rgba(255,170,90,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: true });
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, pts.length); const o = new THREE.Object3D();
    pts.forEach((p, i) => { const sn = Math.sin(p[3]), cs = Math.cos(p[3]); const px = p[0] + sn * 1.55, pz = p[2] + cs * 1.55; o.position.set(px, Math.max(p[1], surfaceAt(px, pz, p[1] + 2)) + .06, pz); o.scale.set(11, 1, 11); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.frustumCulled = false; m.renderOrder = 2; m.visible = false; world.add(m); EX.pools = m; }
  // animated sea
  if (MAT.sea) { MAT.sea.onBeforeCompile = sh => { sh.uniforms.uTime = EX.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSeaW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSeaW=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSeaW;uniform float uTime;').replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
{float t=uTime;vec2 p=vSeaW.xz;vec2 w=vec2(sin(p.x*.05+t*.9)+.7*sin(p.y*.071-t*.7)+.35*sin((p.x+p.y)*.19+t*1.7)+.2*sin(p.x*.53-t*2.3),cos(p.y*.06+t*.8)+.7*cos(p.x*.083-t*.6)+.35*sin((p.x-p.y)*.17+t*1.4)+.2*cos(p.y*.47+t*2.1));
normal=normalize(normal+(viewMatrix*vec4(w.x*.07,0.0,w.y*.07,0.0)).xyz);}`); }; MAT.sea.needsUpdate = true; }
  // speed cameras on main roads, at least 700 m apart
  const cand = []; ROADS.forEach((rd, ri) => { if (rd.cls <= 1 && !rd.br && rd.len > 160) cand.push(ri); });
  cand.sort((a, b) => hsh(a * 13 + 7) - hsh(b * 13 + 7));
  for (const ri of cand) { if (EX.cams.length >= 18) break; const rd = ROADS[ri]; const p = roadPoint(rd, rd.len / 2); if (!isLand(p[0], p[1])) continue; if (EX.cams.some(c => Math.hypot(c.x - p[0], c.z - p[1]) < 700)) continue;
    const nx = p[4], nz = -p[3]; const sx = p[0] + nx * (rd.hw + 1.3), sz = p[1] + nz * (rd.hw + 1.3); if (collide(sx, sz, .3, groundAt(sx, sz), 2).hit) continue;
    EX.cams.push({ x: p[0], z: p[1], sx, sz, y: groundAt(sx, sz), th: Math.atan2(p[3], p[4]), cool: 0 }); }
  if (EX.cams.length) { const geo = partsGeo([{ g: new THREE.CylinderGeometry(.1, .12, 4.4, 8), y: 2.2, c: '#5b5f62' }, { g: new THREE.BoxGeometry(.55, .5, .8), y: 4.4, c: '#D9D6CF' }, { g: new THREE.BoxGeometry(.3, .3, .06), y: 4.4, z: .42, c: '#1B1D1F' }, { g: new THREE.BoxGeometry(.75, .75, .05), y: 3.1, z: .1, c: '#F4F4F2' }, { g: new THREE.BoxGeometry(.6, .6, .06), y: 3.1, z: .1, c: '#C62828' }]);
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 }), EX.cams.length); const o = new THREE.Object3D();
    EX.cams.forEach((c, i) => { o.position.set(c.sx, c.y, c.sz); o.rotation.set(0, c.th + Math.PI, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); SIGNS.recs.push({ x: c.sx + Math.sin(c.th + Math.PI) * .14, z: c.sz + Math.cos(c.th + Math.PI) * .14, y: c.y + 2.3, ang: c.th + Math.PI, w: 1.2, h: .3, kind: 0, text: '測速 70', bg: 0xF4F4F2, fg: 0x1B1D1F, cat: '', maxD: 90 }); });
    for (const r of SIGNS.recs.slice(-EX.cams.length)) { const gk = ckey(Math.floor(r.x / 100), Math.floor(r.z / 100)); let l = SIGNS.grid.get(gk); if (!l) { l = []; SIGNS.grid.set(gk, l); } l.push(r); }
    m.castShadow = true; m.frustumCulled = false; world.add(m); EX.camMesh = m; }
};

/* ---------- per frame ---------- */
EX.update = function (dt, frozen) {
  EX.time.value += dt;
  // sky
  if (EX.sky) { const u = EX.sky.material.uniforms; EX.sky.position.copy(camera.position); u.uH.value.copy(scene.fog.color);
    const cloud = ENV.weather === '晴' ? 0 : ENV.weather === '多雲' ? .5 : .85; u.uCloud.value = cloud; u.uNight.value = ENV.night;
    u.uZ.value.set('#3F78B8').lerp(_cb.set('#03060A'), ENV.night).lerp(_ca.copy(scene.fog.color), cloud * .7).lerp(_ca.set('#C9845E'), ENV.dusk * .25);
    const th = (GAME.time - 360) / 720 * Math.PI; u.uSun.value.set(Math.cos(th) * .85, Math.sin(th), .42).normalize(); u.uSunCol.value.set('#FFF3DC').lerp(_ca.set('#FF9A55'), ENV.dusk); }
  if (EX.pools) { const k = clamp((ENV.night - .35) / .4, 0, 1); EX.pools.visible = k > 0; EX.pools.material.opacity = k * .42; }
  // distance culling of building chunks
  EX.cullT -= dt; if (EX.cullT <= 0) { EX.cullT = .4; const far = scene.fog.far * 1.02, cp = camera.position;
    for (const m of EX.chunks) { const bs = m.geometry.boundingSphere; m.visible = bs.center.distanceTo(cp) - bs.radius < far; } }
  // fps + adaptive resolution
  EX.fpsN++; EX.fpsT += dt; if (EX.fpsT >= 1) { EX.fps = EX.fpsN / EX.fpsT; EX.fpsN = 0; EX.fpsT = 0; const el = $('fps'); if (el) { el.hidden = !save.showFps || !GAME.started; el.textContent = Math.round(EX.fps) + ' FPS · ' + Math.round(EX.pr * 100) + '%'; }
    if (GAME.started && !frozen && save.autoRes) { EX.prT -= 1; if (EX.prT <= 0) { let np = EX.pr; if (EX.fps < 28) np = Math.max(.55, EX.pr - .2); else if (EX.fps > 52 && EX.pr < EX.prBase) np = Math.min(EX.prBase, EX.pr + .1);
      if (np !== EX.pr) { EX.pr = np; renderer.setPixelRatio(np); renderer.setSize(innerWidth, innerHeight, false); EX.prT = 3; } else EX.prT = 2; } } }
  if (!GAME.started || frozen) return;
  // driving stats, fines, bridges, air time
  const inCar = player.mode === 'car'; const c = player.car;
  if (inCar) { const spd = Math.hypot(c.vx, c.vz); save.stats.dist += spd * dt; save.stats.clean += spd * dt;
    const raceOn = MS.cur && MS.cur.steps[MS.step] && ['race', 'follow'].includes(MS.cur.steps[MS.step].k);
    EX.fineT -= dt;
    if (save.fines && !raceOn && c.type !== 'bus') {
      const fx = Math.sin(c.th), fz = Math.cos(c.th); const red = redLightAhead(c.x, c.z, fx, fz, 3.5);
      if (EX.redPrev < 6 && red > 1e8 && spd > 6 && EX.fineT <= 0) EX.fine('衝紅燈', 300);
      EX.redPrev = red;
      for (const k of EX.cams) { k.cool -= dt; if (k.cool > 0) continue; if (Math.hypot(k.x - c.x, k.z - c.z) < 16 && spd > 19.5) { k.cool = 12; EX.fine('超速 ' + Math.round(spd * 3.6) + ' km/h（限速 70）', 200 + Math.round((spd - 19.5) * 3.6) * 10); } } }
    if (c.air) EX.airT += dt; else { if (EX.airT > 1.2 && !save.stats.air) { save.stats.air = true; } EX.airT = 0; }
    for (const l of D.lm) if (l[0].startsWith('b-') && Math.hypot(l[5] - c.x, l[6] - c.z) < 40) { const br = save.stats.br || (save.stats.br = []); if (!br.includes(l[0])) br.push(l[0]); } }
  else EX.redPrev = 1e9;
  EX.achT -= dt; if (EX.achT <= 0) { EX.achT = 1; for (const a of ACH) if (!save.ach[a.id] && a.ok()) { save.ach[a.id] = Date.now(); addMoney(ACH_REWARD); AUDIO.sfx('done'); UI.toast('成就解鎖：' + a.t, a.d + ' · MOP +' + ACH_REWARD, 4.5); persist(); break; } }
};
EX.fine = function (why, amt) { EX.fineT = 4; save.stats.fines++; save.stats.clean = 0; addMoney(-amt); UI.flash(); AUDIO.sfx('shutter'); UI.toast('交通違例：' + why, '罰款 MOP ' + amt + '（設定入面可以關閉交通違例）', 4); };

/* ---------- garage ---------- */
EX.summon = function (i) { const g = save.garage[i]; if (!g) return;
  if (player.mode === 'car' && player.car.owned === i) { UI.toast('你就喺呢架車度', ''); return; }
  for (let k = PARKED.length - 1; k >= 0; k--) if (PARKED[k].owned != null) { world.remove(PARKED[k].mesh); PARKED.splice(k, 1); }
  const pc = spawnVehicleNear(g.type, g.hex, player.x, player.z, true); if (!pc) { UI.toast('叫唔到車', '附近冇路可以泊車。'); return; }
  pc.tune = g.tune || 0; pc.owned = i; EX.summoned = pc; AUDIO.sfx('ok'); UI.toast('你架' + DEALER.find(d => d.type === g.type).name + '到咗', '泊咗喺最近嘅路邊，行過去按「上車」。', 3.5); };
EX.appGarage = function (s, back) {
  const own = save.garage.map((g, i) => { const d = DEALER.find(q => q.type === g.type); const tl = g.tune || 0;
    return '<div class="glass" style="padding:10px 12px;display:grid;gap:8px"><div style="display:flex;align-items:center;gap:10px"><span style="width:18px;height:18px;border-radius:50%;background:' + g.hex + ';border:2px solid rgb(255 255 255 / .4)"></span><b style="flex:1">' + d.name + '</b><span style="font-family:var(--f-mono);font-size:12px;color:var(--ink-soft)">引擎 Lv' + tl + '</span></div>' +
      '<div class="row"><button class="btn sm primary" type="button" data-call="' + i + '">叫車</button>' + (tl < 3 ? '<button class="btn sm" type="button" data-tune="' + i + '">改裝引擎 · MOP ' + TUNE_COST[tl].toLocaleString() + '</button>' : '<span style="font-size:12px;color:var(--ink-soft)">已改到最高級</span>') + '</div></div>'; }).join('');
  s.innerHTML = UI.appHead('車房') + '<p style="color:var(--ink-soft);font-size:13px;margin:0">買咗嘅車隨時可以叫到身邊。每級引擎改裝提升 10% 極速同加速。</p>' + (own ? '<h3 style="margin:4px 0 0;font-size:11px;letter-spacing:.2em;color:var(--ink-soft)">我嘅車</h3>' + own : '') +
    '<h3 style="margin:4px 0 0;font-size:11px;letter-spacing:.2em;color:var(--ink-soft)">車行 · 現金 MOP ' + save.money.toLocaleString() + '</h3><div class="list">' + DEALER.map((d, i) => '<button class="item" type="button" data-buy="' + i + '"><span class="ic" style="background:#3B4A55">車</span><span class="nm">' + d.name + '</span><span class="ds">' + d.desc + ' 極速約 ' + Math.round(CARS[d.type].maxV * 3.6) + ' km/h</span><span class="rt">MOP ' + d.price.toLocaleString() + '</span></button>').join('') + '</div>';
  back();
  s.querySelectorAll('[data-call]').forEach(b => b.addEventListener('click', () => { if (player.mode === 'car') { UI.toast('落車先', '叫車要喺行路時用。', 2); return; } UI.phone(false); EX.summon(+b.dataset.call); }));
  s.querySelectorAll('[data-tune]').forEach(b => b.addEventListener('click', () => { const g = save.garage[+b.dataset.tune]; const tl = g.tune || 0; if (save.money < TUNE_COST[tl]) { UI.toast('唔夠錢', '改裝要 MOP ' + TUNE_COST[tl].toLocaleString() + '。', 2); return; }
    addMoney(-TUNE_COST[tl]); g.tune = tl + 1; if (player.car && player.car.owned === +b.dataset.tune) player.car.tune = g.tune; persist(); AUDIO.sfx('buy'); EX.appGarage(s, back); }));
  s.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => { const d = DEALER[+b.dataset.buy]; if (save.money < d.price) { UI.toast('唔夠錢', d.name + '要 MOP ' + d.price.toLocaleString() + '，去做任務同打工儲錢。', 3); return; }
    s.innerHTML = UI.appHead('揀顏色') + '<p style="margin:0;font-size:14px">' + d.name + ' · MOP ' + d.price.toLocaleString() + '</p><div class="row" style="gap:10px">' + PAINT.map(h => '<button type="button" class="btn" data-h="' + h + '" aria-label="顏色 ' + h + '" style="width:48px;height:48px;padding:0;border-radius:50%;background:' + h + ';border:3px solid rgb(255 255 255 / .25)"></button>').join('') + '</div>';
    s.querySelector('#ph-back').addEventListener('click', () => EX.appGarage(s, back));
    s.querySelectorAll('[data-h]').forEach(h => h.addEventListener('click', () => { if (save.money < d.price) return; addMoney(-d.price); save.garage.push({ type: d.type, hex: h.dataset.h, tune: 0 }); persist(); AUDIO.sfx('buy'); UI.toast('買咗新車！', d.name + ' 已經入咗車房，喺車房按「叫車」。', 3.5); EX.appGarage(s, back); })); })); };
EX.appAch = function (s, back) { const n = ACH.filter(a => save.ach[a.id]).length;
  s.innerHTML = UI.appHead('成就') + '<p style="color:var(--ink-soft);font-size:13px;margin:0">已解鎖 ' + n + ' / ' + ACH.length + ' · 每個成就獎勵 MOP ' + ACH_REWARD + '</p><div class="list">' + ACH.map(a => { const got = !!save.ach[a.id];
    return '<div class="item' + (got ? '' : ' lock') + '" style="cursor:default"><span class="ic" style="background:' + (got ? 'var(--accent)' : '#3B4A55') + ';color:' + (got ? '#1B1606' : '#fff') + '">' + (got ? '★' : '☆') + '</span><span class="nm">' + a.t + '</span><span class="ds">' + a.d + '</span><span class="rt"></span></div>'; }).join('') + '</div>'; back(); };

/* ---------- game controller ---------- */
const GP = { f: 0, s: 0, run: false, jump: false, prev: [], on: false, lookX: 0, lookY: 0 };
const GP_MAP = { 2: 'KeyF', 3: 'KeyE', 9: 'Escape', 8: 'KeyM', 4: 'KeyH', 12: 'KeyT', 13: 'KeyV', 14: 'KeyQ', 15: 'KeyP' };
addEventListener('gamepadconnected', e => { GP.on = true; if (GAME.started) UI.toast('已連接手掣', (e.gamepad.id || '').split('(')[0].slice(0, 40), 3); });
GP.poll = function (dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; let p = null; for (const q of pads) if (q && q.connected) { p = q; break; }
  if (!p) { GP.f = GP.s = 0; GP.run = GP.jump = false; return; } GP.on = true;
  const dz = v => Math.abs(v) < .15 ? 0 : (v - Math.sign(v) * .15) / .85; const ax = i => dz(p.axes[i] || 0); const bt = i => p.buttons[i] ? p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0) : 0;
  const down = i => bt(i) > .5;
  const ui = UI.dlgOpen ? $('dlg-sheet') : UI.phoneOpen ? $('phone') : null;
  for (let i = 0; i < 17; i++) { const d = down(i); if (d && !GP.prev[i]) {
    if (ui) { // navigate dialogs and the phone with the d-pad, A to choose, B to go back
      const els = [...ui.querySelectorAll('button:not([disabled]),a[href]')].filter(e => e.offsetParent !== null); let k = els.indexOf(document.activeElement);
      if (i === 12 || i === 14) { (els[k > 0 ? k - 1 : els.length - 1] || {}).focus && els[k > 0 ? k - 1 : els.length - 1].focus(); }
      else if (i === 13 || i === 15) { (els[(k + 1) % els.length] || {}).focus && els[(k + 1) % els.length].focus(); }
      else if (i === 0) { if (k >= 0) els[k].click(); else if (els[0]) els[0].focus(); }
      else if (i === 1 || i === 9) { if (UI.phoneOpen && $('ph-back')) $('ph-back').click(); else pressKey('Escape'); }
    } else if (UI.mapOpen) { if (i === 1 || i === 8 || i === 9) UI.closeMap(); }
    else if (UI.sayOpen && (i === 0 || i === 3)) UI.sayNext();
    else if (GP_MAP[i]) pressKey(GP_MAP[i]); }
    GP.prev[i] = d; }
  if (UI.mapOpen) { UI.mv.cx += ax(0) * 600 * dt / UI.mv.s * .4; UI.mv.cz += ax(1) * 600 * dt / UI.mv.s * .4; if (Math.abs(ax(3)) > 0) UI.mv.s = clamp(UI.mv.s * (1 - ax(3) * dt * 1.5), .03, 4); if (ax(0) || ax(1) || ax(3)) UI.drawBig(); }
  const lx = ax(0), ly = ax(1);
  if (player.mode === 'car') { GP.f = clamp(bt(7) - bt(6) - ly, -1, 1); GP.s = lx; } else { GP.f = -ly; GP.s = lx; }
  GP.run = down(5) || down(10); GP.jump = down(0) && !UI.sayOpen;
  const rx = ax(2), ry = ax(3); if ((rx || ry) && !UI.mapOpen) { cam.yaw -= rx * dt * 2.6; cam.pitch = clamp(cam.pitch + ry * dt * 1.6, -.15, 1.3); cam.auto = 1.2; }
};
