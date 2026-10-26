'use strict';
/* =====================================================================
   missions: story (主線), side (支線), races (競速), jobs (打工),
   egg tarts (葡撻) and landmark check-ins — all at real Macau places.
   ===================================================================== */
const PL = k => { const p = W.places[k]; return p ? { x: p[0], z: p[1], y: p[2], label: p[3], rx: p[4], rz: p[5], ry: p[6] } : null; };
const LL = (lat, lon) => { const [x, z] = toXZ(lon, lat); return { x, z }; };
function snapRoad(p, opt) { const r = roadPos(p.x, p.z, opt || { noBridge: true }); return r ? { x: r.x, z: r.z, y: r.y } : { x: p.x, z: p.z, y: groundAt(p.x, p.z) }; }
function nearestPlate(x, z) { let best = null, bd = 1e18; for (const p of W.plates) { const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; best = p; } } return best ? { x: best[0], z: best[1], label: S(best[5]) } : null; }
function nearestShopCat(x, z, cats) { let best = null, bd = 1e18; for (const s of SHOPS) { if (!cats.includes(s.cat)) continue; const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } } return best; }

/* ---------- definitions ---------- */
const MISSIONS = [
  // ---------------- 主線 ----------------
  { id: 'm1', cat: 'main', title: '初到濠江', start: 'start', giver: '陳伯', reward: 100, blurb: '陳伯是你阿爺的老朋友，佢叫你先去議事亭前地行一轉，認識吓澳門。',
    steps: [{ k: 'say', who: '陳伯', text: '後生仔，第一次嚟澳門？我同你阿爺係老友。先行去議事亭前地，嗰度係澳門嘅心臟。' },
      { k: 'go', to: 'senado', r: 18, foot: true, text: '步行去議事亭前地' },
      { k: 'say', who: '陳伯（電話）', text: '見到啲葡式碎石波浪地未？聽日開始幫我手做嘢，我有架舊電單車借俾你。' }] },
  { id: 'm2', cat: 'main', title: '借架電單車', start: 'senado', giver: '陳伯', req: ['m1'], reward: 150, blurb: '陳伯把舊電單車泊咗喺附近，揸佢去大三巴同遊客打個招呼。',
    steps: [{ k: 'spawn', veh: 'scooter', color: '#C62828', at: 'senado' }, { k: 'enter', veh: 'scooter', text: '搵到紅色電單車，按 F 上車' },
      { k: 'go', to: 'stpaul', r: 26, veh: 'scooter', text: '揸電單車去大三巴牌坊' }, { k: 'say', who: '陳伯（電話）', text: '好嘢！電單車係澳門最好用嘅交通工具，記住靠左行。' }] },
  { id: 'm3', cat: 'main', title: '手信急件', start: 'stpaul', giver: '陳伯', req: ['m2'], reward: 250, blurb: '有位客人喺旅遊塔等緊一盒杏仁餅，要喺時限內送到。',
    steps: [{ k: 'say', who: '陳伯（電話）', text: '去新馬路鉅記手信攞盒杏仁餅，客人喺旅遊塔等緊，要快！' }, { k: 'go', to: 'kuikee', r: 14, text: '去鉅記手信攞貨', cargo: '杏仁餅' },
      { k: 'timer', s: 170 }, { k: 'go', to: 'tower', r: 32, text: '把杏仁餅送去澳門旅遊塔' }] },
  { id: 'm4', cat: 'main', title: '跟住架的士', start: 'ama', giver: '神秘人', req: ['m3'], reward: 300, blurb: '有人話有架的士載住陳伯嘅失物，跟住佢，唔好跟甩。',
    steps: [{ k: 'say', who: '神秘人', text: '嗰架黑色的士尾箱有個公事包，係陳伯唔見咗嗰個。跟住佢，唔好俾佢發現。' },
      { k: 'need', veh: 'any', text: '搵架車或電單車' }, { k: 'follow', path: ['ama', 'saivanlake', 'science', 'fisherman'], lose: 140, text: '跟住黑色的士（保持 140 米內）' },
      { k: 'say', who: '的士司機', text: '吓？個公事包係陳生留低㗎？我正想送去警局，你拎返俾佢啦。' }] },
  { id: 'm5', cat: 'main', title: '過海', start: 'fisherman', giver: '陳伯', req: ['m4'], reward: 300, blurb: '陳伯喺氹仔官也街等你，經跨海大橋過去。',
    steps: [{ k: 'need', veh: 'any', text: '搵架車或電單車' }, { k: 'timer', s: 210 }, { k: 'go', to: 'cunha', r: 30, veh: 'any', text: '經跨海大橋去氹仔官也街' },
      { k: 'say', who: '陳伯', text: '嚟得好快！氹仔舊城區啲老舖頭都係我老朋友。' }] },
  { id: 'm6', cat: 'main', title: '官也街掃手信', start: 'cunha', giver: '陳伯', req: ['m5'], reward: 350, blurb: '幫陳伯喺官也街三間老舖攞返預留咗嘅手信。',
    steps: [{ k: 'timer', s: 150 }, { k: 'collect', list: ['koiikei', 'mokyikei', 'fongkei'], r: 12, foot: true, text: '步行去官也街三間舖頭攞手信' },
      { k: 'say', who: '陳伯', text: '多謝！聽講今晚有人喺東望洋賽道開快車，我個孫想同佢比一場……' }] },
  { id: 'm7', cat: 'main', title: '格蘭披治之夜', start: 'gate', giver: '陳伯個孫', req: ['m6'], reward: 500, blurb: '夜晚跑一圈東望洋賽道，同陳伯個孫比速度。',
    steps: [{ k: 'setTime', min: 20 * 60 + 30 }, { k: 'need', veh: 'car', text: '搵架車（電單車都得）' }, { k: 'race', id: 'r1' },
      { k: 'say', who: '陳伯個孫', text: '估唔到你揸得咁好……我服！下次去路氹再比過。' }] },
  { id: 'm8', cat: 'main', title: '路氹夜遊', start: 'venetian', giver: '旅行團導遊', req: ['m7'], reward: 400, blurb: '有位遊客想由威尼斯人去巴黎鐵塔影相。',
    steps: [{ k: 'need', veh: 'car', text: '搵架車接客' }, { k: 'pass', from: 'venetian', to: 'eiffel', who: '遊客 Sophie', text: '接遊客去巴黎鐵塔' },
      { k: 'photo', at: 'eiffel', text: '落車同巴黎鐵塔影張相（按 P）' }] },
  { id: 'm9', cat: 'main', title: '葡撻快遞', start: 'lordstow', giver: '陳伯', req: ['m8'], reward: 500, blurb: '路環安德魯餅店嘅葡撻要趁熱送去澳門大學。',
    steps: [{ k: 'say', who: '陳伯（電話）', text: '安德魯嘅葡撻要熱辣辣先好食！澳大有位教授等緊，快啲！' }, { k: 'go', to: 'lordstow', r: 14, text: '去安德魯餅店攞葡撻', cargo: '葡撻' },
      { k: 'need', veh: 'any', text: '搵架車或電單車' }, { k: 'timer', s: 230 }, { k: 'go', to: 'umac', r: 40, veh: 'any', text: '趁熱把葡撻送去澳門大學' }] },
  { id: 'm10', cat: 'main', title: '最後航班', start: 'umac', giver: '陳伯', req: ['m9'], reward: 1000, blurb: '陳伯要趕飛機，送佢去澳門國際機場。',
    steps: [{ k: 'say', who: '陳伯', text: '我要飛去葡國探個仔，班機仲有一陣就閂閘，靠晒你喇！' }, { k: 'need', veh: 'car', text: '搵架車' }, { k: 'timer', s: 260 },
      { k: 'pass', from: 'umac', to: 'airport', who: '陳伯', text: '送陳伯去機場' },
      { k: 'say', who: '陳伯', text: '趕到喇！呢架車同呢個城市以後就交俾你。多謝你，後生仔。' }] },
  // ---------------- 支線 ----------------
  { id: 's1', cat: 'side', title: '豬扒包外賣', start: 'tailoi_pen', giver: '大利來記', reward: 180, blurb: '一份熱辣辣嘅豬扒包要送去南灣一棟住宅大廈。',
    steps: [{ k: 'timer', s: 170 }, { k: 'go', to: () => nearestPlate(...toXZ(113.5375, 22.1880)), r: 16, text: '送豬扒包去住宅大廈' }] },
  { id: 's2', cat: 'side', title: '雙皮奶上山', start: 'yeesoon', giver: '義順鮮奶', reward: 200, blurb: '東望洋燈塔嘅看守人叫咗兩碗雙皮奶。',
    steps: [{ k: 'timer', s: 260 }, { k: 'go', to: 'guia', r: 20, text: '送雙皮奶上東望洋燈塔' }] },
  { id: 's3', cat: 'side', title: '迷路遊客', start: 'ama', giver: '遊客', reward: 220, blurb: '一對遊客搵唔到酒店，載佢哋過去。',
    steps: [{ k: 'need', veh: 'car', text: '搵架車' }, { k: 'pass', from: 'ama', to: () => { const s = nearestShopCat(...toXZ(113.5410, 22.1910), ['t:hotel', 't:guest_house']); return s && { x: s.x, z: s.z, label: s.name }; }, who: '遊客', text: '送遊客去酒店' }] },
  { id: 's4', cat: 'side', title: '燒味飯盒', start: 'chankwong', giver: '陳光記', reward: 220, blurb: '關閘有班地盤師傅叫咗燒味飯。',
    steps: [{ k: 'timer', s: 210 }, { k: 'go', to: 'gate', r: 30, text: '送燒味飯去關閘' }] },
  { id: 's5', cat: 'side', title: '黑沙海灘日落', start: 'hacsa', giver: '攝影師', reward: 250, blurb: '喺黑沙海灘影一張日落相（17:00–19:00）。',
    steps: [{ k: 'waitTime', from: 17 * 60, to: 19 * 60, text: '日落時間（17:00–19:00）再嚟' }, { k: 'photo', at: 'hacsa', text: '對住海灘影張日落相（按 P）' }] },
  { id: 's6', cat: 'side', title: '疊石塘山頂', start: 'chapel', giver: '行山友', reward: 200, blurb: '行上澳門最高點疊石塘山。',
    steps: [{ k: 'go', to: 'alto', r: 30, foot: true, text: '步行上疊石塘山頂' }] },
  { id: 's7', cat: 'side', title: '營地街市掃街', start: 'ieongkei', giver: '街坊', reward: 260, blurb: '半島美食巡禮：黃枝記、祥記、瑪嘉烈蛋撻。',
    steps: [{ k: 'timer', s: 200 }, { k: 'collect', list: ['wongchi', 'cheungkei', 'margaret'], r: 13, foot: true, text: '步行去三間老字號' }] },
  { id: 's8', cat: 'side', title: '科學館參觀', start: 'senado', giver: '學生', reward: 220, blurb: '一位學生要趕去澳門科學館參觀。',
    steps: [{ k: 'need', veh: 'any', text: '搵架車或電單車' }, { k: 'pass', from: 'senado', to: 'science', who: '學生', text: '送學生去科學館' }] },
  { id: 's9', cat: 'side', title: '大炮台影相', start: 'stpaul', giver: '攝影學會', reward: 220, blurb: '攝影學會想要一張由大炮台望落半島嘅相。',
    steps: [{ k: 'go', to: 'monte', r: 28, foot: true, text: '行上大炮台' }, { k: 'photo', at: 'monte', text: '喺大炮台影張相（按 P）' }] },
  { id: 's10', cat: 'side', title: '三盞燈外賣', start: 'rotunda', giver: '緬甸餐廳', reward: 220, blurb: '三盞燈嘅緬甸雞絲撈檬要送去附近一棟住宅大廈。',
    steps: [{ k: 'timer', s: 180 }, { k: 'go', to: () => nearestPlate(...toXZ(113.5482, 22.2088)), r: 16, text: '送緬甸雞絲撈檬去住宅大廈' }] },
  { id: 's11', cat: 'side', title: '主教山祈福', start: 'senado', giver: '婆婆', reward: 240, blurb: '婆婆想去主教山小堂祈福，條山路好斜，車佢上去。',
    steps: [{ k: 'need', veh: 'car', text: '搵架車' }, { k: 'pass', from: 'senado', to: 'penha', who: '婆婆', text: '接婆婆去主教山小堂' }, { k: 'say', who: '婆婆', text: '後生仔真係好人，主教山望落去個海幾靚呀。' }] },
  { id: 's12', cat: 'side', title: '龍環葡韻婚紗相', start: 'cunha', giver: '一對新人', reward: 260, blurb: '一對新人想喺龍環葡韻嘅綠色葡式住宅前面影婚紗相。',
    steps: [{ k: 'need', veh: 'car', text: '搵架車' }, { k: 'pass', from: 'cunha', to: 'taipahouses', who: '新人', text: '載新人去龍環葡韻' }, { k: 'photo', at: 'taipahouses', text: '幫新人影張婚紗相（按 P）' }] },
  { id: 's13', cat: 'side', title: '譚公廟送貨', start: 'lordstow', giver: '路環街坊', reward: 220, blurb: '幫街坊送一箱香燭去路環譚公廟，路環巷仔窄，揸電單車最好。',
    steps: [{ k: 'need', veh: 'scooter', text: '搵架電單車' }, { k: 'timer', s: 120 }, { k: 'go', to: 'tamkung', r: 22, veh: 'scooter', text: '揸電單車送香燭去譚公廟' }] },
  // ---------------- 競速 ----------------
  { id: 'r1', cat: 'race', title: '東望洋環迴賽', start: 'gate', reward: 300, blurb: '繞東望洋山一圈，路線參考格蘭披治賽道。', steps: [{ k: 'need', veh: 'any', text: '搵架車或電單車' }, { k: 'race', id: 'r1' }] },
  { id: 'r2', cat: 'race', title: '澳氹雙橋', start: 'start', reward: 300, blurb: '經嘉樂庇總督大橋去氹仔，再經友誼大橋返半島。', steps: [{ k: 'need', veh: 'any', text: '搵架車或電單車' }, { k: 'race', id: 'r2' }] },
  { id: 'r3', cat: 'race', title: '金光大道衝刺', start: 'venetian', reward: 250, blurb: '路氹度假村之間的直路衝刺。', steps: [{ k: 'need', veh: 'any', text: '搵架車或電單車' }, { k: 'race', id: 'r3' }] },
  { id: 'r4', cat: 'race', title: '路環環山', start: 'chapel', reward: 350, blurb: '路環市區、黑沙、九澳山路一圈。', steps: [{ k: 'need', veh: 'any', text: '搵架車或電單車' }, { k: 'race', id: 'r4' }] },
  { id: 'r5', cat: 'race', title: '新城A區', start: 'science', reward: 250, blurb: '由新口岸經澳門大橋一帶出新城 A 區。', steps: [{ k: 'need', veh: 'any', text: '搵架車或電單車' }, { k: 'race', id: 'r5' }] }
];
const RACES = {
  r1: [[22.1912, 113.5482], [22.1958, 113.5552], [22.2008, 113.5546], [22.2026, 113.5498], [22.1999, 113.5458], [22.1956, 113.5428], [22.1913, 113.5440], [22.1912, 113.5482]],
  r2: [[22.1880, 113.5452], 'b-nobre', [22.1636, 113.5533], [22.1648, 113.5640], 'b-amizade', [22.1924, 113.5560], [22.1893, 113.5490]],
  r3: [[22.1500, 113.5562], [22.1440, 113.5580], [22.1385, 113.5602], [22.1346, 113.5640], [22.1396, 113.5680], [22.1462, 113.5650]],
  r4: [[22.1288, 113.5560], [22.1176, 113.5545], [22.1160, 113.5700], [22.1252, 113.5780], [22.1330, 113.5700], [22.1336, 113.5602]],
  r5: [[22.1905, 113.5520], [22.1958, 113.5560], [22.2012, 113.5622], [22.2088, 113.5662], [22.2052, 113.5700], [22.1985, 113.5600]]
};
const JOBS = [
  { id: 'taxi', title: '的士司機', veh: 'taxi', color: '#17191B', blurb: '按現行收費計：首 1.6 公里 MOP 21，之後每 220 米 MOP 2。' },
  { id: 'food', title: '外賣速遞', veh: 'scooter', color: '#F2C14E', blurb: '由真實食肆取餐，送去真實住宅大廈。' },
  { id: 'cargo', title: '送貨', veh: 'van', color: '#E9E6DF', blurb: '由超市同便利店之間送貨。' },
  { id: 'tour', title: '導遊', veh: 'sedan', color: '#2D4F8C', blurb: '接旅客去地標景點。' }
];
const LMS = () => W && D.lm.map(a => ({ id: a[0], zh: a[1], pt: a[2], x: a[5], z: a[6], y: a[7], stat: a[8] }));

/* ---------- engine ---------- */
const MS = { cur: null, step: 0, timer: null, data: {}, lead: null, job: null, markers: [], wpt: null, route: null, routeT: 0, cps: null, lastCheckT: 0, sayQ: null, cargo: null };
function missionAvailable(m) { if (m.cat === 'main') { if (save.done[m.id]) return false; return (m.req || []).every(r => save.done[r]); } if (m.cat === 'race') return (m.req || []).every(r => save.done[r]); return !save.done[m.id]; }
const _msp = new Map();
function missionStartPos(m) { if (_msp.has(m.id)) return _msp.get(m.id); const p = PL(m.start); if (!p) return null;
  // put the marker on the pavement in front of the real place; missions sharing a place are spread along the kerb
  const same = MISSIONS.filter(q => q.start === m.start); const k = same.indexOf(m) - (same.length - 1) / 2;
  const r = roadPos(p.x, p.z, { noBridge: true }); let x = p.rx, z = p.rz;
  if (r) { const nx = r.dz, nz = -r.dx; const sd = ((p.x - r.x) * nx + (p.z - r.z) * nz) >= 0 ? 1 : -1; x = r.x + nx * (r.hw + 2.4) * sd + r.dx * k * 9; z = r.z + nz * (r.hw + 2.4) * sd + r.dz * k * 9; }
  const o = { x, z, y: surfaceAt(x, z, 99), label: p.label }; _msp.set(m.id, o); return o; }
const MK_COLORS = { main: '#E0463A', side: '#3E8EDE', race: '#F08A24', job: '#2BB37A' };
const EXTRA_PLACES = { monte: [22.1971, 113.5427, '大炮台'], rotunda: [22.2046, 113.5436, '三盞燈'], penha: [22.1865, 113.5355, '主教山小堂'], taipahouses: [22.1534, 113.5585, '龍環葡韻'], tamkung: [22.1153, 113.5510, '譚公廟'] };
function fixPlaces() { // some OSM places sit inside a building or off the coast: move their road point to the nearest usable kerb
  for (const k in EXTRA_PLACES) if (!W.places[k]) { const [la, lo, lb] = EXTRA_PLACES[k]; const [x, z] = toXZ(lo, la); const y = groundAt(x, z); W.places[k] = [x, z, y, lb, x, z, y]; }
  for (const k in W.places) { const p = W.places[k]; const ok = (x, z, y) => isLand(x, z) && !insideBuilding(x, z, y + 1) && !collide(x, z, 1.2, y, 1.6).hit;
    if (p[4] !== p[0] || p[5] !== p[1]) { if (ok(p[4], p[5], p[6])) continue; } else if (k === 'alto') continue;
    let best = null, bd = 1e18;
    for (let ring = 0; ring < 8 && !best; ring++) for (let a = 0; a < 16; a++) { const d = ring * 40, an = a / 16 * Math.PI * 2; const r = roadPos(p[0] + Math.cos(an) * d, p[1] + Math.sin(an) * d, { noBridge: true }); if (!r || !ok(r.x, r.z, r.y)) continue; const dd = Math.hypot(r.x - p[0], r.z - p[1]); if (dd < bd) { bd = dd; best = r; } }
    if (best) { p[4] = best.x; p[5] = best.z; p[6] = best.y; } } }
function buildMarkers() { fixPlaces();
  const icon = (txt, col) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = col; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.lineWidth = 8; x.strokeStyle = '#fff'; x.stroke(); x.fillStyle = '#fff'; x.font = '700 64px ' + SIGN_FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 64, 68); const t = new THREE.CanvasTexture(c); return t; };
  const ICONS = { main: icon('主', MK_COLORS.main), side: icon('支', MK_COLORS.side), race: icon('賽', MK_COLORS.race) };
  for (const m of MISSIONS) { const p = missionStartPos(m); if (!p) continue; const g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.2, 28, 1, true).translate(0, 1.6, 0), new THREE.MeshBasicMaterial({ color: MK_COLORS[m.cat], transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS[m.cat], depthTest: true })); sp.scale.set(1.8, 1.8, 1); sp.position.y = 4.6;
    g.add(col, sp); g.position.set(p.x, p.y - .3, p.z); g.visible = false; world.add(g); MS.markers.push({ m, g, sp, p }); }
  MS.dest = makeBeacon('#5DD39E', 6); MS.pick = makeBeacon('#F2C14E', 4); MS.wp = makeBeacon('#6FB2FF', 5);
  MS.ring = new THREE.Mesh(new THREE.TorusGeometry(9, .6, 10, 40), new THREE.MeshBasicMaterial({ color: 0xF2C14E, transparent: true, opacity: .85 })); MS.ring.visible = false; world.add(MS.ring);
  MS.npc = null;
}
function makeBeacon(color, r) { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 6, 32, 1, true).translate(0, 3, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false }));
  const ar = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color })); ar.position.y = 10; g.add(m, ar); g.userData.ar = ar; g.visible = false; world.add(g); return g; }
function showBeacon(b, p) { if (!p) { b.visible = false; return; } b.position.set(p.x, (p.y != null ? p.y : surfaceAt(p.x, p.z, 99)) - .3, p.z); b.visible = true; }
function resolve(to) { if (!to) return null; if (typeof to === 'function') { const p = to(); return p ? Object.assign({}, p, snapRoad(p), { tx: p.x, tz: p.z }) : null; } const p = PL(to); return p ? { x: p.rx, z: p.rz, y: p.ry, label: p.label, tx: p.x, tz: p.z } : null; }
function startMission(m) {
  if (MS.cur) return; if (MS.job) endJob(true);
  MS.cur = m; MS.step = -1; MS.timer = null; MS.data = {}; MS.cargo = null; UI.hideCard(); nextStep();
  UI.toast(m.cat === 'race' ? '競速：' + m.title : '任務開始：' + m.title, m.blurb, 4); AUDIO.sfx('start');
}
function failMission(why) { const m = MS.cur; cleanupMission(); UI.toast('任務失敗', why + '。走返去標記可以再試。', 5); AUDIO.sfx('fail'); }
function cleanupMission() { clearRacers(); if (MS.lead) { hideInst(MS.lead); MS.lead.alive = false; MS.lead.reserved = false; MS.lead = null; } if (MS.npc) { world.remove(MS.npc.group); MS.npc = null; } MS.cur = null; MS.timer = null; MS.cps = null; MS.route = null; MS.cargo = null;
  MS.ring.visible = false; MS.dest.visible = false; MS.pick.visible = false; UI.objective(null); UI.timer(null); UI.sayClose(); }
function completeMission() { const m = MS.cur; save.stats.missions = (save.stats.missions || 0) + 1; const first = !save.done[m.id]; save.done[m.id] = true; const pay = first ? m.reward : Math.round(m.reward * .3); addMoney(pay); persist(); cleanupMission();
  UI.big(m.cat === 'main' ? '任務完成' : m.cat === 'race' ? '完成比賽' : '支線完成', m.title + ' · MOP +' + pay); AUDIO.sfx('done');
  if (m.id === 'm10') setTimeout(() => UI.toast('主線完成', '多謝遊玩！繼續探索、打工、收集葡撻，提升完成度。', 8), 3500); }
function nextStep() { const m = MS.cur; if (!m) return; MS.step++; MS.data = {}; MS.dest.visible = false; MS.pick.visible = false; MS.ring.visible = false; MS.route = null;
  if (MS.step >= m.steps.length) { completeMission(); return; }
  const s = m.steps[MS.step];
  if (s.k === 'say') { UI.say(s.who, s.text, () => nextStep()); return; }
  if (s.k === 'spawn') { const p = PL(s.at); const v = spawnVehicleNear(s.veh, s.color || '#C62828', p.rx, p.rz, true); MS.data.veh = v; nextStep(); return; }
  if (s.k === 'timer') { MS.timer = s.s; nextStep(); return; }
  if (s.k === 'setTime') { if (GAME.time < s.min && GAME.time > 6 * 60) GAME.time = s.min; nextStep(); return; }
  if (s.k === 'go') { MS.data.target = resolve(s.to); if (!MS.data.target) { nextStep(); return; } if (s.cargo) MS.data.cargoAfter = s.cargo; MS.routeT = 0; return; }
  if (s.k === 'collect') { MS.data.list = s.list.map(k => resolve(k)).filter(Boolean); MS.data.got = []; return; }
  if (s.k === 'pass') { MS.data.from = resolve(s.from); MS.data.to = resolve(s.to); MS.data.stage = 'pick'; spawnNPC(MS.data.from); MS.routeT = 0; return; }
  if (s.k === 'photo') { MS.data.target = PL(s.at); return; }
  if (s.k === 'race') { startRace(s.id); return; }
  if (s.k === 'follow') { startFollow(s); return; }
}
function spawnNPC(p) { if (MS.npc) world.remove(MS.npc.group); const def = CHARS[(Math.random() * CHARS.length) | 0]; const ch = makeCharacter(Object.assign({}, def, { style: ['short', 'long', 'bun'][(Math.random() * 3) | 0] }), SHIRTS[(Math.random() * SHIRTS.length) | 0]);
  const rp = roadPos(p.x, p.z, { noBridge: true }); let x = p.x, z = p.z; if (rp) { const nx = -rp.dz, nz = rp.dx; x = rp.x + nx * (rp.hw + 1.4); z = rp.z + nz * (rp.hw + 1.4); }
  ch.group.position.set(x, surfaceAt(x, z, 99) - .02, z); ch.group.rotation.y = Math.random() * 6; world.add(ch.group); MS.npc = ch; }
/* races */
function racePoints(id) { return RACES[id].map(c => { let p; if (typeof c === 'string') { const l = D.lm.find(a => a[0] === c); const r = roadPos(l[5], l[6], { bridge: true }); return { x: r.x, z: r.z, y: r.y }; } p = LL(c[0], c[1]); return snapRoad(p, { maxCls: 2 }); }); }
function startRace(id) { MS.cps = racePoints(id); setTimeout(() => buildRacers(), 0); MS.data.raceId = id; MS.data.i = 1; MS.data.t = 0; MS.data.count = 3.5; MS.data.started = false;
  const s = MS.cps[0]; if (player.mode === 'car') { const c = player.car; const n = MS.cps[1]; c.x = s.x; c.z = s.z; c.y = surfaceAt(s.x, s.z, s.y + 3); c.th = Math.atan2(n.x - s.x, n.z - s.z); c.vx = c.vz = 0; cam.yaw = c.th + Math.PI; } placeCP(); }
function placeCP() { const c = MS.cps[MS.data.i], prev = MS.cps[MS.data.i - 1]; MS.ring.position.set(c.x, c.y + 9.5, c.z); MS.ring.rotation.set(0, Math.atan2(c.x - prev.x, c.z - prev.z), 0); MS.ring.visible = true; MS.routeT = 0; }
/* AI opponents: drive the road route through the checkpoints, slow for corners, rubber-band to the player */
const RACERS = { list: [], route: null, cum: null, cpS: null, vmax: null };
const RACER_NAMES = ['陳伯個孫', '飛仔明', '阿 Ken'], RACER_COLS = ['#2D4F8C', '#F2C14E', '#2E7D5B'];
function clearRacers() { for (const a of RACERS.list) world.remove(a.mesh); RACERS.list = []; RACERS.route = null; }
function buildRacers() { clearRacers(); if (!MS.cps || !MS.cur) return; const cps = MS.cps; let route = [];
  for (let i = 0; i < cps.length - 1; i++) { const r = astar(nearestNode(cps[i].x, cps[i].z), nearestNode(cps[i + 1].x, cps[i + 1].z)); if (!r) return; route = route.concat(i ? r.slice(1) : r); }
  route = route.filter((p, i) => !i || Math.hypot(p[0] - route[i - 1][0], p[1] - route[i - 1][1]) > .5); if (route.length < 3) return;
  const cum = [0]; for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
  const type = player.mode === 'car' ? (player.car.type === 'scooter' ? 'scooter' : 'sport') : 'sport'; const top = CARS[type].maxV * (type === 'sport' ? .8 : .9);
  const vmax = route.map((p, i) => { if (!i || i === route.length - 1) return top; const a = Math.atan2(p[0] - route[i - 1][0], p[1] - route[i - 1][1]), b = Math.atan2(route[i + 1][0] - p[0], route[i + 1][1] - p[1]); let d = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))); return top * clamp(1 - d * .75, .3, 1); });
  for (let i = vmax.length - 2; i >= 0; i--) vmax[i] = Math.min(vmax[i], Math.sqrt(vmax[i + 1] ** 2 + 2 * 7 * (cum[i + 1] - cum[i])));
  const cpS = cps.map(c => { let best = 0, bd = 1e18; route.forEach((p, i) => { const d = (p[0] - c.x) ** 2 + (p[1] - c.z) ** 2; if (d < bd) { bd = d; best = cum[i]; } }); return best; });
  Object.assign(RACERS, { route, cum, cpS, vmax, type });
  for (let k = 0; k < 3; k++) { const mesh = makeCarMesh(type, RACER_COLS[k]); world.add(mesh); RACERS.list.push({ mesh, s: -6 - k * 7, lane: [2.4, -2.4, 0][k], v: 0, skill: [.97, 1.0, .93][k], name: RACER_NAMES[k], done: false, y: player.y, th: 0 }); }
  updateRacers(0, MS.data); }
function routeAt(s) { const R = RACERS.route, cum = RACERS.cum; if (s <= 0) { const a = R[0], b = R[1]; const l = cum[1] || 1; return [a[0] + (b[0] - a[0]) / l * s, a[1] + (b[1] - a[1]) / l * s, (b[0] - a[0]) / l, (b[1] - a[1]) / l, 0]; }
  let lo = 0, hi = cum.length - 1; s = Math.min(s, cum[hi]); while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } const a = R[lo], b = R[hi]; const l = (cum[hi] - cum[lo]) || 1; const t = (s - cum[lo]) / l;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / l, (b[1] - a[1]) / l, lo]; }
function playerS(r) { const k = Math.min(r.i, MS.cps.length - 1); return RACERS.cpS[k] - Math.hypot(MS.cps[k].x - player.x, MS.cps[k].z - player.z); }
function racePlace(r) { if (!RACERS.list.length || !RACERS.route) return 1; const me = playerS(r); return 1 + RACERS.list.filter(a => a.done || a.s > me).length; }
function updateRacers(dt, r) { if (!RACERS.route) return; const L = RACERS.cum[RACERS.cum.length - 1]; const me = playerS(r);
  for (const a of RACERS.list) {
    if (r.started && !a.done) { const p0 = routeAt(Math.max(0, a.s)); let tv = RACERS.vmax[Math.min(RACERS.vmax.length - 1, p0[4] + 1)] * a.skill;
      const gap = a.s - me; if (gap > 120) tv *= .84; else if (gap < -120) tv *= 1.14;
      for (const b of RACERS.list) if (b !== a && b.s > a.s && b.s - a.s < 9 && Math.abs(b.lane - a.lane) < 2) tv = Math.min(tv, b.v);
      a.v += clamp(tv - a.v, -9 * dt, 6.5 * dt); a.s += a.v * dt; if (a.s >= L) { a.done = true; a.s = L; UI.toast(a.name + ' 衝線', '', 2); } }
    else if (a.done) a.v = Math.max(0, a.v - 8 * dt);
    const p = routeAt(a.s); const dx = p[2], dz = p[3]; const x = p[0] + dz * (2.6 + a.lane * .6), z = p[1] - dx * (2.6 + a.lane * .6);
    a.y = surfaceAt(x, z, a.y + 2); const th = Math.atan2(dx, dz); let d = th - a.th; d = Math.atan2(Math.sin(d), Math.cos(d)); a.th += d * Math.min(1, dt * 8 || 1);
    a.x = x; a.z = z; a.mesh.position.set(x, a.y, z); a.mesh.rotation.set(0, a.th, 0); } }
/* follow */
function startFollow(s) { const pts = s.path.map(k => resolve(k)); let route = []; for (let i = 0; i < pts.length - 1; i++) { const r = astar(nearestNode(pts[i].x, pts[i].z), nearestNode(pts[i + 1].x, pts[i + 1].z)); if (r) route = route.concat(r); }
  if (route.length < 2) { nextStep(); return; } const cum = [0]; for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
  const lead = TRAFFIC.find(t => t.type === 'taxi' && !t.reserved); if (!lead) { nextStep(); return; } lead.alive = false; lead.reserved = true; MS.lead = lead; MS.data.route = route; MS.data.cum = cum; MS.data.s = 0; MS.data.lost = 0; MS.data.lose = s.lose; MS.data.v = 0; }
function followPoint(s) { const R = MS.data.route, cum = MS.data.cum; s = clamp(s, 0, cum[cum.length - 1]); let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } const t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1); const a = R[lo], b = R[hi]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, b[0] - a[0], b[1] - a[1]]; }

/* jobs */
function startJob(job) { if (MS.cur) { UI.toast('任務進行中', '完成或放棄目前任務先可以打工。'); return; } if (MS.job) endJob(true);
  MS.job = { def: job, n: 0, earned: 0, stage: 'idle' };
  if (!(player.mode === 'car' && (player.car.type === job.veh || (job.veh === 'sedan' && player.car.type !== 'scooter') || (job.veh === 'taxi' && player.car.type !== 'scooter')))) {
    const v = spawnVehicleNear(job.veh, job.color, player.x, player.z, true); if (v) { v.job = job.id; UI.toast(job.title + '：公司已派車', '車泊咗喺附近路邊（黃色箭咀），上車開工。', 5); MS.job.veh = v; } }
  nextJobRun(); AUDIO.sfx('start'); }
function endJob(silent) { if (!MS.job) return; const j = MS.job; MS.job = null; MS.pick.visible = MS.dest.visible = false; if (MS.npc) { world.remove(MS.npc.group); MS.npc = null; } UI.objective(null); MS.route = null; if (!silent) UI.toast('收工', j.def.title + '：完成 ' + j.n + ' 單，賺咗 MOP ' + j.earned + '。', 5); }
function nextJobRun() { const j = MS.job; const id = j.def.id; const px = player.x, pz = player.z; let from = null, to = null;
  const rpAround = (dmin, dmax) => { for (let t = 0; t < 40; t++) { const a = Math.random() * 6.283, d = dmin + Math.random() * (dmax - dmin); const r = roadPos(px + Math.cos(a) * d, pz + Math.sin(a) * d, { noBridge: true, maxCls: 3 }); if (r && isLand(r.x, r.z)) return r; } return null; };
  const shopIn = (cats, dmin, dmax) => { const c = SHOPS.filter(s => cats.includes(s.cat) && landClass(s.x, s.z) === 1).map(s => ({ s, d: Math.hypot(s.x - px, s.z - pz) })).filter(o => o.d > dmin && o.d < dmax); if (!c.length) return null; const o = c[(Math.random() * c.length) | 0].s; return Object.assign({ label: o.name }, snapRoad(o)); };
  if (id === 'taxi') { const p = rpAround(200, 700); from = p && { x: p.x, z: p.z, y: p.y, label: '路邊截車' }; const lmk = LMS().filter(l => !l.id.startsWith('b-') && isLand(l.x, l.z)).map(l => ({ l, d: Math.hypot(l.x - px, l.z - pz) })).filter(o => o.d > 900 && o.d < 3500);
    if (lmk.length && Math.random() < .55) { const o = lmk[(Math.random() * lmk.length) | 0].l; to = Object.assign({ label: o.zh }, snapRoad(o)); } else { const q = rpAround(1000, 2800); to = q && { x: q.x, z: q.z, y: q.y, label: (streetAt(q.x, q.z) || '目的地') }; } }
  if (id === 'food') { from = shopIn(['a:restaurant', 'a:fast_food', 'a:cafe', 's:bakery'], 50, 900); const p = W.plates.filter(q => Math.hypot(q[0] - (from ? from.x : px), q[1] - (from ? from.z : pz)) < 1600 && Math.hypot(q[0] - (from ? from.x : px), q[1] - (from ? from.z : pz)) > 300);
    if (p.length) { const q = p[(Math.random() * p.length) | 0]; to = Object.assign({ label: S(q[5]) }, snapRoad({ x: q[0], z: q[1] })); } }
  if (id === 'cargo') { from = shopIn(['s:supermarket', 'a:marketplace', 's:variety_store'], 50, 1200); to = shopIn(['s:convenience', 's:bakery', 's:chemist', 'a:pharmacy', 's:clothes'], 600, 2500); }
  if (id === 'tour') { const st = LRT.stations.concat(SHOPS.filter(s => s.cat === 't:hotel').map(s => ({ name: s.name, ex: s.x, ez: s.z }))).map(s => ({ s, d: Math.hypot(s.ex - px, s.ez - pz) })).filter(o => o.d < 1200).sort((a, b) => a.d - b.d);
    const s0 = st.length ? st[(Math.random() * Math.min(6, st.length)) | 0].s : null; from = s0 && Object.assign({ label: s0.name }, snapRoad({ x: s0.ex, z: s0.ez }));
    const lm = LMS().filter(l => !l.id.startsWith('b-') && isLand(l.x, l.z) && Math.hypot(l.x - px, l.z - pz) > 700 && Math.hypot(l.x - px, l.z - pz) < 4000); const o = lm[(Math.random() * lm.length) | 0]; to = o && Object.assign({ label: o.zh }, snapRoad(o)); }
  if (!from || !to) { UI.toast('附近暫時冇生意', '揸去第二區再試。'); endJob(true); return; }
  j.from = from; j.to = to; j.stage = 'pick'; j.t0 = GAME.clock; showBeacon(MS.pick, from); MS.routeT = 0; if (id !== 'cargo' && id !== 'food') spawnNPC(from); }
function jobPay(j) { const path = astar(nearestNode(j.from.x, j.from.z), nearestNode(j.to.x, j.to.z)); const L = path ? routeLen(path) : Math.hypot(j.to.x - j.from.x, j.to.z - j.from.z) * 1.3;
  if (j.def.id === 'taxi') return { L, pay: L <= 1600 ? 21 : 21 + Math.ceil((L - 1600) / 220) * 2 };
  if (j.def.id === 'food') return { L, pay: Math.round(22 + L / 1000 * 8) };
  if (j.def.id === 'cargo') return { L, pay: Math.round(40 + L / 1000 * 10) };
  return { L, pay: Math.round(55 + L / 1000 * 9) }; }

/* ---------- per-frame ---------- */
function inVeh(kind) { if (player.mode !== 'car') return false; const t = player.car.type; if (kind === 'any') return true; if (kind === 'scooter') return t === 'scooter'; if (kind === 'car') return true; return t === kind; }
function updateMissions(dt) {
  const px = player.x, pz = player.z, py = player.y; const spd = player.mode === 'car' ? Math.hypot(player.car.vx, player.car.vz) : 0;
  // start markers
  let near = null, nd = 1e9;
  for (const mk of MS.markers) { const avail = !MS.cur && !MS.job && missionAvailable(mk.m); mk.g.visible = avail && Math.hypot(mk.p.x - px, mk.p.z - pz) < 1800; if (!avail) continue;
    mk.sp.position.y = 4.6 + Math.sin(GAME.clock * 2 + mk.p.x) * .3; mk.sp.visible = Math.hypot(mk.p.x - camera.position.x, mk.p.z - camera.position.z) > 9; const dd = Math.hypot(mk.p.x - px, mk.p.z - pz); if (dd < (player.mode === 'car' ? 9 : 5.5) && spd < 5 && dd < nd) { nd = dd; near = mk.m; } }
  MS.nearStart = near;
  for (const b of [MS.dest, MS.pick, MS.wp]) if (b.visible) { b.userData.ar.position.y = 10 + Math.sin(GAME.clock * 3) * .8; b.userData.ar.rotation.y += dt * 2; }
  if (MS.ring.visible) MS.ring.rotation.z += dt * .6;
  // timer
  if (MS.cur && MS.timer != null) { MS.timer -= dt; UI.timer(MS.timer); if (MS.timer <= 0) { failMission('時間到'); return; } } else UI.timer(null);
  // current mission step
  const m = MS.cur;
  if (m) { const s = m.steps[MS.step]; if (!s) return;
    if (s.k === 'go') { const t = MS.data.target; showBeacon(MS.dest, t); const d = Math.hypot(t.x - px, t.z - pz); const d2 = t.tx != null ? Math.hypot(t.tx - px, t.tz - pz) : d;
      let hint = ''; if (s.foot && player.mode === 'car') hint = '（要落車步行）'; if (s.veh && !inVeh(s.veh)) hint = s.veh === 'scooter' ? '（要揸電單車）' : '（要揸車）';
      UI.objective(m.title, s.text + (t.label ? '：' + t.label : ''), Math.round(Math.min(d, d2)) + ' m' + hint + (MS.cargo ? ' · 攜帶：' + MS.cargo : ''));
      if (Math.min(d, d2) < s.r && !hint) { if (MS.data.cargoAfter) MS.cargo = MS.data.cargoAfter; else MS.cargo = null; AUDIO.sfx('ok'); nextStep(); } }
    else if (s.k === 'enter') { const v = MS.data.veh || null; UI.objective(m.title, s.text, ''); if (inVeh(s.veh)) nextStep(); else if (m.steps[MS.step - 1] && m.steps[MS.step - 1].k === 'spawn') { const pv = PARKED.find(c => c.keep && c.type === s.veh); if (pv) { showBeacon(MS.pick, { x: pv.x, z: pv.z, y: pv.y }); } } }
    else if (s.k === 'need') { if (inVeh(s.veh)) { nextStep(); return; } UI.objective(m.title, s.text, '附近路邊泊住嘅車都可以用（按 F）'); }
    else if (s.k === 'collect') { const L = MS.data.list.filter((_, i) => !MS.data.got.includes(i)); let nd = 1e9;
      MS.data.list.forEach((t, i) => { if (MS.data.got.includes(i)) return; const d = Math.min(Math.hypot(t.x - px, t.z - pz), Math.hypot(t.tx - px, t.tz - pz)); nd = Math.min(nd, d); if (d < s.r && !(s.foot && player.mode === 'car')) { MS.data.got.push(i); AUDIO.sfx('ok'); UI.toast('攞到：' + t.label, '', 2); } });
      const rest = MS.data.list.filter((_, i) => !MS.data.got.includes(i)); if (!rest.length) { nextStep(); return; }
      const nt = rest.reduce((a, b) => Math.hypot(a.x - px, a.z - pz) < Math.hypot(b.x - px, b.z - pz) ? a : b); showBeacon(MS.dest, nt); MS.data.target = nt;
      UI.objective(m.title, s.text, '尚欠：' + rest.map(r => r.label).join('、') + ' · ' + Math.round(nd) + ' m' + (s.foot && player.mode === 'car' ? '（要落車）' : '')); }
    else if (s.k === 'pass') { const st = MS.data.stage;
      if (st === 'pick') { const t = MS.data.from; showBeacon(MS.pick, t); const d = Math.hypot(t.x - px, t.z - pz); UI.objective(m.title, s.text + '：去 ' + (t.label || '') + ' 接 ' + s.who, Math.round(d) + ' m' + (player.mode !== 'car' ? '（要揸車）' : ''));
        if (d < 9 && player.mode === 'car' && spd < 3) { MS.data.stage = 'drop'; if (MS.npc) { world.remove(MS.npc.group); MS.npc = null; } AUDIO.sfx('ok'); UI.toast(s.who + '上車', '「唔該，去' + (MS.data.to.label || '') + '。」', 3); MS.data.target = MS.data.to; MS.routeT = 0; } }
      else { const t = MS.data.to; showBeacon(MS.dest, t); const d = Math.hypot(t.x - px, t.z - pz); UI.objective(m.title, '送 ' + s.who + ' 去 ' + (t.label || ''), Math.round(d) + ' m');
        if (player.mode !== 'car') { failMission(s.who + '落咗車'); return; }
        if (d < 12 && spd < 4) { AUDIO.sfx('ok'); nextStep(); } } }
    else if (s.k === 'photo') { const t = MS.data.target; const d = Math.min(Math.hypot(t.x - px, t.z - pz), Math.hypot(t.rx - px, t.rz - pz) + 60); showBeacon(MS.dest, d > 150 ? { x: t.rx, z: t.rz, y: t.ry } : null);
      const fx = camTgt.x - camera.position.x, fz = camTgt.z - camera.position.z, fl = Math.hypot(fx, fz) || 1; const tx = t.x - camera.position.x, tz = t.z - camera.position.z, tl = Math.hypot(tx, tz) || 1;
      const facing = (fx * tx + fz * tz) / (fl * tl); MS.data.ok = d < 150 && facing > .86 && player.mode === 'foot';
      UI.objective(m.title, s.text, d > 150 ? Math.round(d) + ' m' : player.mode !== 'foot' ? '先落車' : facing > .86 ? '好角度！按 P 影相' : '轉個方向對住' + (t.label || '目標')); }
    else if (s.k === 'waitTime') { const tm = GAME.time; if (tm >= s.from && tm <= s.to) { nextStep(); return; } UI.objective(m.title, s.text, '而家 ' + fmtClock(tm) + '（暫停選單可以跳過時間）'); }
    else if (s.k === 'race') { const r = MS.data;
      updateRacers(dt, r);
      if (!r.started) { r.count -= dt; UI.bigCount(r.count > .5 ? Math.ceil(r.count - .5) : 'GO'); if (player.mode === 'car') { player.car.vx = player.car.vz = 0; } if (r.count <= 0) { r.started = true; UI.bigCount(null); AUDIO.sfx('go'); } else if (Math.abs(r.count - Math.round(r.count)) < dt) AUDIO.sfx('tick'); }
      else { r.t += dt; const cp = MS.cps[r.i]; const d = Math.hypot(cp.x - px, cp.z - pz); const best = save.best[r.raceId];
        const pl = racePlace(r); UI.objective(m.title, '穿過黃色圓環 · 檢查點 ' + r.i + ' / ' + (MS.cps.length - 1) + (RACERS.list.length ? ' · 第 ' + pl + ' / ' + (RACERS.list.length + 1) + ' 名' : ''), '時間 ' + fmtT(r.t) + ' · ' + Math.round(d) + ' m' + (best ? ' · 最佳 ' + fmtT(best) : ''));
        if (d < 14 && Math.abs(py - cp.y) < 14) { AUDIO.sfx('cp'); r.i++; if (r.i >= MS.cps.length) { const place = 1 + RACERS.list.filter(a => a.done).length; const nb = !best || r.t < best; if (nb) save.best[r.raceId] = r.t; MS.ring.visible = false;
          if (m.cat === 'race' && place > 1) { failMission('第 ' + place + ' 名衝線（' + fmtT(r.t) + '），要攞第一先算贏'); return; }
          UI.toast((place === 1 ? '第一名！' : '第 ' + place + ' 名') + (nb ? ' · 新紀錄' : ''), '用時 ' + fmtT(r.t), 5); nextStep(); } else placeCP(); } } }
    else if (s.k === 'follow') { const r = MS.data; const lead = MS.lead; const L = r.cum[r.cum.length - 1]; const dl = Math.hypot(lead.x - px, lead.z - pz);
      const tv = dl > 90 ? 5 : dl < 25 ? 13 : 10; r.v += (tv - r.v) * Math.min(1, dt * 1.5); r.s = Math.min(L, r.s + r.v * dt); const p = followPoint(r.s); const ll = Math.hypot(p[2], p[3]) || 1; const dx = p[2] / ll, dz = p[3] / ll;
      lead.x = p[0] + dz * 2.2; lead.z = p[1] - dx * 2.2; lead.y = surfaceAt(lead.x, lead.z, 99); lead.th = Math.atan2(dx, dz); placeInst(lead); tPools.taxi.body.instanceMatrix.needsUpdate = true; tPools.taxi.trim.instanceMatrix.needsUpdate = true;
      showBeacon(MS.pick, { x: lead.x, z: lead.z, y: lead.y + 4 }); if (dl > r.lose) { r.lost += dt; if (r.lost > 5) { failMission('跟甩咗架的士'); return; } } else r.lost = 0;
      UI.objective(m.title, '跟住黑色的士（保持 ' + r.lose + ' 米內）', '距離 ' + Math.round(dl) + ' m' + (r.lost > 0 ? ' · 快啲追！' : ''));
      if (r.s >= L - 2 && dl < 50) { nextStep(); } }
  }
  // jobs
  const j = MS.job;
  if (j && !MS.cur) { const vehOk = player.mode === 'car' && (j.def.veh === 'scooter' ? player.car.type === 'scooter' : player.car.type !== 'scooter' || j.def.id === 'food');
    if (j.stage === 'pick') { const t = j.from; const d = Math.hypot(t.x - px, t.z - pz); UI.objective(j.def.title + ' · 第 ' + (j.n + 1) + ' 單', (j.def.id === 'food' ? '去 ' + t.label + ' 取餐' : j.def.id === 'cargo' ? '去 ' + t.label + ' 上貨' : '去 ' + t.label + ' 接客'), Math.round(d) + ' m' + (vehOk ? '' : '（要' + (j.def.veh === 'scooter' ? '揸電單車' : '揸車') + '）') + ' · 已賺 MOP ' + j.earned);
      if (d < 10 && vehOk && spd < 4) { j.stage = 'drop'; MS.pick.visible = false; showBeacon(MS.dest, j.to); if (MS.npc) { world.remove(MS.npc.group); MS.npc = null; } const pr = jobPay(j); j.pay = pr.pay; j.L = pr.L; j.time = Math.round(pr.L / 9 + 30); MS.routeT = 0; AUDIO.sfx('ok');
        UI.toast(j.def.id === 'taxi' ? '乘客上車' : j.def.id === 'tour' ? '旅客上車' : '已取貨', '目的地：' + j.to.label + ' · 約 ' + (pr.L / 1000).toFixed(1) + ' 公里', 3.5); } }
    else if (j.stage === 'drop') { j.time -= dt; const t = j.to; const d = Math.hypot(t.x - px, t.z - pz);
      UI.objective(j.def.title + ' · 送去 ' + t.label, '跟住藍色導航線', Math.round(d) + ' m · 剩 ' + Math.max(0, Math.ceil(j.time)) + ' 秒' + (j.time < 0 ? '（超時）' : '') + ' · ' + (j.def.id === 'taxi' ? '車資' : '報酬') + ' MOP ' + j.pay);
      if (d < 13 && spd < 4 && player.mode === 'car') { const bonus = j.time > 0 ? Math.round(Math.min(j.pay * .5, j.time * .2)) : 0; const tot = j.pay + bonus; addMoney(tot); j.n++; j.earned += tot; save.stats.jobRuns = (save.stats.jobRuns || 0) + 1; MS.dest.visible = false; AUDIO.sfx('done');
        UI.toast('完成第 ' + j.n + ' 單', (j.def.id === 'taxi' ? '車資' : '報酬') + ' MOP ' + j.pay + (bonus ? ' + 準時獎勵 MOP ' + bonus : ''), 4);
        if (j.n === 5 && !save.jobs[j.def.id]) { save.jobs[j.def.id] = true; addMoney(300); persist(); setTimeout(() => UI.big('打工完成', j.def.title + ' · 獎金 MOP 300'), 1200); }
        j.stage = 'wait'; setTimeout(() => { if (MS.job === j) nextJobRun(); }, 1600); } } }
  // navigation route
  let tgt = null;
  if (m) { const s = m.steps[MS.step]; if (s) { if (s.k === 'go' || s.k === 'collect') tgt = MS.data.target; else if (s.k === 'pass') tgt = MS.data.stage === 'pick' ? MS.data.from : MS.data.to; else if (s.k === 'race' && MS.cps) tgt = MS.cps[MS.data.i]; else if (s.k === 'photo' && MS.data.target) tgt = { x: MS.data.target.rx, z: MS.data.target.rz }; } }
  else if (j) tgt = j.stage === 'pick' ? j.from : j.stage === 'drop' ? j.to : null;
  if (!tgt && MS.wpt) tgt = MS.wpt;
  MS.navTarget = tgt;
  MS.routeT -= dt; if (tgt && MS.routeT <= 0) { MS.routeT = 2.5; MS.route = astar(nearestNode(px, pz), nearestNode(tgt.x, tgt.z)); } if (!tgt) MS.route = null;
  if (MS.wpt && Math.hypot(MS.wpt.x - px, MS.wpt.z - pz) < 20) { MS.wpt = null; MS.wp.visible = false; UI.toast('已到達目的地', ''); }
  // collectibles
  MS.lastCheckT -= dt; if (MS.lastCheckT <= 0) { MS.lastCheckT = .25;
    for (const t of TARTS.pos) { if (save.tarts.includes(t.i)) continue; if (Math.hypot(t.x - px, t.z - pz) < 2.6 && Math.abs(t.y - py - 1) < 3) { save.tarts.push(t.i); addMoney(50); AUDIO.sfx('coin'); UI.toast('葡撻 ' + save.tarts.length + ' / ' + TARTS.pos.length, '收集到一個葡撻 · MOP +50', 3); persist(); } }
    for (const l of LMS()) { if (save.lms.includes(l.id)) continue; if (Math.hypot(l.x - px, l.z - pz) < (l.id.startsWith('b-') ? 30 : 55)) { save.lms.push(l.id); addMoney(100); AUDIO.sfx('done'); UI.toast('地標打卡：' + l.zh, l.stat + ' · 已打卡 ' + save.lms.length + ' / ' + LMS().length, 5); persist(); } } }
}
function photoTaken() { const m = MS.cur; if (!m) return false; const s = m.steps[MS.step]; if (!s || s.k !== 'photo') return false; if (MS.data.ok) { AUDIO.sfx('shutter'); UI.flash(); setTimeout(() => nextStep(), 600); return true; } UI.toast('影唔到', '要喺附近落車，對正目標再影。', 2.5); return true; }
function completion() { const main = MISSIONS.filter(m => m.cat === 'main'), side = MISSIONS.filter(m => m.cat === 'side'), race = MISSIONS.filter(m => m.cat === 'race');
  const f = (a, b) => b ? a / b : 0; const c = { main: [main.filter(m => save.done[m.id]).length, main.length], side: [side.filter(m => save.done[m.id]).length, side.length], race: [race.filter(m => save.done[m.id]).length, race.length], job: [JOBS.filter(j => save.jobs[j.id]).length, JOBS.length], tart: [save.tarts.length, TARTS.pos.length], lm: [save.lms.length, LMS().length] };
  c.cat = [save.cats ? save.cats.length : 0, typeof FUN !== 'undefined' && FUN.cats.length ? FUN.cats.length : 30];
  c.pct = Math.round((f(...c.main) * .38 + f(...c.side) * .15 + f(...c.race) * .14 + f(...c.job) * .1 + f(...c.tart) * .08 + f(...c.lm) * .08 + f(...c.cat) * .07) * 100); return c; }
const fmtT = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const fmtClock = m => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = Math.floor(m % 60); return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; };
function addMoney(v) { save.money = Math.max(0, Math.round(save.money + v)); UI.money(v); persist(); }
