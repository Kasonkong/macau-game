'use strict';
/* =====================================================================
   ui: HUD, location panel, toasts, dialogue, mission cards, phone apps,
   minimap & big map (with fast travel), real-shop dialogs, LRT travel,
   character select, settings, pause and stats.
   ===================================================================== */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CAT_LABEL = { main: '主線任務', side: '支線任務', race: '競速', job: '打工' };
const CAT_ICON = { main: '主', side: '支', race: '賽' };
const CAT_COL = { main: 'var(--main)', side: 'var(--side)', race: 'var(--race)', job: 'var(--job)' };
const MK_RANK = { race: 0, side: 1, main: 2 }; let _mks = null; const MKS = () => _mks || (_mks = MS.markers.slice().sort((a, b) => MK_RANK[a.m.cat] - MK_RANK[b.m.cat]));
const keyHint = (k, t) => save.ctl === 'touch' ? '按「' + t + '」' : '按 <kbd>' + k + '</kbd>';

/* ---------- what each kind of real shop sells ---------- */
const SHOP_MENU = {
  conv: [['維他奶', 8, 25], ['寶礦力水特', 12, 45], ['合味道杯麵', 15, 40], ['朱古力', 10, 20]],
  food: [['豬扒包', 45, 70], ['咖喱魚蛋', 22, 35], ['水蟹粥', 68, 90], ['凍檸茶', 20, 30]],
  cafe: [['奶茶', 22, 30], ['鴛鴦', 22, 30], ['咖啡', 30, 35], ['菠蘿油', 20, 35]],
  bake: [['葡撻', 12, 25], ['杏仁餅', 30, 20], ['雞仔餅', 28, 20], ['蛋卷', 40, 25]],
  fast: [['漢堡套餐', 42, 70], ['薯條', 18, 25], ['汽水', 12, 20]],
  med: [['跌打酒', 35, 50], ['運動飲品', 15, 40]],
  ice: [['雪糕', 25, 25], ['芒果冰', 38, 35]]
};
function shopKind(cat) {
  if (/convenience|supermarket|variety_store|beverages|department_store|mall|marketplace/.test(cat)) return 'conv';
  if (/restaurant|food_court|pub|bar/.test(cat)) return 'food';
  if (/cafe|coffee/.test(cat)) return 'cafe';
  if (/bakery|confectionery/.test(cat)) return 'bake';
  if (/fast_food/.test(cat)) return 'fast';
  if (/chemist|pharmacy|clinic/.test(cat)) return 'med';
  if (/ice_cream/.test(cat)) return 'ice';
  if (/clothes|shoes|sports|beauty|hairdresser|cosmetics/.test(cat)) return 'wear';
  if (/hotel|hostel|guest_house/.test(cat)) return 'rest';
  if (/bank|bureau_de_change/.test(cat)) return 'bank';
  return null;
}
const CAT_ZH = { conv: '便利店／超市', food: '餐廳', cafe: '茶餐廳／咖啡店', bake: '餅店', fast: '快餐', med: '藥房', ice: '甜品', wear: '服飾', rest: '酒店', bank: '銀行' };

const UI = {
  toastT: 0, bigT: 0, moneyT: 0, sayCb: null, sayOpen: false, dlgOpen: false, dlgKind: null, phoneOpen: false, mapOpen: false, locT: 0, photos: [], promptHtml: '',
  init() {
    $('menu-btn').addEventListener('click', () => this.pause());
    $('minimap').addEventListener('click', () => this.openMap());
    $('say').addEventListener('click', () => this.sayNext());
    $('ph-home').addEventListener('click', () => this.phoneHome());
    $('map-close').addEventListener('click', () => this.closeMap());
    $('dlg').addEventListener('click', e => { if (e.target === $('dlg') && this.dlgKind !== 'card-lock') this.closeDlg(); });
    $('btn-char').addEventListener('click', () => this.chars());
    $('btn-set').addEventListener('click', () => this.settings());
    $('btn-help').addEventListener('click', () => this.help());
    this.mapInit();
  },
  /* ---------- small HUD pieces ---------- */
  toast(t, s, d) { const el = $('toast'); el.querySelector('.tt').textContent = t; el.querySelector('.ts').textContent = s || ''; el.querySelector('.ts').hidden = !s; el.hidden = false; this.toastT = d || 3.5; },
  big(t, s, d) { const el = $('big'); el.querySelector('.bt').textContent = t; el.querySelector('.bs').textContent = s || ''; el.hidden = false; this.bigT = d || 3.2; },
  bigCount(v) { const el = $('count'); if (v == null) { el.hidden = true; return; } el.textContent = v; el.hidden = false; },
  objective(title, text, sub) { const el = $('mission'); if (!title) { el.hidden = true; return; } el.hidden = false;
    const cat = MS.cur ? MS.cur.cat : MS.job ? 'job' : null; el.style.borderLeftColor = cat ? CAT_COL[cat] : 'var(--accent)';
    $('m-t').textContent = (cat ? CAT_LABEL[cat] + ' · ' : '') + title; $('m-t').style.color = cat ? CAT_COL[cat] : 'var(--accent)'; $('m-m').textContent = text || ''; $('m-s').textContent = sub || ''; },
  timer(t) { const el = $('timer'); if (t == null) { el.hidden = true; return; } el.hidden = false; const s = Math.max(0, Math.ceil(t)); el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); el.classList.toggle('low', t < 20); },
  say(who, text, cb) { const el = $('say'); el.querySelector('.who').textContent = who; el.querySelector('.txt').textContent = text; el.querySelector('.nx').innerHTML = (save.ctl === 'touch' ? '點擊或按「互動」' : '按 <kbd>E</kbd> 或點擊') + '繼續 ›'; el.hidden = false; this.sayCb = cb; this.sayOpen = true; },
  sayNext() { if (!this.sayOpen) return; const cb = this.sayCb; this.sayClose(); AUDIO.sfx('ok'); if (cb) cb(); },
  sayClose() { $('say').hidden = true; this.sayOpen = false; this.sayCb = null; },
  money(v) { $('money-v').textContent = save.money.toLocaleString(); if (!v) return; const d = $('money-d'); d.textContent = (v > 0 ? '+' : '−') + Math.abs(Math.round(v)); d.style.color = v > 0 ? 'var(--good)' : 'var(--warn)'; this.moneyT = 2.5; },
  flash() { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = .85; requestAnimationFrame(() => { f.style.transition = ''; f.style.opacity = 0; }); },
  fade(fn) { const f = $('fade'); f.style.opacity = 1; setTimeout(() => { fn(); setTimeout(() => { f.style.opacity = 0; }, 120); }, 470); },
  prompt(html) { if (html === this.promptHtml) return; this.promptHtml = html; const el = $('prompt'); if (!html) { el.hidden = true; return; } el.innerHTML = html; el.hidden = false; },
  hideCard() { if (this.dlgKind === 'card') this.closeDlg(); },
  tick(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').hidden = true; }
    if (this.bigT > 0) { this.bigT -= dt; if (this.bigT <= 0) $('big').hidden = true; }
    if (this.moneyT > 0) { this.moneyT -= dt; if (this.moneyT <= 0) $('money-d').textContent = ''; }
  },
  hud(dt) {
    const px = player.x, pz = player.z;
    this.locT -= dt; if (this.locT <= 0) { this.locT = .5; const p = parishAt(px, pz); const st = streetAt(px, pz);
      let pr = p ? p.name : isLand(px, pz) ? '澳門' : '海上', pt = p ? p.pt : '';
      $('loc-pr').innerHTML = esc(pr) + (pt ? '<small>' + esc(pt.toUpperCase()) + '</small>' : ''); $('loc-st').textContent = st || (player.y > 8 && player.mode === 'car' && surfaceAt(px, pz, player.y + 1) > groundAt(px, pz) + 2 ? '跨海大橋' : '');
      $('clock').textContent = fmtClock(GAME.time) + ' · ' + ENV.weather + ' ' + ENV.temp + '°'; $('ph-time').textContent = fmtClock(GAME.time); }
    $('stam-v').style.width = player.stamina + '%'; $('stam-v').style.background = player.stamina < 25 ? 'var(--warn)' : 'var(--good)'; $('stam').hidden = player.mode === 'car' && player.stamina > 99;
    const inCar = player.mode === 'car'; $('speedo').hidden = !inCar; if (inCar) { const c = player.car; $('spd').textContent = Math.round(Math.abs(c.vx * Math.sin(c.th) + c.vz * Math.cos(c.th)) * 3.6); ; const d = c.dmg || 0; const bi = $('dmgbar').firstChild; bi.style.width = d + '%'; bi.style.background = d >= 80 ? 'var(--main)' : d >= 50 ? 'var(--warn)' : 'var(--good)'; }
    const st = AUDIO.STATIONS[AUDIO.station]; const rv = inCar && AUDIO.ac && AUDIO.station > 0; $('radio').hidden = !rv; if (rv) $('radio').innerHTML = '♪ <b>' + esc(st.name) + '</b> ' + st.fm;
  },
  /* ---------- dialogs ---------- */
  openDlg(html, kind) { releaseLock(); const sh = $('dlg-sheet'); sh.innerHTML = html; sh.classList.add('arming'); clearTimeout(this._arm); this._arm = setTimeout(() => sh.classList.remove('arming'), 380); $('dlg').hidden = false; this.dlgOpen = true; this.dlgKind = kind || 'dlg'; keys.clear();
    $('dlg-sheet').querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.closeDlg())); const f = $('dlg-sheet').querySelector('.btn.primary, button'); if (f && !isTouchDevice) f.focus({ preventScroll: true }); return $('dlg-sheet'); },
  closeDlg() { $('dlg').hidden = true; this.dlgOpen = false; this.dlgKind = null; keys.clear(); requestLock(); },
  missionCard(m) {
    const best = m.cat === 'race' && save.best[m.id] ? '<span class="eb" style="color:var(--ink-soft)">最佳 ' + fmtT(save.best[m.id]) + '</span>' : '';
    const again = save.done[m.id] ? '（重玩獎勵 30%）' : '';
    const el = this.openDlg('<span class="eb" style="color:' + CAT_COL[m.cat] + '">' + CAT_LABEL[m.cat] + (m.giver ? ' · ' + esc(m.giver) : '') + '</span><h2>' + esc(m.title) + '</h2><p>' + esc(m.blurb) + '</p>' +
      '<div class="row" style="justify-content:space-between"><span class="eb" style="color:var(--accent)">獎勵 MOP ' + m.reward + again + '</span>' + best + '</div>' +
      '<div class="row"><button class="btn primary" id="mc-go" type="button">開始任務</button><button class="btn" type="button" data-close>稍後再嚟</button></div>', 'card');
    el.querySelector('#mc-go').addEventListener('click', () => { this.closeDlg(); startMission(m); });
  },
  shop(s) {
    const k = shopKind(s.cat); const head = '<span class="eb" style="color:var(--accent)">' + esc(CAT_ZH[k] || '商舖') + '</span><h2>' + esc(s.name) + '</h2>';
    if (!shopOpen(s, GAME.time)) { this.openDlg(head + '<p>已經落咗閘收舖。' + (k === 'food' || k === 'fast' ? '營業到凌晨 2 點，朝早 7 點再開。' : '營業時間大約 08:00–23:00，聽朝再嚟啦。') + '便利店同酒店 24 小時營業。</p><div class="row"><button class="btn" type="button" data-close>離開</button></div>', 'shop'); return; }
    const after = () => { this.money(0); };
    if (k && SHOP_MENU[k]) {
      const el = this.openDlg(head + '<p>體力 ' + Math.round(player.stamina) + ' / 100 · 食嘢飲嘢可以回復體力。</p><div class="list">' + SHOP_MENU[k].map((it, i) => '<button class="item" type="button" data-i="' + i + '"><span class="ic" style="background:#8A5A2B">食</span><span class="nm">' + it[0] + '</span><span class="ds">體力 +' + it[2] + '</span><span class="rt">MOP ' + it[1] + '</span></button>').join('') + '</div><div class="row"><button class="btn" type="button" data-close>離開</button></div>', 'shop');
      el.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { const it = SHOP_MENU[k][+b.dataset.i]; if (save.money < it[1]) { this.toast('唔夠錢', '去打工賺錢先。', 2); return; }
        addMoney(-it[1]); player.stamina = Math.min(100, player.stamina + it[2]); save.stamina = player.stamina; AUDIO.sfx('buy'); this.toast('買咗' + it[0], '體力 ' + Math.round(player.stamina) + ' / 100', 2); after(); el.querySelector('p').textContent = '體力 ' + Math.round(player.stamina) + ' / 100 · 食嘢飲嘢可以回復體力。'; }));
      return; }
    if (k === 'wear') {
      const cur = (save.outfit && save.outfit[save.char]) || CHARS[save.char].shirt;
      const el = this.openDlg(head + '<p>換件衫，MOP 120。</p><div class="row" style="gap:10px">' + SHIRTS.map(h => '<button type="button" class="btn" data-h="' + h + '" aria-label="衫色 ' + h + '" style="width:46px;height:46px;padding:0;border-radius:50%;background:' + h + ';border:3px solid ' + (h === cur ? 'var(--accent)' : 'rgb(255 255 255 / .2)') + '"></button>').join('') + '</div><div class="row"><button class="btn" type="button" data-close>離開</button></div>', 'shop');
      el.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', () => { if (b.dataset.h === cur) return; if (save.money < 120) { this.toast('唔夠錢', '換衫要 MOP 120。', 2); return; } addMoney(-120); save.outfit = save.outfit || {}; save.outfit[save.char] = b.dataset.h; persist(); setCharacter(save.char); AUDIO.sfx('buy'); this.closeDlg(); this.toast('換咗新衫', '幾好睇喎！', 2); }));
      return; }
    if (k === 'rest') {
      const el = this.openDlg(head + '<p>喺酒店休息到第二朝 08:00，體力全滿。房租 MOP 280。</p><div class="row"><button class="btn primary" id="rs" type="button">休息 · MOP 280</button><button class="btn" type="button" data-close>離開</button></div>', 'shop');
      el.querySelector('#rs').addEventListener('click', () => { if (MS.cur && MS.timer != null) { this.toast('任務進行中', '而家冇時間休息。', 2); return; } if (save.money < 280) { this.toast('唔夠錢', '房租要 MOP 280。', 2); return; } addMoney(-280); this.closeDlg(); this.fade(() => { GAME.time = 8 * 60 + (GAME.time > 8 * 60 ? 1440 : 0); GAME.time %= 1440; player.stamina = 100; weatherRoll(); }); AUDIO.sfx('ok'); });
      return; }
    if (k === 'bank') { this.openDlg(head + '<p>戶口結餘 MOP ' + save.money.toLocaleString() + '。完成任務、打工同收集葡撻都可以賺錢。</p><div class="row"><button class="btn" type="button" data-close>離開</button></div>', 'shop'); return; }
    this.openDlg(head + '<p>呢間舖頭暫時冇嘢賣俾你，不過佢喺真實澳門都搵到。</p><div class="row"><button class="btn" type="button" data-close>離開</button></div>', 'shop');
  },
  lrt(st) {
    const list = LRT.stations.filter(o => o !== st).map(o => { const h = W.hops[st.wi] ? W.hops[st.wi][o.wi] : 6; return { o, h, fare: lrtFare(st.wi, o.wi) }; }).sort((a, b) => a.h - b.h);
    const el = this.openDlg('<span class="eb" style="color:var(--lrt)">澳門輕軌 · ' + esc(st.name) + '</span><h2>搭輕軌</h2><p>按真實車資計算（按站數分段 MOP 6–12）。行程時間會計入遊戲時鐘。</p><div class="list">' +
      list.map((r, i) => '<button class="item" type="button" data-i="' + i + '"><span class="ic" style="background:var(--lrt)">軌</span><span class="nm">' + esc(r.o.name) + '</span><span class="ds">' + r.h + ' 個站 · 約 ' + (r.h * 2 + 2) + ' 分鐘</span><span class="rt">MOP ' + r.fare + '</span></button>').join('') + '</div><div class="row"><button class="btn" type="button" data-close>離開</button></div>', 'lrt');
    el.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { const r = list[+b.dataset.i]; if (save.money < r.fare) { this.toast('唔夠錢', '車費 MOP ' + r.fare + '。', 2); return; }
      if (MS.cur && MS.cur.steps[MS.step] && ['pass', 'race', 'follow'].includes(MS.cur.steps[MS.step].k)) { this.toast('而家唔得', '任務進行中唔可以搭輕軌。', 2); return; }
      addMoney(-r.fare); save.stats.lrt++; AUDIO.sfx('buy'); this.closeDlg(); this.fade(() => { teleport(r.o.ex, r.o.ez); GAME.time = (GAME.time + r.h * 2 + 2) % 1440; this.toast('到達' + r.o.name, '車費 MOP ' + r.fare + ' · 用時約 ' + (r.h * 2 + 2) + ' 分鐘', 3.5); }); }));
  },
  taxiTo(l) {
    const d = Math.hypot(l.x - player.x, l.z - player.z) * 1.3; const fare = d <= 1600 ? 21 : 21 + Math.ceil((d - 1600) / 220) * 2;
    const el = this.openDlg('<span class="eb" style="color:var(--accent)">快速前往</span><h2>' + esc(l.zh) + '</h2><p>截架的士直接過去，車程約 ' + (d / 1000).toFixed(1) + ' 公里。已打卡嘅地標先可以快速前往。</p><div class="row"><button class="btn primary" id="tx" type="button">搭的士 · MOP ' + fare + '</button><button class="btn" type="button" data-close>取消</button></div>', 'taxi');
    el.querySelector('#tx').addEventListener('click', () => { if (MS.cur) { this.toast('任務進行中', '完成或放棄任務先可以快速前往。', 2.5); return; } if (save.money < fare) { this.toast('唔夠錢', '車資 MOP ' + fare + '。', 2); return; }
      addMoney(-fare); this.closeDlg(); this.closeMap(); this.fade(() => { const r = roadPos(l.x, l.z, { noBridge: true }); if (r) { const nx = r.dz, nz = -r.dx; teleport(r.x + nx * (r.hw + 2.2), r.z + nz * (r.hw + 2.2)); } else teleport(l.x, l.z); GAME.time = (GAME.time + Math.round(d / 400) + 2) % 1440; this.toast('到達' + l.zh, '車資 MOP ' + fare, 3); }); });
  },
  /* ---------- pause / settings / help / chars / stats ---------- */
  pause() {
    if (!GAME.started) return; const c = completion();
    const el = this.openDlg('<span class="eb" style="color:var(--accent)">暫停</span><h2>濠江飛馳</h2><p>完成度 ' + c.pct + '% · MOP ' + save.money.toLocaleString() + ' · ' + fmtClock(GAME.time) + '</p><div class="bar"><i style="width:' + c.pct + '%"></i></div>' +
      '<div class="row"><button class="btn primary" type="button" data-close>繼續遊戲</button><button class="btn" id="p-ph" type="button">手機</button><button class="btn" id="p-st" type="button">統計</button><button class="btn" id="p-set" type="button">設定</button><button class="btn" id="p-help" type="button">操作說明</button></div>' +
      (MS.cur ? '<div class="row"><button class="btn" id="p-quit" type="button">放棄目前任務</button></div>' : MS.job ? '<div class="row"><button class="btn" id="p-quit" type="button">收工</button></div>' : '') +
      '<div class="row"><button class="btn sm" id="p-home" type="button">返回新馬路起點</button><button class="btn sm" id="p-unstuck" type="button">卡住咗？送我去最近嘅路</button></div>', 'pause');
    el.querySelector('#p-ph').addEventListener('click', () => { this.closeDlg(); this.phone(true); });
    el.querySelector('#p-st').addEventListener('click', () => this.stats());
    el.querySelector('#p-set').addEventListener('click', () => this.settings());
    el.querySelector('#p-help').addEventListener('click', () => this.help());
    const q = el.querySelector('#p-quit'); if (q) q.addEventListener('click', () => { if (MS.cur) { cleanupMission(); this.toast('已放棄任務', '隨時可以返去標記再試。'); } else endJob(); this.closeDlg(); });
    el.querySelector('#p-home').addEventListener('click', () => { this.closeDlg(); this.fade(() => spawnHome()); });
    el.querySelector('#p-unstuck').addEventListener('click', () => { this.closeDlg(); unstuck(); });
  },
  settings() {
    const seg = (id, opts, cur) => '<div class="seg" id="' + id + '">' + opts.map(([v, t]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (v === cur) + '">' + t + '</button>').join('') + '</div>';
    const el = this.openDlg('<span class="eb" style="color:var(--accent)">設定</span><h2>設定</h2><div class="set">' +
      '<span>操作方式</span>' + seg('s-ctl', [['keys', '鍵盤'], ['touch', '屏幕按鈕']], save.ctl) +
      '<span>滑鼠鏡頭</span>' + seg('s-ml', [['lock', '直接郁滑鼠'], ['drag', '按住左鍵拖動']], save.mouseLook || 'lock') +
      '<span>滑鼠靈敏度</span>' + seg('s-ms', [['.6', '低'], ['1', '中'], ['1.6', '高']], String(save.mouseSens || 1)) +
      '<span>畫質</span>' + seg('s-q', [['high', '高'], ['mid', '中'], ['low', '低']], save.quality) +
      '<span>聲音</span>' + seg('s-snd', [['1', '開'], ['0', '關']], save.sound ? '1' : '0') +
      '<span>交通違例</span>' + seg('s-fine', [['1', '開'], ['0', '關']], save.fines ? '1' : '0') +
      '<span>自動解像度</span>' + seg('s-ar', [['1', '開'], ['0', '關']], save.autoRes ? '1' : '0') +
      '<span>顯示 FPS</span>' + seg('s-fps', [['1', '開'], ['0', '關']], save.showFps ? '1' : '0') +
      (GAME.started ? '<span>時間</span><div class="row">' + [[8, '早上'], [13, '中午'], [18, '日落'], [21, '夜晚']].map(([h, t]) => '<button class="btn sm" type="button" data-h="' + h + '">' + t + ' ' + h + ':00</button>').join('') + '</div>' +
        '<span>天氣</span>' + seg('s-w', [['晴', '晴'], ['多雲', '多雲'], ['雨', '落雨']], ENV.weather) : '') +
      '</div><p class="note" id="s-note"></p><div class="row"><button class="btn primary" type="button" data-close>完成</button><button class="btn sm" id="s-reset" type="button">清除存檔</button></div>', 'set');
    const wire = (id, fn) => el.querySelector('#' + id) && el.querySelectorAll('#' + id + ' button').forEach(b => b.addEventListener('click', () => { el.querySelectorAll('#' + id + ' button').forEach(o => o.setAttribute('aria-pressed', o === b)); fn(b.dataset.v); }));
    wire('s-ctl', v => { save.ctl = v; persist(); applyControls(); });
    wire('s-ml', v => { save.mouseLook = v; persist(); });
    wire('s-ms', v => { save.mouseSens = +v; persist(); });
    wire('s-q', v => { if (v === save.quality) return; save.quality = v; persist(); el.querySelector('#s-note').innerHTML = '畫質會喺重新載入後生效。<button class="btn sm" type="button" id="s-reload">而家重新載入</button>'; el.querySelector('#s-reload').addEventListener('click', () => { save.time = GAME.time; persist(); location.reload(); }); });
    wire('s-snd', v => { save.sound = v === '1'; persist(); AUDIO.setMuted(!save.sound); });
    wire('s-fine', v => { save.fines = v === '1'; persist(); });
    wire('s-fps', v => { save.showFps = v === '1'; persist(); });
    wire('s-ar', v => { save.autoRes = v === '1'; persist(); if (!save.autoRes && typeof EX !== 'undefined' && renderer) { EX.pr = EX.prBase; renderer.setPixelRatio(EX.pr); renderer.setSize(innerWidth, innerHeight, false); } });
    wire('s-w', v => { ENV.weather = v; ENV.nextWeather = 400; });
    el.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', () => { GAME.time = +b.dataset.h * 60; this.toast('時間調整到 ' + b.dataset.h + ':00', ''); }));
    let armed = false; el.querySelector('#s-reset').addEventListener('click', e => { if (!armed) { armed = true; e.target.textContent = '再按一次確認清除'; return; } try { localStorage.removeItem(SAVE_KEY); } catch (er) {} location.reload(); });
  },
  help() {
    const k = '<dl class="help">' + [['<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向鍵', '行路／揸車（S 剎車同倒車）'], ['<kbd>Shift</kbd>', '衝刺（消耗體力）'], ['<kbd>Space</kbd>', '跳／手掣漂移'], ['<kbd>F</kbd>', '上車／落車'], ['<kbd>E</kbd>', '互動：任務、商舖、輕軌站、對話'], ['<kbd>T</kbd>', '手機'], ['<kbd>M</kbd>', '大地圖（點擊設導航，點已打卡地標可快速前往）'], ['<kbd>Q</kbd>', '轉電台'], ['<kbd>H</kbd>', '響號'], ['<kbd>V</kbd>', '切換鏡頭距離'], ['<kbd>P</kbd>', '相機模式／影相'], ['<kbd>R</kbd>', '車反轉或卡住時重置'], ['<kbd>Esc</kbd>', '暫停'], ['滑鼠', '直接郁滑鼠轉鏡頭（點一下畫面鎖定滑鼠，Esc 放開並暫停）；滾輪拉近拉遠。設定入面可以改返按住左鍵拖動'] ].map(([a, b]) => '<dt>' + a + '</dt><dd>' + b + '</dd>').join('') + '</dl>';
    const t = '<dl class="help">' + [['左下搖桿', '行路／揸車'], ['拖動畫面', '轉鏡頭'], ['上車／落車', '走近車輛時使用'], ['跳／手掣', '行路時跳，揸車時手掣'], ['互動', '任務、商舖、輕軌站、對話'], ['右上一排', '手機、地圖、電台、響號、鏡頭、影相']].map(([a, b]) => '<dt>' + a + '</dt><dd>' + b + '</dd>').join('') + '</dl>';
    this.openDlg('<span class="eb" style="color:var(--accent)">操作說明</span><h2>點樣玩</h2><p>行到地圖上嘅<b style="color:var(--main)">主</b>、<b style="color:var(--side)">支</b>、<b style="color:var(--race)">賽</b>標記按互動接任務；打開手機揀打工；沿途收集葡撻、打卡地標提升完成度。澳門係靠左行車。</p><h3>鍵盤</h3>' + k + '<h3>屏幕按鈕</h3>' + t +'<h3>遊戲手掣（Xbox／PlayStation）</h3><dl class="help">' + [['左搖桿', '行路／方向'], ['右搖桿', '轉鏡頭'], ['RT／LT', '油門／剎車倒車'], ['A／✕', '跳／手掣；選單入面確定'], ['B／○', '返回'], ['X／□', '上車／落車'], ['Y／△', '互動'], ['RB', '衝刺'], ['LB', '響號'], ['十字鍵', '上：手機　下：鏡頭　左：電台　右：影相；選單入面揀項目'], ['View／Share', '地圖'], ['Menu／Options', '暫停']].map(([a, b]) => '<dt>' + a + '</dt><dd>' + b + '</dd>').join('') + '</dl>' + '<div class="row"><button class="btn primary" type="button" data-close>明白</button></div>', 'help');
  },
  charSVG(def, shirt) { const hair = def.style === 'long' ? '<rect x="22" y="12" width="20" height="26" rx="8" fill="' + def.hair + '"/>' : ''; const cap = def.style === 'cap' ? '<rect x="21" y="6" width="22" height="7" rx="3" fill="#C0392B"/><rect x="34" y="10" width="14" height="3" rx="1.5" fill="#C0392B"/>' : '<path d="M21 17a11 11 0 0 1 22 0z" fill="' + def.hair + '"/>' + (def.style === 'bun' ? '<circle cx="32" cy="6" r="4.5" fill="' + def.hair + '"/>' : '');
    return '<svg viewBox="0 0 64 96" width="58" height="86" aria-hidden="true">' + hair + '<rect x="25" y="68" width="6" height="24" fill="' + def.pants + '"/><rect x="33" y="68" width="6" height="24" fill="' + def.pants + '"/><rect x="23" y="90" width="9" height="4" fill="' + def.shoes + '"/><rect x="32" y="90" width="9" height="4" fill="' + def.shoes + '"/><rect x="20" y="36" width="24" height="34" rx="4" fill="' + shirt + '"/><rect x="14" y="38" width="6" height="26" rx="3" fill="' + shirt + '"/><rect x="44" y="38" width="6" height="26" rx="3" fill="' + shirt + '"/><circle cx="32" cy="22" r="11" fill="' + def.skin + '"/>' + cap + '<circle cx="28" cy="23" r="1.3" fill="#2a2420"/><circle cx="36" cy="23" r="1.3" fill="#2a2420"/></svg>'; },
  chars() {
    const el = this.openDlg('<span class="eb" style="color:var(--accent)">角色</span><h2>揀個角色</h2><div class="chars">' + CHARS.map((d, i) => '<button class="char" type="button" data-i="' + i + '" aria-pressed="' + (i === (save.char || 0)) + '"><span class="fig">' + this.charSVG(d, (save.outfit && save.outfit[i]) || d.shirt) + '</span><span class="nm">' + d.name + '</span><span class="ds">' + d.desc + '</span></button>').join('') + '</div><div class="row"><button class="btn primary" type="button" data-close>確定</button></div>', 'chars');
    el.querySelectorAll('.char').forEach(b => b.addEventListener('click', () => { el.querySelectorAll('.char').forEach(o => o.setAttribute('aria-pressed', o === b)); save.char = +b.dataset.i; persist(); if (typeof player !== 'undefined' && player.ch && W) setCharacter(save.char); }));
  },
  stats() { const c = completion(); const row = (t, a) => '<span>' + t + '</span><b>' + a[0] + ' / ' + a[1] + '</b>';
    const bests = Object.keys(save.best).map(k => { const m = MISSIONS.find(q => q.id === k); return m ? '<span>' + esc(m.title) + ' 最佳</span><b>' + fmtT(save.best[k]) + '</b>' : ''; }).join('');
    this.openDlg('<span class="eb" style="color:var(--accent)">統計</span><h2>完成度 ' + c.pct + '%</h2><div class="bar"><i style="width:' + c.pct + '%"></i></div><div class="stat">' + row('主線任務', c.main) + row('支線任務', c.side) + row('競速', c.race) + row('打工（每份完成 5 單）', c.job) + row('葡撻', c.tart) + row('地標打卡', c.lm) + '<span>現金</span><b>MOP ' + save.money.toLocaleString() + '</b>' + bests + '</div><div class="row"><button class="btn primary" type="button" data-close>關閉</button></div>', 'stats'); },
  /* ---------- phone ---------- */
  phone(open) { if (open == null) open = !this.phoneOpen; this.phoneOpen = open; if (open) releaseLock(); else requestLock(); $('phone').hidden = !open; if (open) { $('phone').style.pointerEvents = 'none'; setTimeout(() => $('phone').style.pointerEvents = '', 380); } keys.clear(); if (open) { this.phoneHome(); AUDIO.sfx('door'); } },
  APPS: [['任務', '#E0463A', '任'], ['地圖', '#2F8F5B', '圖'], ['打工', '#2BB37A', '工'], ['輕軌', '#21A598', '軌'], ['電台', '#8E6CC9', '♪'], ['相機', '#3B4A55', '◉'], ['統計', '#F08A24', '%'], ['角色', '#E8577A', '衫'], ['車房', '#C62828', '車'], ['成就', '#C9A04A', '★'], ['設定', '#5A656B', '⚙']],
  phoneHome() { const s = $('ph-scr'); const c = completion();
    s.innerHTML = '<div style="padding:16px 4px 4px"><div style="font-family:var(--f-mono);font-size:44px;font-weight:600;line-height:1">' + fmtClock(GAME.time) + '</div><div style="color:var(--ink-soft);font-size:13px;margin-top:4px">' + ENV.weather + ' ' + ENV.temp + '° · 完成度 ' + c.pct + '% · MOP ' + save.money.toLocaleString() + '</div></div>' +
      '<div class="apps">' + this.APPS.map(([n, col, ic]) => '<button class="app" type="button" data-app="' + n + '"><i style="background:' + col + '">' + ic + '</i>' + n + '</button>').join('') + '</div>';
    s.querySelectorAll('[data-app]').forEach(b => b.addEventListener('click', () => this.app(b.dataset.app))); },
  appHead(t) { return '<div class="ph-h"><button class="back" type="button" id="ph-back" aria-label="返回">‹</button><h4>' + t + '</h4></div>'; },
  app(name) { const s = $('ph-scr'); const back = () => s.querySelector('#ph-back').addEventListener('click', () => this.phoneHome());
    if (name === '地圖') { this.phone(false); this.openMap(); return; }
    if (name === '車房') { EX.appGarage(s, back); return; }
    if (name === '成就') { EX.appAch(s, back); return; }
    if (name === '設定') { this.phone(false); this.settings(); return; }
    if (name === '統計') { this.phone(false); this.stats(); return; }
    if (name === '角色') { this.phone(false); this.chars(); return; }
    if (name === '相機') { s.innerHTML = this.appHead('相機') + '<p style="color:var(--ink-soft);font-size:13px;margin:0">落車後打開相機模式，按 P 或「影相」。最近影嘅相會留喺度（重新載入會清走）。</p><button class="btn primary" type="button" id="cam-on">打開相機模式</button><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + this.photos.map((u, i) => '<a href="' + u + '" download="macau-' + (i + 1) + '.jpg"><img src="' + u + '" alt="遊戲截圖 ' + (i + 1) + '" style="width:100%;border-radius:8px;display:block"></a>').join('') + '</div>'; back();
      s.querySelector('#cam-on').addEventListener('click', () => { this.phone(false); setPhoto(true); }); return; }
    if (name === '電台') { s.innerHTML = this.appHead('電台') + '<div class="list">' + AUDIO.STATIONS.map((st, i) => '<button class="item" type="button" data-i="' + i + '"><span class="ic" style="background:' + (i === AUDIO.station ? '#8E6CC9' : '#3B4A55') + '">' + (i ? '♪' : '✕') + '</span><span class="nm">' + st.name + '</span><span class="ds">' + (st.fm || '收音機關閉') + (i === AUDIO.station ? ' · 播緊' : '') + '</span><span class="rt"></span></button>').join('') + '</div><p style="color:var(--ink-soft);font-size:12px;margin:0">電台只喺車上播放。揸車時按 Q 轉台。</p>'; back();
      s.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { AUDIO.init(); AUDIO.station = +b.dataset.i; save.radio = AUDIO.station; persist(); this.app('電台'); })); return; }
    if (name === '打工') { s.innerHTML = this.appHead('打工') + (MS.job ? '<div class="glass" style="padding:10px 12px;font-size:13px">而家做緊：<b>' + MS.job.def.title + '</b> · 完成 ' + MS.job.n + ' 單 · MOP ' + MS.job.earned + '</div><button class="btn" type="button" id="jb-end">收工</button>' : '') +
      '<div class="list">' + JOBS.map((j, i) => '<button class="item" type="button" data-i="' + i + '"><span class="ic" style="background:var(--job)">工</span><span class="nm">' + j.title + (save.jobs[j.id] ? ' ✓' : '') + '</span><span class="ds">' + j.blurb + '</span><span class="rt"></span></button>').join('') + '</div><p style="color:var(--ink-soft);font-size:12px;margin:0">每份工完成 5 單有獎金 MOP 300，並計入完成度。</p>'; back();
      const e = s.querySelector('#jb-end'); if (e) e.addEventListener('click', () => { endJob(); this.app('打工'); });
      s.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { this.phone(false); startJob(JOBS[+b.dataset.i]); })); return; }
    if (name === '輕軌') { const near = LRT.stations.map(o => ({ o, d: Math.hypot(o.ex - player.x, o.ez - player.z) })).sort((a, b) => a.d - b.d);
      s.innerHTML = this.appHead('輕軌') + '<p style="color:var(--ink-soft);font-size:13px;margin:0">去任何一個車站入口（綠色柱）按互動就可以搭車。點選車站設定導航。</p><div class="list">' + near.map((r, i) => '<button class="item" type="button" data-i="' + i + '"><span class="ic" style="background:var(--lrt)">軌</span><span class="nm">' + esc(r.o.name) + '</span><span class="ds">' + (r.d < 1000 ? Math.round(r.d) + ' 米' : (r.d / 1000).toFixed(1) + ' 公里') + '</span><span class="rt"></span></button>').join('') + '</div>'; back();
      s.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { const o = near[+b.dataset.i].o; setWaypoint(o.ex, o.ez, o.name); this.phone(false); })); return; }
    if (name === '任務') { const grp = ['main', 'side', 'race'].map(cat => '<h3 style="margin:4px 0 0;font-size:11px;letter-spacing:.2em;color:var(--ink-soft)">' + CAT_LABEL[cat] + '</h3>' + MISSIONS.filter(m => m.cat === cat).map(m => { const av = missionAvailable(m), dn = save.done[m.id]; const lock = !av && !dn;
        const p = missionStartPos(m); const d = p ? Math.hypot(p.x - player.x, p.z - player.z) : 0;
        return '<button class="item' + (dn ? ' done' : '') + (lock ? ' lock' : '') + '" type="button" data-id="' + m.id + '"' + (lock ? ' disabled' : '') + '><span class="ic" style="background:' + (lock ? '#3B4A55' : CAT_COL[cat]) + '">' + (dn ? '✓' : CAT_ICON[cat]) + '</span><span class="nm">' + esc(m.title) + '</span><span class="ds">' + (lock ? '完成上一個主線任務後解鎖' : esc(p ? p.label : '') + (m.cat === 'race' && save.best[m.id] ? ' · 最佳 ' + fmtT(save.best[m.id]) : '')) + '</span><span class="rt">' + (lock ? '' : (d < 1000 ? Math.round(d) + 'm' : (d / 1000).toFixed(1) + 'km')) + '</span></button>'; }).join('')).join('');
      s.innerHTML = this.appHead('任務') + (MS.cur ? '<div class="glass" style="padding:10px 12px;font-size:13px">進行中：<b>' + esc(MS.cur.title) + '</b></div>' : '') + '<p style="color:var(--ink-soft);font-size:12px;margin:0">點選任務，導航去起點。</p><div class="list">' + grp + '</div>'; back();
      s.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => { const m = MISSIONS.find(q => q.id === b.dataset.id); const p = missionStartPos(m); if (!p) return; setWaypoint(p.x, p.z, m.title); this.phone(false); this.toast('已設定導航', m.title + ' · ' + p.label, 2.5); })); return; }
  },
  /* ---------- maps ---------- */
  mv: { cx: 0, cz: 0, s: .12 },
  mapInit() {
    const bm = $('bigmap'); const pts = new Map(); let drag = null, pinch = null;
    bm.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); bm.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: 0 }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.mv.s }; } });
    bm.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; this.mv.s = clamp(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, .03, 4); if (drag) drag.moved = 99; this.drawBig(); return; }
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY; this.mv.cx -= dx / this.mv.s; this.mv.cz -= dy / this.mv.s; this.drawBig(); } });
    bm.addEventListener('pointerup', e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (drag && drag.moved < 6 && pts.size === 0) this.mapClick(e.clientX, e.clientY); if (pts.size === 0) drag = null; });
    bm.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; drag = null; });
    bm.addEventListener('wheel', e => { e.preventDefault(); const k = 1 - e.deltaY * .0012; const wx = this.mv.cx + (e.clientX - innerWidth / 2) / this.mv.s, wz = this.mv.cz + (e.clientY - innerHeight / 2) / this.mv.s; this.mv.s = clamp(this.mv.s * k, .03, 4); this.mv.cx = wx - (e.clientX - innerWidth / 2) / this.mv.s; this.mv.cz = wz - (e.clientY - innerHeight / 2) / this.mv.s; this.drawBig(); }, { passive: false });
  },
  openMap() { releaseLock(); this.mapOpen = true; $('mapview').hidden = false; this.mv.cx = player.x; this.mv.cz = player.z; this.mv.s = Math.min(innerWidth, innerHeight) / 3000; keys.clear(); this.drawBig(); },
  closeMap() { this.mapOpen = false; $('mapview').hidden = true; requestLock(); },
  mapClick(cx, cy) { const mv = this.mv; const sx = x => innerWidth / 2 + (x - mv.cx) * mv.s, sz = z => innerHeight / 2 + (z - mv.cz) * mv.s;
    for (const l of LMS()) if (save.lms.includes(l.id) && !l.id.startsWith('b-') && Math.hypot(sx(l.x) - cx, sz(l.z) - cy) < 14) { this.taxiTo(l); return; }
    const x = mv.cx + (cx - innerWidth / 2) / mv.s, z = mv.cz + (cy - innerHeight / 2) / mv.s;
    if (MS.wpt && Math.hypot(sx(MS.wpt.x) - cx, sz(MS.wpt.z) - cy) < 16) { MS.wpt = null; MS.wp.visible = false; MS.route = null; this.drawBig(); return; }
    const r = roadPos(x, z); if (r) setWaypoint(r.x, r.z, streetAt(r.x, r.z) || '目的地'); this.drawBig(); },
  icons(c, sx, sz, inView, mini) {
    const dot = (X, Z, col, r, txt) => { c.beginPath(); c.arc(X, Z, r, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = mini ? 2.5 : 2; c.strokeStyle = '#fff'; c.stroke(); if (txt) { c.fillStyle = '#fff'; c.font = '700 ' + Math.round(r * 1.15) + 'px ' + SIGN_FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, X, Z + 1); } };
    for (const r of repairShops()) { const X = sx(r.x), Z = sz(r.z); if (inView(X, Z)) dot(X, Z, '#8A5A2B', mini ? 8 : 8, '修'); }
    for (const s of LRT.stations) { const X = sx(s.ex), Z = sz(s.ez); if (inView(X, Z)) { c.fillStyle = '#21A598'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.rect(X - (mini ? 7 : 6), Z - (mini ? 7 : 6), mini ? 14 : 12, mini ? 14 : 12); c.fill(); c.stroke(); if (!mini && this.mv.s > .25) { c.fillStyle = '#0E3B36'; c.font = '600 11px ' + SIGN_FONT; c.textAlign = 'center'; c.fillText(s.name, X, Z - 11); } } }
    for (const l of LMS()) { if (save.lms.includes(l.id)) { if (!mini && !l.id.startsWith('b-')) { const X = sx(l.x), Z = sz(l.z); if (inView(X, Z)) { c.beginPath(); c.arc(X, Z, 4.5, 0, 7); c.fillStyle = 'rgba(242,193,78,.8)'; c.fill(); c.strokeStyle = '#1B1606'; c.lineWidth = 1.5; c.stroke(); if (this.mv.s > .3) { c.fillStyle = '#3a2c05'; c.font = '600 11px ' + SIGN_FONT; c.textAlign = 'center'; c.fillText(l.zh, X, Z - 9); } } } continue; }
      const X = sx(l.x), Z = sz(l.z); if (inView(X, Z)) dot(X, Z, '#F2C14E', mini ? 6 : 6); }
    if (!MS.cur && !MS.job) for (const mk of MKS()) { if (!missionAvailable(mk.m)) continue; const X = sx(mk.p.x), Z = sz(mk.p.z); if (inView(X, Z)) dot(X, Z, MK_COLORS[mk.m.cat], mini ? 10 : 10, CAT_ICON[mk.m.cat]); }
    const nav = MS.navTarget; if (nav) { const X = sx(nav.x), Z = sz(nav.z); return { X, Z }; } return null; },
  drawBig() { const bm = $('bigmap'); const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1); bm.width = w * dpr; bm.height = h * dpr; const c = bm.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mv = this.mv; c.fillStyle = '#173B4B'; c.fillRect(0, 0, w, h); const sx = x => w / 2 + (x - mv.cx) * mv.s, sz = z => h / 2 + (z - mv.cz) * mv.s; c.imageSmoothingEnabled = true; c.drawImage(MAPC, sx(MX0), sz(MZ0), MW * MPP * mv.s, MH * MPP * mv.s);
    if (MS.route) { c.beginPath(); MS.route.forEach((p, i) => i ? c.lineTo(sx(p[0]), sz(p[1])) : c.moveTo(sx(p[0]), sz(p[1]))); c.strokeStyle = '#2F7CF6'; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke(); }
    const inView = (X, Z) => X > -20 && Z > -20 && X < w + 20 && Z < h + 20;
    if (mv.s > 1.1) { c.font = '500 10.5px ' + SIGN_FONT; c.textAlign = 'center'; let n = 0; for (const s of SHOPS) { const X = sx(s.x), Z = sz(s.z); if (!inView(X, Z)) continue; if (++n > 260) break; c.beginPath(); c.arc(X, Z, 2.6, 0, 7); c.fillStyle = '#C0533A'; c.fill(); if (mv.s > 1.8) { c.fillStyle = '#4a2a1e'; c.fillText(s.name, X, Z - 5); } } }
    const nav = this.icons(c, sx, sz, inView, false);
    if (nav) { c.beginPath(); c.arc(nav.X, nav.Z, 9, 0, 7); c.fillStyle = '#2F7CF6'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke(); }
    c.save(); c.translate(sx(player.x), sz(player.z)); c.rotate(Math.PI - player.th); c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fillStyle = '#FF5A4E'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.restore(); },
  drawMini() { const mm = $('minimap'); const c = mm.getContext('2d'); const Wd = mm.width, R = Wd / 2, range = player.mode === 'car' ? 380 : 230, s = R / range; const px = player.x, pz = player.z;
    c.save(); c.clearRect(0, 0, Wd, Wd); c.beginPath(); c.arc(R, R, R, 0, 7); c.clip(); c.fillStyle = '#173B4B'; c.fillRect(0, 0, Wd, Wd);
    const rot = cam.yaw; // camera's forward direction points up
    c.translate(R, R); c.rotate(rot); c.scale(s, s); c.translate(-px, -pz); c.imageSmoothingEnabled = true;
    { const e = range * 1.45; let x0 = Math.max(0, Math.floor((px - e - MX0) / MPP)), z0 = Math.max(0, Math.floor((pz - e - MZ0) / MPP)); const x1 = Math.min(MW, Math.ceil((px + e - MX0) / MPP)), z1 = Math.min(MH, Math.ceil((pz + e - MZ0) / MPP));
      if (x1 > x0 && z1 > z0) c.drawImage(MAPC, x0, z0, x1 - x0, z1 - z0, MX0 + x0 * MPP, MZ0 + z0 * MPP, (x1 - x0) * MPP, (z1 - z0) * MPP); }
    if (MS.route) { c.beginPath(); MS.route.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.strokeStyle = '#2F7CF6'; c.lineWidth = 9 / s; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
    for (const t of TRAFFIC) if (t.alive && Math.abs(t.x - px) < range && Math.abs(t.z - pz) < range) { c.fillStyle = '#E6E6E6'; c.fillRect(t.x - 2.5, t.z - 2.5, 5, 5); }
    for (const t of TARTS.pos) if (!save.tarts.includes(t.i) && Math.abs(t.x - px) < 160 && Math.abs(t.z - pz) < 160) { c.beginPath(); c.arc(t.x, t.z, 4 / s, 0, 7); c.fillStyle = '#F5C542'; c.fill(); }
    c.restore();
    // icons in screen space (rotated positions), clamped to edge for nav target
    const cs = Math.cos(rot), sn = Math.sin(rot); const P = (x, z) => { const dx = (x - px) * s, dz = (z - pz) * s; return [R + dx * cs - dz * sn, R + dx * sn + dz * cs]; };
    const dot = (x, z, col, r, txt, clampEdge) => { let [X, Z] = P(x, z); const dx = X - R, dz = Z - R, d = Math.hypot(dx, dz); if (d > R - r - 3) { if (!clampEdge) return; X = R + dx / d * (R - r - 3); Z = R + dz / d * (R - r - 3); }
      c.beginPath(); c.arc(X, Z, r, 0, 7); c.fillStyle = col; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke(); if (txt) { c.fillStyle = '#fff'; c.font = '700 ' + Math.round(r * 1.2) + 'px ' + SIGN_FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, X, Z + 1); } };
    for (const st of LRT.stations) dot(st.ex, st.ez, '#21A598', 7, '軌');
    if (player.car && (player.car.dmg || 0) >= 30) for (const r of repairShops()) dot(r.x, r.z, '#8A5A2B', 8, '修', player.car.dmg >= 50);
    for (const l of LMS()) if (!save.lms.includes(l.id)) dot(l.x, l.z, '#F2C14E', 6);
    if (!MS.cur && !MS.job) for (const mk of MKS()) if (missionAvailable(mk.m)) dot(mk.p.x, mk.p.z, MK_COLORS[mk.m.cat], 11, CAT_ICON[mk.m.cat], mk.m.cat === 'main');
    if (MS.navTarget) dot(MS.navTarget.x, MS.navTarget.z, '#2F7CF6', 9, '', true);
    c.save(); c.translate(R, R); c.rotate(rot + Math.PI - player.th); c.beginPath(); c.moveTo(0, -13); c.lineTo(9, 10); c.lineTo(0, 5); c.lineTo(-9, 10); c.closePath(); c.fillStyle = '#FF5A4E'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke(); c.restore();
    const nX = R + (R - 15) * Math.sin(rot), nZ = R - (R - 15) * Math.cos(rot);
    c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.arc(nX, nZ, 11, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = '700 15px "IBM Plex Mono",monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', nX, nZ + 1);
    c.beginPath(); c.arc(R, R, R - 1.5, 0, 7); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3; c.stroke(); }
};
