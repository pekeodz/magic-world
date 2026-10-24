// ============================================================
//  MAGIC WORLD — engine: vòng lặp, chiến đấu, AI, render
// ============================================================
'use strict';

const G = {
  cv: null, cx: null, zoom: 2, dpr: 1, vw: 0, vh: 0,
  world: null, mapCv: null, cam: { x: 0, y: 0 }, shake: 0,
  mons: [], projs: [], zones: [], drops: [], fx: [], texts: [], timers: [], chests: [],
  door: null, paused: true, running: false, dead: false, t: 0,
  flow: null, flowT: 0, explored: null, exploreT: 0,
  keys: {}, mouse: { x: 0, y: 0, down: false, last: -99, inside: false }, joy: { x: 0, y: 0, active: false },
  attackHeld: false, touch: false, prompt: null, bossRef: null, saveT: 0, muted: false,
  shopStock: [],
};
let P = null; // người chơi runtime

// ---------- Âm thanh tổng hợp ----------
let AC = null;
function sfx(type) {
  if (G.muted) return;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    const S = {
      swing: [320, 120, 0.08, 'triangle', 0.08], hit: [180, 60, 0.1, 'square', 0.07], crit: [520, 90, 0.14, 'square', 0.09],
      shoot: [700, 300, 0.07, 'triangle', 0.06], magic: [500, 900, 0.15, 'sine', 0.08], coin: [900, 1400, 0.09, 'sine', 0.06],
      hurt: [140, 60, 0.15, 'sawtooth', 0.08], boom: [90, 30, 0.35, 'sawtooth', 0.12], level: [440, 880, 0.5, 'triangle', 0.1],
      pick: [600, 900, 0.07, 'sine', 0.05], door: [200, 500, 0.4, 'sine', 0.08], heal: [400, 800, 0.3, 'sine', 0.07],
      die: [300, 40, 0.3, 'sawtooth', 0.07], ui: [800, 800, 0.04, 'square', 0.03], fail: [200, 120, 0.25, 'square', 0.07],
    }[type] || [400, 200, 0.1, 'sine', 0.05];
    o.type = S[3];
    o.frequency.setValueAtTime(S[0], t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, S[1]), t0 + S[2]);
    g.gain.setValueAtTime(S[4], t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + S[2] + 0.05);
    o.start(t0); o.stop(t0 + S[2] + 0.06);
  } catch (e) { /* bỏ qua */ }
}

// ---------- Khởi tạo canvas ----------
function initCanvas() {
  G.cv = document.getElementById('game');
  G.cx = G.cv.getContext('2d');
  const resize = () => {
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    G.cv.width = Math.floor(innerWidth * G.dpr);
    G.cv.height = Math.floor(innerHeight * G.dpr);
    G.cv.style.width = innerWidth + 'px';
    G.cv.style.height = innerHeight + 'px';
    const base = innerWidth < 700 ? 1.5 : (innerWidth < 1800 ? 2 : 2.5);
    G.zoom = base * G.dpr;
    G.vw = G.cv.width / G.zoom; G.vh = G.cv.height / G.zoom;
    G.lightCv = G.lightCv || document.createElement('canvas');
    G.lightCv.width = G.cv.width; G.lightCv.height = G.cv.height;
  };
  addEventListener('resize', resize);
  resize();
  G.tmp = document.createElement('canvas');
  G.tmpx = G.tmp.getContext('2d');
}

// ---------- Input ----------
function initInput() {
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    G.keys[k] = true;
    if (!G.running) return;
    if (UI.anyPanelOpen() && k !== 'escape' && !['i', 'k', 'c'].includes(k)) return;
    if (['1', '2', '3', '4'].includes(k)) useSkill(+k - 1);
    if (k === 'q') usePotion('hp');
    if (k === 'r') usePotion('mp');
    if (k === 'e' || k === 'f') interact();
    if (k === 't') startPortal();
    if (k === 'i' || k === 'b') UI.togglePanel('inv');
    if (k === 'k') UI.togglePanel('skills');
    if (k === 'c') UI.togglePanel('char');
    if (k === 'm') { G.muted = !G.muted; UI.toast(G.muted ? 'Đã tắt âm thanh' : 'Đã bật âm thanh'); }
    if (k === 'escape') UI.escape();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { G.keys = {}; G.mouse.down = false; });
  const cv = G.cv;
  cv.addEventListener('mousemove', e => { G.mouse.x = e.clientX; G.mouse.y = e.clientY; G.mouse.last = G.t; G.mouse.inside = true; });
  cv.addEventListener('mouseleave', () => { G.mouse.inside = false; G.mouse.down = false; });
  cv.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    G.mouse.x = e.clientX; G.mouse.y = e.clientY; G.mouse.last = G.t; G.mouse.down = true;
    // click NPC / cửa
    const w = screenToWorld(e.clientX, e.clientY);
    if (G.prompt && G.prompt.target && Math.hypot(w.x - G.prompt.target.x, w.y - (G.prompt.target.y - 20)) < 40) { interact(); G.mouse.down = false; }
  });
  addEventListener('mouseup', () => { G.mouse.down = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
}
function screenToWorld(sx, sy) { return { x: G.cam.x + sx * G.dpr / G.zoom, y: G.cam.y + sy * G.dpr / G.zoom }; }
function mouseAim() { return !G.touch && G.mouse.inside && (G.t - G.mouse.last < 4); }

// ---------- Vào thế giới ----------
function startGame(ch) {
  P = {
    ch, x: 0, y: 0, r: 10, dir: DIR.DOWN, anim: 'idle', animT: 0, animDur: 0.6, moving: false,
    atkCd: 0, castLock: 0, skillCd: {}, buffs: [], st: null, hp: 1, mp: 1,
    status: {}, flash: 0, invuln: 0, dash: null, potCd: { hp: 0, mp: 0 }, portal: null, regenAcc: 0, hurtT: 0,
  };
  recalc(true);
  Look.ensure(ch);
  G.running = true; G.dead = false; G.paused = false;
  refreshShop();
  enterTown();
  UI.showHUD(true);
  UI.refreshAll();
}
function recalc(full) {
  P.st = calcStats(P.ch, P.buffs);
  if (full) { P.hp = P.st.maxHp; P.mp = P.st.maxMp; }
  P.hp = Math.min(P.hp, P.st.maxHp); P.mp = Math.min(P.mp, P.st.maxMp);
}
function clearWorld() {
  G.mons = []; G.projs = []; G.zones = []; G.drops = []; G.fx = []; G.texts = []; G.timers = []; G.chests = [];
  G.door = null; G.bossRef = null; G.prompt = null; P.dash = null; P.portal = null; P.status = {};
  UI.bossBar(null);
}
function enterTown() {
  clearWorld();
  G.world = genTown();
  G.mapCv = renderMapCanvas(G.world);
  P.x = G.world.start.cx * TILE; P.y = G.world.start.cy * TILE; P.dir = DIR.UP;
  P.buffs = []; recalc(true);
  G.explored = null;
  refreshShop();
  UI.setLocation(G.world.biome.name, null);
  UI.showBanner('Thị Trấn Khởi Nguyên', 'An toàn · Hồi phục toàn bộ');
  saveGame();
}
function enterFloor(floor) {
  clearWorld();
  const w = genDungeon(floor);
  G.world = w;
  G.mapCv = renderMapCanvas(w);
  G.explored = new Uint8Array(w.grid.w * w.grid.h);
  P.x = (w.start.cx + 0.5) * TILE; P.y = (w.start.cy + 0.5) * TILE;
  if (w.boss) { P.x = (w.start.cx + 0.5) * TILE; P.y = (w.start.y + 2.5) * TILE; P.dir = DIR.UP; }
  P.ch.maxFloor = Math.max(P.ch.maxFloor, floor);
  G.flowT = 0;
  populate(w, floor);
  UI.setLocation(w.biome.name, floor);
  UI.showBanner(`Tầng ${floor}`, w.boss ? `⚠ Hang Ổ Boss — ${BOSSES[bossOf(floor)].name}` : w.biome.name);
  sfx('door');
  saveGame();
}
function populate(w, floor) {
  const sc = floorScale(floor);
  if (w.boss) {
    const a = w.arena;
    spawnBoss(bossOf(floor), (a.cx + 0.5) * TILE, (a.y + 6) * TILE, floor);
    return;
  }
  for (const r of w.rooms) {
    if (r === w.start) continue;
    const n = randi(2, 4) + Math.floor(floor / 7) + (r === w.exit ? 2 : 0);
    const packMob = pick(w.biome.mobs);
    for (let i = 0; i < n; i++) {
      const key = Math.random() < 0.6 ? packMob : pick(w.biome.mobs);
      const tx = randi(r.x + 1, r.x + r.w - 2), ty = randi(r.y + 1, r.y + r.h - 2);
      if (gget(w.grid, tx, ty) !== T_FLOOR) continue;
      spawnMonster(key, (tx + 0.5) * TILE, (ty + 0.5) * TILE, floor, Math.random() < 0.06 + floor * 0.002);
    }
    if (r !== w.exit && Math.random() < 0.3) {
      G.chests.push({ x: (r.x + 1.5) * TILE, y: (r.y + 1.6) * TILE, opened: false, rich: Math.random() < 0.15 });
    }
  }
  G.door = { x: (w.exit.cx + 0.5) * TILE, y: (w.exit.cy + 0.5) * TILE, open: true };
}
function spawnMonster(key, x, y, floor, elite) {
  const d = MONSTERS[key];
  const sc = floorScale(floor);
  const em = elite ? { hp: 2.8, atk: 1.4, xp: 4, scale: 1.25 } : { hp: 1, atk: 1, xp: 1, scale: 1 };
  const m = {
    id: uid(), key, d, spr: SPR[d.spr], x, y, r: d.r * em.scale, home: { x, y },
    maxHp: Math.round(d.hp * sc.hp * em.hp), atk: d.atk * sc.atk * em.atk, defv: d.def * sc.def,
    spd: d.spd * (elite ? 1.08 : 1), xp: Math.round(d.xp * sc.xp * em.xp), elite, boss: false, scale: (d.scale || 1) * em.scale,
    dir: DIR.DOWN, state: 'idle', t: rand(0, 2), cd: rand(0.5, 1.5), aggro: false, animT: rand(0, 1), flash: 0,
    status: {}, kb: { x: 0, y: 0 }, wander: null, floor, name: (elite ? 'Tinh Anh · ' : '') + d.name,
  };
  m.hp = m.maxHp;
  G.mons.push(m);
  return m;
}
function spawnBoss(key, x, y, floor) {
  const d = BOSSES[key];
  const cyc = Math.floor((floor - 1) / 20); // vòng lặp sau tầng 20
  const sc = floorScale(floor);
  const base = { 5: 1, 10: 1, 15: 1, 20: 1 };
  const k = 1 + cyc * 0.9;
  const hpMul = (floor <= 20 ? 1 : (sc.hp / floorScale((floor - 1) % 20 + 1).hp)) * k;
  const m = {
    id: uid(), key, d, spr: SPR[d.spr], x, y, r: d.r, home: { x, y },
    maxHp: Math.round(d.hp * hpMul), atk: d.atk * (floor <= 20 ? 1 : sc.atk / floorScale((floor - 1) % 20 + 1).atk) * (1 + cyc * 0.3), defv: d.def * (1 + cyc * 0.4),
    spd: d.spd, xp: Math.round(d.xp * k), elite: false, boss: true, scale: d.scale, dir: DIR.DOWN, state: 'idle', t: 0, cd: 1.5,
    aggro: false, animT: 0, flash: 0, status: {}, kb: { x: 0, y: 0 }, floor, name: (cyc > 0 ? 'Ma Hóa · ' : '') + d.name,
    pt: 2, phase: 1, act: null, actT: 0, summons: 0,
  };
  m.hp = m.maxHp;
  G.mons.push(m);
  G.bossRef = m;
  return m;
}

// ---------- Cửa hàng ----------
function refreshShop() {
  if (!P) return;
  const L = Math.max(1, Math.min(P.ch.maxFloor + 1, P.ch.lvl));
  G.shopStock = [];
  for (let i = 0; i < 6; i++) {
    const r = Math.random() < 0.15 ? 2 : (Math.random() < 0.5 ? 1 : 0);
    const it = genItem(L, { rarity: r, cls: P.ch.cls });
    G.shopStock.push(it);
  }
  // luôn có 1 vũ khí đúng class
  G.shopStock[0] = genItem(L, { slot: 'weapon', wtype: CLASS_WEAPON[P.ch.cls], rarity: Math.random() < 0.3 ? 2 : 1 });
}

// ---------- Lưu ----------
function saveGame() {
  if (!P) return;
  const arr = Save.data.chars;
  const i = arr.findIndex(c => c.id === P.ch.id);
  if (i >= 0) arr[i] = P.ch; else arr.push(P.ch);
  Save.store();
}

// ---------- Va chạm ----------
function solidAt(px, py) {
  const g = G.world.grid;
  return !walkable(gget(g, Math.floor(px / TILE), Math.floor(py / TILE)));
}
function boxFree(x, y, r) {
  return !solidAt(x - r, y - r * 0.6) && !solidAt(x + r, y - r * 0.6) && !solidAt(x - r, y + r * 0.5) && !solidAt(x + r, y + r * 0.5);
}
function moveEnt(e, dx, dy) {
  const r = Math.min(e.r, 13);
  let hitWall = false;
  if (dx) { if (boxFree(e.x + dx, e.y, r)) e.x += dx; else hitWall = true; }
  if (dy) { if (boxFree(e.x, e.y + dy, r)) e.y += dy; else hitWall = true; }
  return hitWall;
}
function hasLOS(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.ceil(d / 12);
  for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(lerp(a.x, b.x, t), lerp(a.y, b.y, t))) return false; }
  return true;
}

// ---------- Flow field (đường tìm tới người chơi) ----------
function updateFlow() {
  const g = G.world.grid;
  const sx = Math.floor(P.x / TILE), sy = Math.floor(P.y / TILE);
  const d = new Int16Array(g.w * g.h).fill(-1);
  const q = new Int32Array(g.w * g.h);
  let qh = 0, qt = 0;
  if (!walkable(gget(g, sx, sy))) return;
  d[sx + sy * g.w] = 0; q[qt++] = sx + sy * g.w;
  while (qh < qt) {
    const p = q[qh++], x = p % g.w, y = (p / g.w) | 0;
    if (d[p] > 40) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (!walkable(gget(g, nx, ny))) continue;
      if (dx && dy && (!walkable(gget(g, x + dx, y)) || !walkable(gget(g, x, y + dy)))) continue;
      const np = nx + ny * g.w;
      if (d[np] >= 0) continue;
      d[np] = d[p] + 1; q[qt++] = np;
    }
  }
  G.flow = d;
}
function flowDir(m) {
  const g = G.world.grid;
  if (!G.flow) return null;
  const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE);
  const cur = G.flow[tx + ty * g.w];
  let best = null, bv = cur < 0 ? 9999 : cur;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
    if (dx && dy && (!walkable(gget(g, tx + dx, ty)) || !walkable(gget(g, tx, ty + dy)))) continue;
    const v = G.flow[nx + ny * g.w];
    if (v >= 0 && v < bv) { bv = v; best = { x: (nx + 0.5) * TILE, y: (ny + 0.5) * TILE }; }
  }
  return best;
}

// ---------- Hiệu ứng ----------
function particles(x, y, color, n = 8, spd = 80, life = 0.5, size = 2, grav = 0) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(spd * 0.3, spd);
    G.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.6, life), max: life, color, size: rand(size * 0.6, size * 1.3), grav });
  }
}
function floatText(x, y, txt, color = '#fff', size = 10, life = 0.9) {
  G.texts.push({ x: x + rand(-6, 6), y, txt: String(txt), color, size, life, max: life, vy: -38 });
}
function ring(x, y, r, color, life = 0.35, width = 3) { G.fx.push({ ring: true, x, y, r0: 6, r, color, life, max: life, width }); }
function slashFx(x, y, ang, range, arc, color = 'rgba(255,255,255,0.9)') { G.fx.push({ slash: true, x, y, ang, range, arc, color, life: 0.18, max: 0.18 }); }
function bolt(pts, color = '#bfe3ff') { G.fx.push({ bolt: true, pts, color, life: 0.25, max: 0.25 }); }
function after(t, fn) { G.timers.push({ t, fn }); }

// ---------- Người chơi ----------
function setAnim(name, dur) { P.anim = name; P.animT = 0; P.animDur = dur; }
function aimPoint(range = 360, preferEnemy = true) {
  if (mouseAim()) return screenToWorld(G.mouse.x, G.mouse.y);
  if (preferEnemy) { const m = nearestMon(P, range); if (m) return { x: m.x, y: m.y - 8 }; }
  const v = [[0, -1], [-1, 0], [0, 1], [1, 0]][P.dir];
  return { x: P.x + v[0] * 120, y: P.y - 12 + v[1] * 120 };
}
function nearestMon(from, range, exclude) {
  let best = null, bd = range;
  for (const m of G.mons) {
    if (m.dead || (exclude && exclude.has(m.id))) continue;
    const d = Math.hypot(m.x - from.x, m.y - from.y);
    if (d < bd && hasLOS(from, m)) { bd = d; best = m; }
  }
  return best;
}
function activeSkills() { return CLASSES[P.ch.cls].skills.filter(s => !SKILLS[s].passive); }

function tryBasicAttack() {
  if (P.atkCd > 0 || P.castLock > 0 || P.dash || G.world.town) return;
  const c = CLASSES[P.ch.cls], b = c.basic;
  const aim = aimPoint(b.type === 'melee' ? 120 : b.range);
  const ang = Math.atan2(aim.y - (P.y - 12), aim.x - P.x);
  P.dir = dirFromAngle(ang);
  const dur = Math.min(0.42, P.st.aspd * 0.9);
  P.atkCd = P.st.aspd;
  setAnim(b.anim, dur);
  if (b.type === 'melee') {
    sfx('swing');
    after(dur * 0.45, () => {
      slashFx(P.x, P.y - 14, ang, b.range + 6, b.arc, b.holy ? 'rgba(255,230,120,0.95)' : 'rgba(255,255,255,0.9)');
      meleeHit(P.x, P.y - 10, ang, b.range, b.arc, b.mult, { holy: b.holy, basic: true });
    });
  } else {
    after(dur * 0.5, () => {
      sfx(b.proj === 'arrow' ? 'shoot' : 'magic');
      fireProj(b.proj, ang, b.speed, b.mult, { range: b.range, basic: true });
    });
  }
}
function meleeHit(x, y, ang, range, arc, mult, opt = {}) {
  let n = 0;
  for (const m of G.mons) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - x, (m.y - 8) - y);
    if (d > range + m.r) continue;
    const a = Math.atan2((m.y - 8) - y, m.x - x);
    if (Math.abs(angDiff(ang, a)) > arc / 2 && d > m.r + 8) continue;
    hitMonster(m, mult, Object.assign({ kx: Math.cos(ang), ky: Math.sin(ang), knock: opt.knock || 60 }, opt));
    n++;
  }
  if (n) sfx('hit');
  return n;
}
function fireProj(kind, ang, speed, mult, opt = {}) {
  const sx = P.x + Math.cos(ang) * 10, sy = P.y - 18 + Math.sin(ang) * 6;
  G.projs.push({
    owner: 'p', kind, x: sx, y: sy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, ang,
    mult, r: kind === 'bigarrow' ? 9 : 6, life: (opt.range || 360) / speed + 0.15, pierce: opt.pierce || 0, hit: new Set(),
    explode: opt.explode || 0, opt,
  });
}

function useSkill(i) {
  if (!G.running || G.dead || G.paused) return;
  const keys = activeSkills();
  const sk = keys[i];
  if (!sk) return;
  const d = SKILLS[sk], L = P.ch.skills[sk] || 0;
  if (G.world.town) { UI.toast('Không thể dùng kỹ năng trong thị trấn'); return; }
  if (L <= 0) { UI.toast(`Chưa học ${d.name} — mở bảng Kỹ năng (K)`); sfx('fail'); return; }
  if ((P.skillCd[sk] || 0) > 0 || P.castLock > 0 || P.dash || P.status.stun > 0) return;
  if (P.mp < d.mp) { UI.toast('Không đủ MP!'); floatText(P.x, P.y - 50, 'Hết MP', '#6fb6ff', 9); sfx('fail'); return; }
  P.mp -= d.mp;
  P.skillCd[sk] = d.cd * (1 - P.st.cdr / 100);
  P.castLock = 0.22;
  const aim = d.type === 'ground' ? aimPoint(380) : aimPoint(d.range || 360);
  const ang = Math.atan2(aim.y - (P.y - 12), aim.x - P.x);
  if (d.type !== 'buff' && d.type !== 'heal' && d.type !== 'nova') P.dir = dirFromAngle(ang);
  if (d.anim !== 'walk') setAnim(d.anim, 0.4);
  const so = { skill: true };
  const atkNow = () => 1;
  switch (d.type) {
    case 'nova': {
      const hits = d.hits || 1;
      sfx('swing');
      for (let h = 0; h < hits; h++) {
        after(0.12 + h * 0.16, () => {
          ring(P.x, P.y - 10, d.radius, d.color, 0.35, 4);
          if (d.fx === 'quake') { G.shake = Math.max(G.shake, 8); particles(P.x, P.y, '#a07850', 26, 160, 0.6, 3, 200); sfx('boom'); }
          if (d.fx === 'frost') particles(P.x, P.y - 10, '#bff4ff', 30, 170, 0.6, 2.5);
          if (d.fx === 'whirl' || d.fx === 'blades') { slashFx(P.x, P.y - 12, (G.t * 9) % 6.28, d.radius, Math.PI * 2, d.color); }
          for (const m of G.mons) {
            if (m.dead) continue;
            if (Math.hypot(m.x - P.x, m.y - P.y) > d.radius + m.r) continue;
            const a = Math.atan2(m.y - P.y, m.x - P.x);
            hitMonster(m, d.mult(L), Object.assign({ kx: Math.cos(a), ky: Math.sin(a), knock: d.knock || 20,
              stun: d.stun ? (typeof d.stun === 'function' ? d.stun(L) : d.stun) : 0, slow: d.slow ? d.slow(L) : 0 }, so));
          }
        });
      }
      break;
    }
    case 'cone':
      sfx('swing');
      after(0.12, () => {
        slashFx(P.x, P.y - 14, ang, d.range, d.arc, 'rgba(255,230,120,0.95)');
        particles(P.x + Math.cos(ang) * 40, P.y - 14 + Math.sin(ang) * 40, '#fff2a0', 16, 120, 0.5, 2);
        meleeHit(P.x, P.y - 10, ang, d.range, d.arc, d.mult(L), Object.assign({ holy: d.holy, knock: 80 }, so));
      });
      break;
    case 'proj': {
      const n = d.count ? d.count(L) : 1;
      after(0.15, () => {
        sfx(d.proj === 'fire' ? 'magic' : 'shoot');
        for (let k = 0; k < n; k++) {
          const a = n > 1 ? ang - d.spread / 2 + d.spread * (k / (n - 1)) : ang;
          fireProj(d.proj, a, d.speed, d.mult(L), Object.assign({ pierce: d.pierce || 0, explode: d.explode || 0, range: 420,
            burn: d.burn ? d.burn(L) : 0, poison: d.poison ? d.poison(L) : 0 }, so));
        }
      });
      break;
    }
    case 'chain': {
      after(0.15, () => {
        sfx('magic');
        const hitSet = new Set();
        let from = { x: P.x, y: P.y - 20 };
        let tgt = nearestMon(P, d.range);
        const pts = [from];
        for (let j = 0; j < d.jumps(L) && tgt; j++) {
          hitSet.add(tgt.id);
          pts.push({ x: tgt.x, y: tgt.y - 10 });
          hitMonster(tgt, d.mult(L), Object.assign({ stun: 0.15 }, so));
          particles(tgt.x, tgt.y - 10, '#d6f0ff', 8, 90, 0.3, 2);
          from = tgt;
          tgt = nearestMon(from, 170, hitSet);
        }
        if (pts.length === 1) { const v = aimPoint(); pts.push({ x: P.x + Math.cos(ang) * 120, y: P.y - 20 + Math.sin(ang) * 120 }); }
        bolt(pts, d.color);
      });
      break;
    }
    case 'dash': {
      const dd = d.dist(L), spd = 620;
      let a = ang;
      if (sk === 'a_roll') {
        // cung thủ lướt theo hướng đang chạy, hoặc lùi khỏi quái
        let mx = 0, my = 0; const K = G.keys;
        if (K['a'] || K['arrowleft']) mx -= 1; if (K['d'] || K['arrowright']) mx += 1;
        if (K['w'] || K['arrowup']) my -= 1; if (K['s'] || K['arrowdown']) my += 1;
        if (G.joy.active) { mx = G.joy.x; my = G.joy.y; }
        a = Math.hypot(mx, my) > 0.2 ? Math.atan2(my, mx) : ang + Math.PI;
      }
      P.dash = { vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, t: dd / spd, hit: new Set(), mult: d.mult(L), stun: d.stun || 0, skill: true, color: d.color };
      P.invuln = Math.max(P.invuln, dd / spd + 0.1);
      sfx('swing');
      if (d.buff) addBuff(sk, d.buff(L), d.dur(L));
      break;
    }
    case 'buff':
      addBuff(sk, d.buff(L), d.dur(L));
      ring(P.x, P.y - 12, 50, d.color, 0.5, 3);
      particles(P.x, P.y - 16, d.color, 20, 90, 0.7, 2.2, -60);
      sfx('heal');
      if (sk === 's_stealth') { for (const m of G.mons) if (!m.boss) { m.aggro = false; m.state = 'idle'; } P.ambushReady = true; }
      break;
    case 'heal': {
      const amt = P.st.maxHp * d.heal(L) / 100;
      healPlayer(amt);
      P.status = {};
      ring(P.x, P.y - 12, 60, d.color, 0.6, 4);
      particles(P.x, P.y - 20, '#fff6b0', 26, 70, 0.9, 2.5, -80);
      sfx('heal');
      break;
    }
    case 'ground': {
      const tp = { x: aim.x, y: aim.y + 12 };
      const dx = tp.x - P.x, dy = tp.y - P.y, dl = Math.hypot(dx, dy);
      if (dl > 380) { tp.x = P.x + dx / dl * 380; tp.y = P.y + dy / dl * 380; }
      castGround(d, L, tp);
      break;
    }
  }
  UI.refreshSkillbar();
}
function castGround(d, L, tp) {
  const R = d.radius;
  if (d.zone === 'meteor') {
    const n = d.count(L);
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), rr = rand(0, R);
      const px = tp.x + Math.cos(a) * rr, py = tp.y + Math.sin(a) * rr * 0.8;
      after(0.2 + i * 0.22, () => {
        G.zones.push({ kind: 'pmeteor', x: px, y: py, r: 48, t: 0.5, max: 0.5, onDone: () => {
          sfx('boom'); G.shake = Math.max(G.shake, 4);
          particles(px, py, '#ff8a3a', 22, 160, 0.6, 3); particles(px, py, '#ffd27a', 10, 90, 0.4, 2);
          ring(px, py, 48, '#ff6a2a', 0.3, 4);
          aoeHit(px, py, 48, d.mult(L), { skill: true, burn: 2 });
        } });
      });
    }
  } else if (d.zone === 'arrowrain') {
    const n = d.ticks(L);
    G.zones.push({ kind: 'parea', x: tp.x, y: tp.y, r: R, t: n * 0.22 + 0.2, max: n * 0.22 + 0.2, color: 'rgba(232,211,160,0.18)' });
    for (let i = 0; i < n; i++) after(0.2 + i * 0.22, () => {
      for (let k = 0; k < 6; k++) { const a = rand(0, 6.28), rr = rand(0, R); G.fx.push({ arrowDrop: true, x: tp.x + Math.cos(a) * rr, y: tp.y + Math.sin(a) * rr * 0.8, life: 0.22, max: 0.22 }); }
      aoeHit(tp.x, tp.y, R, d.mult(L), { skill: true, quiet: i % 2 });
      sfx('shoot');
    });
  } else if (d.zone === 'pillar') {
    G.zones.push({ kind: 'pwarn', x: tp.x, y: tp.y, r: R, t: 0.4, max: 0.4, color: '#fff2a0', onDone: () => {
      G.fx.push({ pillar: true, x: tp.x, y: tp.y, life: 0.5, max: 0.5, r: R });
      G.shake = Math.max(G.shake, 4); sfx('boom');
      particles(tp.x, tp.y - 10, '#fff6b0', 30, 150, 0.7, 2.5, -40);
      aoeHit(tp.x, tp.y, R, d.mult(L), { skill: true, stun: d.stun, holy: true });
    } });
  }
}
function aoeHit(x, y, R, mult, opt) {
  for (const m of G.mons) {
    if (m.dead) continue;
    if (Math.hypot(m.x - x, (m.y - y) * 1.15) > R + m.r) continue;
    const a = Math.atan2(m.y - y, m.x - x);
    hitMonster(m, mult, Object.assign({ kx: Math.cos(a), ky: Math.sin(a), knock: 30 }, opt));
  }
}
function addBuff(id, mods, dur) {
  P.buffs = P.buffs.filter(b => b.id !== id);
  P.buffs.push({ id, mods, t: dur, max: dur });
  recalc(false);
  UI.refreshBuffs();
}
function healPlayer(a) {
  const before = P.hp;
  P.hp = Math.min(P.st.maxHp, P.hp + a);
  const d = P.hp - before;
  if (d >= 1) floatText(P.x, P.y - 40, '+' + Math.round(d), '#7dff8a', 10);
}
function usePotion(kind) {
  if (!G.running || G.dead) return;
  if (P.potCd[kind] > 0) return;
  if ((P.ch.potions[kind] || 0) <= 0) { UI.toast(kind === 'hp' ? 'Hết bình máu!' : 'Hết bình mana!'); sfx('fail'); return; }
  if (kind === 'hp' && P.hp >= P.st.maxHp) return;
  if (kind === 'mp' && P.mp >= P.st.maxMp) return;
  P.ch.potions[kind]--;
  P.potCd[kind] = 1.2;
  if (kind === 'hp') { healPlayer(P.st.maxHp * 0.4 + 20); particles(P.x, P.y - 20, '#ff6b6b', 14, 60, 0.6, 2, -60); }
  else { const b = P.mp; P.mp = Math.min(P.st.maxMp, P.mp + P.st.maxMp * 0.5 + 15); floatText(P.x, P.y - 40, '+' + Math.round(P.mp - b), '#6fb6ff', 10); particles(P.x, P.y - 20, '#6fb6ff', 14, 60, 0.6, 2, -60); }
  sfx('heal');
  UI.refreshSkillbar();
}
function startPortal() {
  if (!G.running || G.dead || G.world.town || P.portal) return;
  P.portal = { t: 1.5 };
  UI.toast('Đang mở cổng dịch chuyển về thành...');
}
function interact() {
  if (!G.prompt || G.dead) return;
  const p = G.prompt;
  if (p.kind === 'npc') { UI.openPanel(p.target.panel, p.target); sfx('ui'); }
  else if (p.kind === 'door') {
    const next = G.world.floor + 1;
    enterFloor(next);
  } else if (p.kind === 'gate') UI.openPanel('gate');
}

// ---------- Sát thương lên quái ----------
function hitMonster(m, mult, opt = {}) {
  if (m.dead) return 0;
  const st = P.st;
  let raw = st.atk * mult * (1 + (st.dmgPct + (opt.skill ? st.skillPct : 0)) / 100) * rand(0.9, 1.1);
  let crit = Math.random() * 100 < st.crit;
  if (P.ambushReady && (opt.basic || opt.skill)) {
    raw *= 1 + st.ambush / 100; crit = true; P.ambushReady = false;
    P.buffs = P.buffs.filter(b => b.id !== 's_stealth'); recalc(false); UI.refreshBuffs();
    floatText(m.x, m.y - 60, 'ÁM SÁT!', '#ff5470', 11);
  }
  if (crit) raw *= 1 + st.critDmg / 100;
  if (opt.holy && (m.d.undead || m.d.demon)) raw *= 1.5;
  const dmg = Math.max(1, Math.round(raw * 60 / (60 + m.defv * 1.5)));
  m.hp -= dmg;
  m.flash = 0.12;
  if (!m.boss) { m.aggro = true; if (m.state === 'idle') m.state = 'chase'; }
  if (opt.knock && !m.boss) { const kr = m.elite ? 0.4 : 1; m.kb.x += (opt.kx || 0) * opt.knock * 3 * kr; m.kb.y += (opt.ky || 0) * opt.knock * 3 * kr; }
  if (opt.stun) m.status.stun = Math.max(m.status.stun || 0, m.boss ? opt.stun * 0.35 : opt.stun);
  if (opt.slow) m.status.slow = Math.max(m.status.slow || 0, opt.slow);
  if (opt.burn) m.status.burn = { t: opt.burn, dps: st.atk * 0.3 };
  if (opt.poison) m.status.poison = { t: opt.poison, dps: st.atk * 0.25 };
  if (!opt.quiet || crit) floatText(m.x, m.y - (m.spr.foot || 40) * m.scale * 0.8, crit ? fmt(dmg) + '!' : fmt(dmg), crit ? '#ffd23a' : '#ffffff', crit ? 13 : 9);
  if (crit) sfx('crit');
  particles(m.x, m.y - 14, m.d.ghostly ? '#cfffd0' : '#c0392b', crit ? 8 : 4, 70, 0.35, 2);
  if (st.lifesteal > 0) { P.hp = Math.min(st.maxHp, P.hp + dmg * st.lifesteal / 100); }
  if (m.hp <= 0) killMonster(m);
  return dmg;
}
function dotMonster(m, dmg, color) {
  if (m.dead) return;
  dmg = Math.max(1, Math.round(dmg));
  m.hp -= dmg;
  floatText(m.x, m.y - 30, dmg, color, 8, 0.6);
  if (m.hp <= 0) killMonster(m);
}
function killMonster(m) {
  m.dead = true; m.deadT = 0; m.state = 'dead';
  P.ch.kills++;
  sfx('die');
  particles(m.x, m.y - 12, m.boss ? '#ffcf5a' : '#8a2b2b', m.boss ? 60 : 12, m.boss ? 220 : 90, m.boss ? 1.2 : 0.5, 2.5);
  gainXp(m.xp);
  floatText(m.x, m.y - 50, `+${fmt(m.xp)} XP`, '#b48cff', 9, 1.1);
  dropLoot(m);
  if (m.boss) {
    G.bossRef = null; UI.bossBar(null);
    P.ch.bossKills++;
    G.shake = 14;
    G.door = { x: m.home.x, y: m.home.y + 40, open: true };
    UI.showBanner('BOSS BỊ ĐÁNH BẠI!', `${m.name} đã gục ngã — cổng xuống tầng tiếp theo đã mở`);
    if (m.key === 'impking' && !Save.data.unlocks.assassin) {
      Save.data.unlocks.assassin = true; Save.store();
      setTimeout(() => UI.bigNotice('🔓 Mở khóa CLASS ẨN', 'Ảnh Sát Thủ đã xuất hiện ở màn hình tạo nhân vật!'), 1800);
    }
    // mở thêm checkpoint
    P.ch.maxFloor = Math.max(P.ch.maxFloor, G.world.floor + 1);
    // giết hết lính triệu hồi
    for (const o of G.mons) if (!o.dead && o.minion) { o.hp = 0; killMonster(o); }
    saveGame();
  }
}
function gainXp(x) {
  const ch = P.ch;
  if (ch.lvl >= MAX_LEVEL) return;
  ch.xp += x;
  let up = false;
  while (ch.lvl < MAX_LEVEL && ch.xp >= xpNeed(ch.lvl)) {
    ch.xp -= xpNeed(ch.lvl); ch.lvl++; ch.freeAttr += 3; ch.skillPts += 1; up = true;
  }
  if (up) {
    recalc(true);
    sfx('level');
    ring(P.x, P.y - 16, 70, '#ffd76a', 0.8, 5);
    particles(P.x, P.y - 20, '#ffd76a', 40, 140, 1.0, 2.5, -40);
    UI.showBanner(`LÊN CẤP ${ch.lvl}!`, '+3 điểm thuộc tính · +1 điểm kỹ năng');
    UI.refreshAll();
    saveGame();
  }
}

// ---------- Loot ----------
function dropLoot(m) {
  const fl = m.floor, sc = floorScale(fl), st = P.st;
  const gf = 1 + st.goldFind / 100;
  const pos = () => ({ x: m.x + rand(-14, 14), y: m.y + rand(-10, 10) });
  if (m.boss) {
    for (let i = 0; i < 6; i++) addDrop('gold', pos(), Math.round(randi(15, 30) * sc.gold * gf));
    const n = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) addDrop('item', pos(), genItem(fl + 2, { mf: st.magicFind, minR: i === 0 ? 3 : 2, cls: P.ch.cls }));
    addDrop('stone', pos(), randi(3, 6));
    addDrop('hp', pos(), 2); addDrop('mp', pos(), 1);
    return;
  }
  if (Math.random() < (m.elite ? 1 : 0.5)) addDrop('gold', pos(), Math.max(1, Math.round(randi(2, 6) * sc.gold * gf * (m.elite ? 3 : 1))));
  const ic = m.elite ? 1 : 0.085;
  if (Math.random() < ic) addDrop('item', pos(), genItem(fl + (m.elite ? 1 : 0), { mf: st.magicFind, minR: m.elite ? 1 : 0, cls: P.ch.cls }));
  if (m.elite && Math.random() < 0.4) addDrop('item', pos(), genItem(fl + 1, { mf: st.magicFind, cls: P.ch.cls }));
  if (Math.random() < 0.045) addDrop('hp', pos(), 1);
  if (Math.random() < 0.03) addDrop('mp', pos(), 1);
  if (Math.random() < (m.elite ? 0.5 : 0.04)) addDrop('stone', pos(), 1);
}
function addDrop(kind, p, val) {
  G.drops.push({ kind, x: p.x, y: p.y, val, z: 0, vz: rand(90, 140), t: 0, bob: rand(0, 6) });
}
function openChest(c) {
  c.opened = true;
  sfx('coin');
  particles(c.x, c.y - 10, '#ffd76a', 20, 100, 0.7, 2, -30);
  const fl = G.world.floor, sc = floorScale(fl), gf = 1 + P.st.goldFind / 100;
  const pos = () => ({ x: c.x + rand(-18, 18), y: c.y + rand(4, 18) });
  for (let i = 0; i < 3; i++) addDrop('gold', pos(), Math.round(randi(3, 8) * sc.gold * gf));
  addDrop('item', pos(), genItem(fl + 1, { mf: P.st.magicFind + 30, minR: c.rich ? 2 : 1, cls: P.ch.cls }));
  if (c.rich) addDrop('item', pos(), genItem(fl + 1, { mf: P.st.magicFind + 50, minR: 1, cls: P.ch.cls }));
  if (Math.random() < 0.5) addDrop(Math.random() < 0.5 ? 'hp' : 'mp', pos(), 1);
  if (Math.random() < 0.5) addDrop('stone', pos(), randi(1, 2));
}
function pickupDrop(d) {
  const ch = P.ch;
  if (d.kind === 'item') {
    if (ch.bag.length >= BAG_SIZE) { if (!d.warned) { UI.toast('Túi đồ đầy! Bán hoặc phân giải bớt.'); d.warned = true; } return false; }
    ch.bag.push(d.val);
    UI.log(`Nhặt: <b style="color:${RARITY[d.val.rarity].color}">${itemDisplayName(d.val)}</b>`);
    if (d.val.rarity >= 3) { UI.toast(`${RARITY[d.val.rarity].name}: ${d.val.name}!`); }
    sfx('pick');
    UI.refreshInv();
  } else if (d.kind === 'gold') { ch.gold += d.val; floatText(P.x, P.y - 44, '+' + d.val + ' vàng', '#ffd23a', 8, 0.7); sfx('coin'); }
  else if (d.kind === 'hp' || d.kind === 'mp') { ch.potions[d.kind] += d.val; UI.log(`Nhặt: ${d.kind === 'hp' ? 'Bình máu' : 'Bình mana'} x${d.val}`); sfx('pick'); UI.refreshSkillbar(); }
  else if (d.kind === 'stone') { ch.stones += d.val; UI.log(`Nhặt: Đá Cường Hóa x${d.val}`); sfx('pick'); }
  return true;
}

// ---------- Sát thương lên người chơi ----------
function hurtPlayer(amount, src, opt = {}) {
  if (G.dead || P.invuln > 0 || G.world.town) return;
  const st = P.st;
  if (Math.random() * 100 < st.dodge) { floatText(P.x, P.y - 46, 'Né!', '#c9ffd0', 9); return; }
  if (Math.random() * 100 < st.block) { floatText(P.x, P.y - 46, 'Chặn!', '#9fc1ff', 9); sfx('hit'); return; }
  let dmg = amount * rand(0.9, 1.1) * 100 / (100 + st.def * 2.5);
  dmg = Math.max(1, Math.round(dmg));
  P.hp -= dmg;
  P.flash = 0.15; P.hurtT = 0.25;
  floatText(P.x, P.y - 46, '-' + dmg, '#ff5a5a', 10);
  G.shake = Math.max(G.shake, opt.big ? 8 : 3);
  sfx('hurt');
  if (st.thorns > 0 && src && src.hp != null && !src.dead && opt.melee) {
    dotMonster(src, dmg * st.thorns / 100 + st.def * 0.3, '#9fc1ff');
  }
  if (opt.effect === 'poison') P.status.poison = { t: 3, dps: amount * 0.12 };
  if (opt.effect === 'burn') P.status.burn = { t: 3, dps: amount * 0.15 };
  if (opt.effect === 'slow') P.status.slow = Math.max(P.status.slow || 0, 2);
  if (opt.stun) P.status.stun = Math.max(P.status.stun || 0, opt.stun);
  if (P.portal) { P.portal = null; UI.toast('Dịch chuyển bị gián đoạn!'); }
  if (P.hp <= 0) playerDie();
}
function playerDie() {
  P.hp = 0; G.dead = true;
  P.ch.deaths++;
  const lost = Math.floor(P.ch.gold * 0.1);
  P.ch.gold -= lost;
  saveGame();
  setAnim('hurt', 0.6);
  UI.showDeath(lost);
}
function respawn() {
  G.dead = false;
  P.status = {}; P.buffs = [];
  enterTown();
}

// ---------- Cập nhật ----------
function update(dt) {
  G.t += dt;
  if (!G.running) return;
  P.animT += dt;
  if (G.paused) return;
  if (G.dead) { updateFx(dt); return; }
  P.ch.playTime += dt;
  // timers
  for (let i = G.timers.length - 1; i >= 0; i--) { const t = G.timers[i]; t.t -= dt; if (t.t <= 0) { G.timers.splice(i, 1); t.fn(); } }
  updatePlayer(dt);
  if (!G.world.town) {
    G.flowT -= dt;
    if (G.flowT <= 0) { updateFlow(); G.flowT = 0.35; }
    for (const m of G.mons) updateMonster(m, dt);
    G.mons = G.mons.filter(m => !(m.dead && m.deadT > 1.2));
    separate();
  }
  updateProjs(dt);
  updateZones(dt);
  updateDrops(dt);
  updateFx(dt);
  updatePrompt();
  if (G.explored) {
    G.exploreT -= dt;
    if (G.exploreT <= 0) { exploreAround(); G.exploreT = 0.2; }
  }
  G.saveT += dt;
  if (G.saveT > 30) { G.saveT = 0; saveGame(); }
}
function exploreAround() {
  const g = G.world.grid, px = Math.floor(P.x / TILE), py = Math.floor(P.y / TILE), R = 8;
  for (let y = py - R; y <= py + R; y++) for (let x = px - R; x <= px + R; x++) {
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
    if ((x - px) ** 2 + (y - py) ** 2 <= R * R) G.explored[x + y * g.w] = 1;
  }
}
function updatePlayer(dt) {
  const st = P.st;
  P.atkCd -= dt; P.castLock -= dt; P.flash -= dt; P.invuln -= dt; P.hurtT -= dt;
  P.potCd.hp -= dt; P.potCd.mp -= dt;
  for (const k in P.skillCd) P.skillCd[k] -= dt;
  // buffs
  let changed = false;
  for (const b of P.buffs) b.t -= dt;
  if (P.buffs.some(b => b.t <= 0)) { P.buffs = P.buffs.filter(b => b.t > 0); changed = true; if (!P.buffs.some(b => b.id === 's_stealth')) P.ambushReady = false; }
  if (changed) { recalc(false); UI.refreshBuffs(); }
  // hồi phục
  if (!G.world.town) {
    P.hp = Math.min(st.maxHp, P.hp + st.hpRegen * dt);
    P.mp = Math.min(st.maxMp, P.mp + st.mpRegen * dt);
  } else { P.hp = st.maxHp; P.mp = st.maxMp; }
  // trạng thái
  const S = P.status;
  if (S.poison) { S.poison.t -= dt; P.hp -= S.poison.dps * dt; if (S.poison.t <= 0) delete S.poison; if (Math.random() < dt * 6) particles(P.x, P.y - 20, '#8dff6a', 1, 20, 0.5, 2, -30); }
  if (S.burn) { S.burn.t -= dt; P.hp -= S.burn.dps * dt; if (S.burn.t <= 0) delete S.burn; if (Math.random() < dt * 10) particles(P.x, P.y - 20, '#ff8a3a', 1, 20, 0.5, 2, -50); }
  if (S.slow) { S.slow -= dt; if (S.slow <= 0) delete S.slow; }
  if (S.stun) { S.stun -= dt; if (S.stun <= 0) delete S.stun; }
  // dung nham
  if (!G.world.town && gget(G.world.grid, Math.floor(P.x / TILE), Math.floor(P.y / TILE)) === T_LAVA && !P.dash) {
    P.lavaT = (P.lavaT || 0) - dt;
    if (P.lavaT <= 0) { P.lavaT = 0.5; hurtPlayer(P.st.maxHp * 0.05 + 5, null, {}); P.status.burn = { t: 2, dps: P.st.maxHp * 0.01 }; }
  }
  if (P.hp <= 0 && !G.dead) { playerDie(); return; }
  // cổng dịch chuyển
  if (P.portal) {
    P.portal.t -= dt;
    if (Math.random() < 0.6) particles(P.x + rand(-14, 14), P.y, '#b56cff', 1, 30, 0.8, 2, -90);
    if (P.portal.t <= 0) { P.portal = null; enterTown(); return; }
  }
  // dash
  if (P.dash) {
    const D = P.dash;
    const n = 3;
    for (let i = 0; i < n; i++) moveEnt(P, D.vx * dt / n, D.vy * dt / n);
    D.t -= dt;
    particles(P.x, P.y - 16, D.color || '#fff', 2, 20, 0.3, 2);
    if (D.mult > 0) for (const m of G.mons) {
      if (m.dead || D.hit.has(m.id)) continue;
      if (Math.hypot(m.x - P.x, m.y - P.y) < m.r + 18) { D.hit.add(m.id); const a = Math.atan2(D.vy, D.vx); hitMonster(m, D.mult, { skill: true, stun: D.stun, kx: Math.cos(a), ky: Math.sin(a), knock: 60 }); }
    }
    if (D.t <= 0) P.dash = null;
    P.moving = true;
    return;
  }
  // di chuyển
  let mx = 0, my = 0;
  const K = G.keys;
  if (K['a'] || K['arrowleft']) mx -= 1;
  if (K['d'] || K['arrowright']) mx += 1;
  if (K['w'] || K['arrowup']) my -= 1;
  if (K['s'] || K['arrowdown']) my += 1;
  if (G.joy.active) { mx = G.joy.x; my = G.joy.y; }
  const ml = Math.hypot(mx, my);
  P.moving = ml > 0.15 && !S.stun;
  const attacking = P.anim !== 'walk' && P.anim !== 'idle' && P.animT < P.animDur;
  if (P.moving) {
    mx /= Math.max(1, ml); my /= Math.max(1, ml);
    let sp = st.move * (S.slow ? 0.55 : 1) * (attacking ? 0.55 : 1) * (P.portal ? 0 : 1);
    moveEnt(P, mx * sp * dt, my * sp * dt);
    if (!attacking) P.dir = dirFromAngle(Math.atan2(my, mx));
  }
  if (!attacking) { if (P.moving) { if (P.anim !== 'walk') setAnim('walk', 0.8); } else if (P.anim !== 'idle') setAnim('idle', 1.2); }
  // tấn công
  const wantAtk = (G.mouse.down && !G.touch) || K['j'] || K[' '] || G.attackHeld;
  if (wantAtk && !S.stun) tryBasicAttack();
}
function separate() {
  const ms = G.mons;
  for (let i = 0; i < ms.length; i++) {
    const a = ms[i]; if (a.dead) continue;
    for (let j = i + 1; j < ms.length; j++) {
      const b = ms[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), md = (a.r + b.r) * 0.8;
      if (d > 0 && d < md) {
        const push = (md - d) / 2, ux = dx / d, uy = dy / d;
        if (!a.boss) moveEnt(a, -ux * push, -uy * push);
        if (!b.boss) moveEnt(b, ux * push, uy * push);
      }
    }
    // không đè lên người chơi
    const dx = a.x - P.x, dy = a.y - P.y, d = Math.hypot(dx, dy), md = a.r + P.r - 2;
    if (d > 0 && d < md && !a.boss) moveEnt(a, dx / d * (md - d), dy / d * (md - d));
  }
}

// ---------- AI quái ----------
function monMoveToward(m, tx, ty, sp, dt) {
  const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
  if (d < 1) return;
  moveEnt(m, dx / d * sp * dt, dy / d * sp * dt);
  if (!m.spr.side) m.dir = dirFromAngle(Math.atan2(dy, dx)); else m.dir = dx < 0 ? DIR.LEFT : DIR.RIGHT;
  m.moving = true;
}
function chase(m, sp, dt) {
  const d = dist(m, P);
  if (d < 60 || hasLOS(m, P)) monMoveToward(m, P.x, P.y, sp, dt);
  else { const f = flowDir(m); if (f) monMoveToward(m, f.x, f.y, sp, dt); }
}
function updateMonster(m, dt) {
  m.animT += dt; m.flash -= dt; m.moving = false;
  if (m.dead) { m.deadT += dt; return; }
  const S = m.status;
  if (S.burn) { S.burn.t -= dt; S.burn.acc = (S.burn.acc || 0) + dt; if (S.burn.acc >= 0.5) { S.burn.acc = 0; dotMonster(m, S.burn.dps * 0.5, '#ff9a4a'); } if (Math.random() < dt * 8) particles(m.x, m.y - 16, '#ff8a3a', 1, 20, 0.4, 2, -40); if (S.burn && S.burn.t <= 0) delete S.burn; }
  if (S.poison) { S.poison.t -= dt; S.poison.acc = (S.poison.acc || 0) + dt; if (S.poison.acc >= 0.5) { S.poison.acc = 0; dotMonster(m, S.poison.dps * 0.5, '#8dff6a'); } if (S.poison && S.poison.t <= 0) delete S.poison; }
  if (m.dead) return;
  if (S.slow) { S.slow -= dt; if (S.slow <= 0) delete S.slow; }
  // knockback
  if (Math.abs(m.kb.x) + Math.abs(m.kb.y) > 1) {
    moveEnt(m, m.kb.x * dt, m.kb.y * dt);
    m.kb.x *= Math.pow(0.002, dt); m.kb.y *= Math.pow(0.002, dt);
  }
  if (S.stun) { S.stun -= dt; if (S.stun <= 0) delete S.stun; else { if (m.state === 'windup' && !m.boss) m.state = 'chase'; return; } }
  const sp = m.spd * (S.slow ? 0.5 : 1);
  m.cd -= dt;
  if (m.boss) { bossAI(m, dt, sp); return; }
  const d = dist(m, P);
  const sees = !P.st.stealth && d < (m.aggro ? 420 : 230) && (d < 70 || hasLOS(m, P));
  if (P.st.stealth && m.aggro) { m.aggro = false; m.state = 'idle'; }
  if (!m.aggro && sees) { m.aggro = true; m.state = 'chase'; floatText(m.x, m.y - 40, '!', '#ff5050', 12, 0.6); }
  if (m.aggro && d > 520) { m.aggro = false; m.state = 'idle'; }
  const ai = m.d.ai;
  if (m.state === 'idle') {
    m.t -= dt;
    if (ai === 'turret') return;
    if (!m.wander || m.t <= 0) { m.wander = { x: m.home.x + rand(-60, 60), y: m.home.y + rand(-50, 50) }; m.t = rand(2, 4); }
    if (Math.hypot(m.wander.x - m.x, m.wander.y - m.y) > 6) monMoveToward(m, m.wander.x, m.wander.y, sp * 0.35, dt);
    return;
  }
  if (m.state === 'windup') {
    m.t -= dt;
    if (m.t <= 0) {
      if (ai === 'ranged' || ai === 'turret') {
        const a = Math.atan2(P.y - 14 - (m.y - 18), P.x - m.x);
        enemyProj(m, m.d.proj, m.x, m.y - 18, a, 210, m.atk);
        m.state = 'chase'; m.cd = rand(1.4, 2.0);
      } else if (ai === 'charger' && m.charging == null) {
        const a = Math.atan2(P.y - m.y, P.x - m.x);
        m.charging = { vx: Math.cos(a) * sp * 4, vy: Math.sin(a) * sp * 4, t: 0.55, hit: false };
        m.state = 'charge';
      } else {
        if (dist(m, P) < m.d.range + m.r + P.r + 14) hurtPlayer(m.atk, m, { melee: true, effect: m.d.onHit });
        m.state = 'recover'; m.t = 0.35; m.cd = rand(1.0, 1.5);
      }
    }
    return;
  }
  if (m.state === 'charge') {
    const C = m.charging;
    const hw = moveEnt(m, C.vx * dt, C.vy * dt);
    C.t -= dt; m.moving = true;
    if (!C.hit && dist(m, P) < m.r + P.r + 6) { C.hit = true; hurtPlayer(m.atk * 1.4, m, { melee: true, stun: 0.5 }); }
    if (C.t <= 0 || hw) { m.charging = null; m.state = 'recover'; m.t = 0.6; m.cd = rand(2.5, 3.5); }
    return;
  }
  if (m.state === 'recover') { m.t -= dt; if (m.t <= 0) m.state = 'chase'; return; }
  // chase
  if (ai === 'ranged' || ai === 'turret') {
    const R = m.d.range;
    if (ai === 'ranged') {
      if (d > R * 0.85 || !hasLOS(m, P)) chase(m, sp, dt);
      else if (d < R * 0.45) monMoveToward(m, m.x - (P.x - m.x), m.y - (P.y - m.y), sp * 0.8, dt);
    }
    m.dir = dirFromAngle(angTo(m, P));
    if (m.cd <= 0 && d < R && hasLOS(m, P)) { m.state = 'windup'; m.t = 0.4; m.animT = 0; }
    return;
  }
  const reach = m.d.range + m.r + P.r;
  if (ai === 'charger' && m.cd <= 0 && d < 220 && d > 60 && hasLOS(m, P)) { m.state = 'windup'; m.t = 0.5; m.charging = null; m.animT = 0; floatText(m.x, m.y - 50, '!!', '#ffa040', 11, 0.5); return; }
  if (d > reach) {
    let s2 = sp;
    if (ai === 'fly') { const w = Math.sin(G.t * 5 + m.id) * 0.6; const a = angTo(m, P) + w; moveEnt(m, Math.cos(a) * s2 * dt, Math.sin(a) * s2 * dt); m.dir = dirFromAngle(a); m.moving = true; if (!hasLOS(m, P)) chase(m, s2 * 0.5, dt); }
    else chase(m, s2, dt);
  } else {
    m.dir = dirFromAngle(angTo(m, P));
    if (m.cd <= 0) { m.state = 'windup'; m.t = 0.38; m.animT = 0; }
  }
}
function enemyProj(m, kind, x, y, a, speed, dmg, extra = {}) {
  G.projs.push(Object.assign({ owner: 'e', kind: kind || 'orb', x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, ang: a, dmg, r: 7, life: 3, src: m }, extra));
}
function warn(z) { z.kind = 'warn'; z.max = z.t; G.zones.push(z); }

// ---------- Boss ----------
function bossAI(m, dt, sp) {
  const d = dist(m, P);
  if (!m.aggro) {
    if (d < 300) { m.aggro = true; UI.bossBar(m); UI.showBanner(m.name, 'BOSS'); sfx('boom'); G.shake = 6; }
    else return;
  }
  const enr = m.hp < m.maxHp * 0.5;
  if (enr && m.phase === 1) { m.phase = 2; floatText(m.x, m.y - 90, 'NỔI GIẬN!', '#ff4040', 14, 1.4); G.shake = 8; sfx('boom'); }
  if (m.spr.side) m.dir = P.x < m.x ? DIR.LEFT : DIR.RIGHT;
  const cdm = enr ? 0.7 : 1;
  const sp2 = sp * (enr ? 1.25 : 1);
  if (m.act) {
    m.actT -= dt;
    if (m.act.update) m.act.update(dt);
    if (m.actT <= 0) { const f = m.act.end; m.act = null; f && f(); }
    return;
  }
  m.pt -= dt;
  const P2 = { x: P.x, y: P.y };
  const pattern = m.d.pattern;
  if (pattern === 'golem') {
    if (d > 70) chase(m, sp2, dt); else m.dir = dirFromAngle(angTo(m, P));
    if (m.pt <= 0) {
      m.pt = rand(2.6, 3.4) * cdm;
      if (d < 150) {
        m.act = { name: 'atk' }; m.actT = 1.0; m.animT = 0;
        warn({ shape: 'circle', x: m.x, y: m.y, r: 130, t: 1.0, onDone: () => {
          G.shake = 12; sfx('boom'); ring(m.x, m.y, 130, '#c9a06a', 0.4, 6); particles(m.x, m.y, '#a07850', 40, 200, 0.8, 3, 250);
          if (Math.hypot(P.x - m.x, (P.y - m.y) * 1.15) < 130 + P.r) hurtPlayer(m.atk * 1.7, m, { big: true, stun: 0.6 });
        } });
      } else {
        m.act = { name: 'atk' }; m.actT = 0.7; m.animT = 0;
        const n = enr ? 5 : 3;
        after(0.6, () => { const a0 = angTo(m, P); for (let i = 0; i < n; i++) enemyProj(m, 'rock', m.x, m.y - 40, a0 + (i - (n - 1) / 2) * 0.22, 230, m.atk * 0.9, { r: 10 }); sfx('swing'); });
      }
    }
  } else if (pattern === 'impking') {
    if (d > 170) chase(m, sp2, dt); else if (d < 110) monMoveToward(m, m.x - (P.x - m.x), m.y - (P.y - m.y), sp2 * 0.7, dt);
    m.dir = dirFromAngle(angTo(m, P));
    if (m.pt <= 0) {
      m.pt = rand(2.2, 2.8) * cdm;
      const r = Math.random();
      if (r < 0.4) {
        m.act = { name: 'atk' }; m.actT = 0.8; m.animT = 0;
        ring(m.x, m.y - 30, 60, '#ff5a2a', 0.8, 3);
        after(0.7, () => { const n = enr ? 16 : 11, off = rand(0, 1); for (let i = 0; i < n; i++) enemyProj(m, 'fire', m.x, m.y - 30, off + i / n * 6.283, 170, m.atk * 0.8, { effect: 'burn' }); sfx('magic'); });
      } else if (r < 0.7 && G.mons.filter(o => o.minion && !o.dead).length < 6) {
        m.act = { name: 'atk' }; m.actT = 0.9; m.animT = 0;
        floatText(m.x, m.y - 90, 'Triệu hồi!', '#ff8a5a', 11, 1);
        after(0.8, () => { for (let i = 0; i < (enr ? 3 : 2); i++) { const s = spawnMonster(pick(['imp_g', 'imp_b']), m.x + rand(-60, 60), m.y + rand(20, 60), G.world.floor - 1, false); s.minion = true; s.aggro = true; s.state = 'chase'; particles(s.x, s.y, '#ff5a2a', 16, 100, 0.5, 2); } });
      } else {
        const a = angTo(m, P), L = 320;
        m.act = { name: 'atk' }; m.actT = 0.75; m.animT = 0;
        warn({ shape: 'line', x: m.x, y: m.y, ang: a, len: L, w: 46, t: 0.7, onDone: () => {
          m.act = { name: 'walk', update: (dt2) => {
            const hw = moveEnt(m, Math.cos(a) * 640 * dt2, Math.sin(a) * 640 * dt2);
            particles(m.x, m.y - 20, '#ff5a2a', 2, 30, 0.3, 2);
            if (!m.act.hit && dist(m, P) < m.r + P.r + 8) { m.act.hit = true; hurtPlayer(m.atk * 1.5, m, { big: true }); }
            if (hw) m.actT = 0;
          } };
          m.actT = L / 640;
        } });
      }
    }
  } else if (pattern === 'spiderq') {
    if (d > 60) chase(m, sp2, dt); else m.dir = dirFromAngle(angTo(m, P));
    if (d < 70 && m.cd <= 0) {
      m.act = { name: 'atk' }; m.actT = 0.45; m.animT = 0; m.cd = 1.1 * cdm;
      after(0.4, () => { if (dist(m, P) < 90) hurtPlayer(m.atk, m, { melee: true, effect: 'poison' }); });
    }
    if (m.pt <= 0) {
      m.pt = rand(2.5, 3.2) * cdm;
      const r = Math.random();
      if (r < 0.4) {
        m.act = { name: 'atk' }; m.actT = 0.5; m.animT = 0;
        after(0.4, () => { const a0 = angTo(m, P); for (let i = -2; i <= 2; i++) enemyProj(m, 'web', m.x, m.y - 30, a0 + i * 0.18, 240, m.atk * 0.6, { effect: 'slow' }); sfx('shoot'); });
      } else if (r < 0.7) {
        for (let i = 0; i < (enr ? 4 : 3); i++) {
          const px = P.x + rand(-80, 80), py = P.y + rand(-60, 60);
          warn({ shape: 'circle', x: px, y: py, r: 50, t: 0.9, color: '#7dff6a', onDone: () => {
            G.zones.push({ kind: 'epool', x: px, y: py, r: 50, t: 4, max: 4, dps: m.atk * 0.45, color: 'rgba(110,255,90,0.25)' });
          } });
        }
      } else if (G.mons.filter(o => o.minion && !o.dead).length < 8) {
        floatText(m.x, m.y - 90, 'Ổ trứng nở!', '#ff8a5a', 11, 1);
        for (let i = 0; i < (enr ? 4 : 3); i++) { const s = spawnMonster('spider_r', m.x + rand(-70, 70), m.y + rand(-40, 60), G.world.floor - 2, false); s.minion = true; s.scale = 0.55; s.r = 9; s.maxHp = s.hp = Math.round(s.maxHp * 0.5); s.aggro = true; s.state = 'chase'; }
      }
    }
  } else if (pattern === 'dragon') {
    // bay vòng quanh người chơi
    const want = d < 160 ? -1 : (d > 260 ? 1 : 0);
    const a = angTo(m, P) + (want === 0 ? Math.PI / 2 * Math.sign(Math.sin(G.t * 0.4)) : 0);
    const dx = Math.cos(a) * (want === -1 ? -1 : 1), dy = Math.sin(a) * (want === -1 ? -1 : 1);
    moveEnt(m, dx * sp2 * dt, dy * sp2 * dt);
    m.dir = P.x < m.x ? DIR.LEFT : DIR.RIGHT; m.moving = true;
    if (m.pt <= 0) {
      m.pt = rand(2.4, 3.0) * cdm;
      const r = Math.random();
      if (r < 0.4) {
        const ba = angTo({ x: m.x, y: m.y - 40 }, P);
        warn({ shape: 'cone', x: m.x, y: m.y - 30, ang: ba, arc: 0.85, len: 300, t: 0.8, onDone: () => {
          let tick = 0;
          m.act = { name: 'walk', update: (dt2) => {
            tick -= dt2;
            for (let k = 0; k < 3; k++) { const aa = ba + rand(-0.4, 0.4), s = rand(200, 320); G.fx.push({ x: m.x, y: m.y - 30, vx: Math.cos(aa) * s, vy: Math.sin(aa) * s, life: 0.9, max: 0.9, color: pick(['#ff6a2a', '#ffb03a', '#ff3a1a']), size: rand(3, 6), grav: 0, glow: true }); }
            if (tick <= 0) {
              tick = 0.2;
              const pd = Math.hypot(P.x - m.x, P.y - (m.y - 30)), pa = Math.atan2(P.y - (m.y - 30), P.x - m.x);
              if (pd < 300 && Math.abs(angDiff(ba, pa)) < 0.45) hurtPlayer(m.atk * 0.5, m, { effect: 'burn' });
            }
          } };
          m.actT = 1.2; sfx('boom');
        } });
        m.act = { name: 'walk' }; m.actT = 0.8;
      } else if (r < 0.75) {
        floatText(m.x, m.y - 150, 'Mưa Lửa!', '#ff8a5a', 12, 1);
        const n = enr ? 9 : 6;
        for (let i = 0; i < n; i++) {
          const px = P2.x + rand(-120, 120), py = P2.y + rand(-90, 90);
          after(i * 0.12, () => warn({ shape: 'circle', x: px, y: py, r: 46, t: 0.9, onDone: () => {
            particles(px, py, '#ff8a3a', 18, 140, 0.6, 3); ring(px, py, 46, '#ff6a2a', 0.3, 4); G.shake = Math.max(G.shake, 4); sfx('boom');
            if (Math.hypot(P.x - px, (P.y - py) * 1.15) < 46 + P.r) hurtPlayer(m.atk * 0.9, m, { effect: 'burn' });
          } }));
        }
      } else {
        m.act = { name: 'walk' }; m.actT = 0.6;
        const n = enr ? 18 : 12;
        after(0.5, () => { for (let i = 0; i < n; i++) enemyProj(m, 'fire', m.x, m.y - 40, i / n * 6.283 + G.t, 190, m.atk * 0.7, { effect: 'burn' }); sfx('magic'); });
      }
    }
  }
}

// ---------- Đạn ----------
function updateProjs(dt) {
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    let dead = p.life <= 0;
    if (p.kind === 'fire' && Math.random() < 0.7) G.fx.push({ x: p.x, y: p.y, vx: rand(-15, 15), vy: rand(-15, 15), life: 0.35, max: 0.35, color: pick(['#ff8a3a', '#ffcf5a']), size: rand(2, 4), glow: true });
    if (p.kind === 'arcane' && Math.random() < 0.6) G.fx.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#c9a6ff', size: 2.5, glow: true });
    if (solidAt(p.x, p.y + 14)) dead = true;
    if (p.owner === 'p') {
      if (!dead) for (const m of G.mons) {
        if (m.dead || p.hit.has(m.id)) continue;
        const hy = m.y - Math.min(20, (m.spr.foot || 30) * m.scale * 0.4);
        if (Math.hypot(m.x - p.x, hy - p.y) < m.r + p.r + 4) {
          p.hit.add(m.id);
          if (p.explode) { dead = true; break; }
          hitMonster(m, p.mult, Object.assign({ kx: p.vx / 400, ky: p.vy / 400, knock: 25 }, p.opt));
          if (p.pierce > 0) p.pierce--; else { dead = true; break; }
        }
      }
      if (dead && p.explode) {
        particles(p.x, p.y, '#ff8a3a', 20, 130, 0.5, 3); ring(p.x, p.y, p.explode, '#ff8a3a', 0.3, 4); sfx('boom');
        aoeHit(p.x, p.y + 10, p.explode, p.mult, p.opt);
      } else if (dead) particles(p.x, p.y, p.kind === 'arcane' ? '#c9a6ff' : '#ddd', 4, 50, 0.25, 1.5);
    } else {
      if (!dead && Math.hypot(P.x - p.x, (P.y - 16) - p.y) < P.r + p.r) {
        hurtPlayer(p.dmg, p.src, { effect: p.effect || (p.kind === 'ice' ? 'slow' : p.kind === 'spit' ? 'poison' : null) });
        dead = true;
      }
      if (dead) particles(p.x, p.y, p.kind === 'fire' ? '#ff8a3a' : '#aaa', 6, 60, 0.3, 2);
    }
    if (dead) G.projs.splice(i, 1);
  }
}
function updateZones(dt) {
  for (let i = G.zones.length - 1; i >= 0; i--) {
    const z = G.zones[i];
    z.t -= dt;
    if (z.kind === 'epool') {
      z.acc = (z.acc || 0) + dt;
      if (z.acc > 0.5) { z.acc = 0; if (Math.hypot(P.x - z.x, (P.y - z.y) * 1.15) < z.r + P.r) hurtPlayer(z.dps * 0.5, null, { effect: 'poison' }); }
    }
    if (z.t <= 0) { G.zones.splice(i, 1); z.onDone && z.onDone(); }
  }
}
function updateDrops(dt) {
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    d.t += dt;
    if (d.z > 0 || d.vz > 0) { d.vz -= 500 * dt; d.z += d.vz * dt; if (d.z < 0) { d.z = 0; d.vz = d.vz < -60 ? -d.vz * 0.35 : 0; } }
    if (d.t < 0.4) continue;
    const dd = Math.hypot(P.x - d.x, P.y - d.y);
    if (d.kind !== 'item' && dd < 70) { d.x += (P.x - d.x) * Math.min(1, dt * 8); d.y += (P.y - d.y) * Math.min(1, dt * 8); }
    if (dd < 20) { if (pickupDrop(d)) G.drops.splice(i, 1); }
  }
  for (const c of G.chests) if (!c.opened && Math.hypot(P.x - c.x, P.y - c.y) < 26) openChest(c);
}
function updateFx(dt) {
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    f.life -= dt;
    if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.grav || 0) * dt; f.vx *= 0.96; f.vy *= 0.96; }
    if (f.life <= 0) G.fx.splice(i, 1);
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const t = G.texts[i];
    t.life -= dt; t.y += t.vy * dt; t.vy *= 0.94;
    if (t.life <= 0) G.texts.splice(i, 1);
  }
  G.shake = Math.max(0, G.shake - dt * 30);
}
function updatePrompt() {
  G.prompt = null;
  if (G.world.town) {
    for (const n of G.world.npcs) if (Math.hypot(P.x - n.x, P.y - n.y) < 52) { G.prompt = { kind: 'npc', target: n, text: `[E] ${n.name}` }; break; }
    if (!G.prompt && Math.hypot(P.x - (G.world.gate.x + 16), P.y - (G.world.gate.y + 24)) < 50) G.prompt = { kind: 'gate', target: { x: G.world.gate.x + 16, y: G.world.gate.y + 30 }, text: '[E] Vào Hầm Ngục' };
  } else if (G.door && G.door.open && Math.hypot(P.x - G.door.x, P.y - G.door.y) < 34) {
    G.prompt = { kind: 'door', target: G.door, text: `[E] Xuống Tầng ${G.world.floor + 1}` };
  }
  UI.setPrompt(G.prompt);
}

// ---------- Render ----------
function drawFrame(img, sx, sy, sw, sh, dx, dy, dw, dh, o = {}) {
  const cx = G.cx;
  if (!img || (img instanceof HTMLImageElement && (!img.complete || !img.naturalWidth))) return;
  cx.save();
  if (o.alpha != null) cx.globalAlpha = o.alpha;
  if (o.flip) { cx.translate(dx + dw, dy); cx.scale(-1, 1); dx = 0; dy = 0; }
  if (o.flash > 0) {
    const t = G.tmp, tx = G.tmpx;
    if (t.width < sw || t.height < sh) { t.width = Math.max(t.width, sw); t.height = Math.max(t.height, sh); }
    tx.clearRect(0, 0, sw, sh);
    tx.globalCompositeOperation = 'source-over';
    tx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    tx.globalCompositeOperation = 'source-atop';
    tx.fillStyle = o.flashColor || 'rgba(255,255,255,0.85)';
    tx.fillRect(0, 0, sw, sh);
    tx.globalCompositeOperation = 'source-over';
    cx.drawImage(t, 0, 0, sw, sh, dx, dy, dw, dh);
  } else cx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  cx.restore();
}
function shadow(x, y, rw, rh, a = 0.35) {
  const cx = G.cx;
  cx.fillStyle = `rgba(0,0,0,${a})`;
  cx.beginPath(); cx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2); cx.fill();
}
function drawHeroAt(src, x, y, dir, animName, animT, animDur, o = {}) {
  const A = HERO_ANIM[animName] || HERO_ANIM.idle;
  let idx;
  if (animName === 'walk') idx = Math.floor(animT * 11) % A.frames.length;
  else if (animName === 'idle') idx = Math.floor(animT * 2.5) % A.frames.length;
  else idx = Math.min(A.frames.length - 1, Math.floor(animT / Math.max(0.01, animDur) * A.frames.length));
  const col = A.frames[idx];
  if (src.big && src.bigHas[animName]) {
    const row = (animName === 'slash' ? 0 : 4) + dir;
    drawFrame(src.big, col * 192, row * 192, 192, 192, Math.round(x - 96), Math.round(y - 124), 192, 192, o);
    return;
  }
  const row = A.row + (A.noDir ? 0 : dir);
  drawFrame(src.img, col * 64, row * 64, 64, 64, Math.round(x - 32), Math.round(y - 60), 64, 64, o);
}
function drawPlayer() {
  const cx = G.cx;
  shadow(P.x, P.y - 1, 11, 4.5);
  let anim = P.anim, at = P.animT, dur = P.animDur;
  if (G.dead) { anim = 'hurt'; dur = 0.6; }
  else if (anim !== 'walk' && anim !== 'idle' && at >= dur) { anim = P.moving ? 'walk' : 'idle'; }
  if (P.hurtT > 0 && anim === 'idle') anim = 'stand';
  const alpha = P.st.stealth ? 0.35 : 1;
  if (P.buffs.some(b => b.id === 'k_wall')) { cx.strokeStyle = `rgba(159,193,255,${0.4 + 0.2 * Math.sin(G.t * 8)})`; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(P.x, P.y - 22, 20, 28, 0, 0, 6.283); cx.stroke(); }
  if (P.buffs.some(b => b.id === 'h_angel')) { const gr = cx.createRadialGradient(P.x, P.y - 24, 4, P.x, P.y - 24, 40); gr.addColorStop(0, 'rgba(255,240,160,0.5)'); gr.addColorStop(1, 'rgba(255,240,160,0)'); cx.fillStyle = gr; cx.fillRect(P.x - 40, P.y - 64, 80, 80); }
  drawHeroAt(heroSrc(P.ch), P.x, P.y, P.dir, anim, at, dur, { alpha, flash: P.flash, flashColor: 'rgba(255,60,60,0.7)' });
  if (P.status.stun) drawStunStars(P.x, P.y - 56);
}
function drawStunStars(x, y) {
  const cx = G.cx;
  cx.fillStyle = '#ffe96a';
  for (let i = 0; i < 3; i++) { const a = G.t * 5 + i * 2.1; cx.fillRect(x + Math.cos(a) * 10 - 1.5, y + Math.sin(a) * 3 - 1.5, 3, 3); }
}
function monFrame(m) {
  const S = m.spr;
  let img = IMG[S.img], fw = S.fw, fh = S.fh, frames = S.walk, row = 0, col = 0, foot = S.foot;
  if (m.dead) {
    if (S.death) { img = IMG[S.deathImg || S.img]; row = S.death.row; const k = Math.min(S.death.frames.length - 1, Math.floor(m.deadT * 10)); col = S.death.frames[k]; return { img, sx: col * fw, sy: row * fh, fw, fh, foot }; }
  }
  const attacking = (m.state === 'windup' || (m.act && m.act.name === 'atk')) && S.atk;
  if (S.side) {
    const k = Math.floor(m.animT * 9) % frames.length;
    const f = frames[k];
    return { img, sx: (f % 4) * fw, sy: Math.floor(f / 4) * fh, fw, fh, foot, flip: m.dir === DIR.LEFT };
  }
  row = S.rows[m.dir];
  if (attacking) {
    img = IMG[S.atkImg || S.img];
    if (S.afh) { fh = S.afh; foot = S.foot + (S.afh - S.fh); }
    const k = Math.min(S.atk.length - 1, Math.floor(m.animT * 10));
    col = S.atk[k];
  } else {
    const anim = m.moving || S.fly || m.d.ai === 'turret';
    col = anim ? frames[Math.floor(m.animT * 8) % frames.length] : frames[0];
  }
  return { img, sx: col * fw, sy: row * fh, fw, fh, foot };
}
function drawMonster(m) {
  const cx = G.cx;
  const F = monFrame(m);
  const s = m.scale;
  const fly = m.spr.fly || m.d.flying;
  let alpha = 1;
  if (m.dead) alpha = m.spr.death ? Math.max(0, 1 - Math.max(0, m.deadT - 0.6) / 0.6) : Math.max(0, 1 - m.deadT / 0.6);
  if (m.d.ghostly) alpha *= 0.8;
  shadow(m.x, m.y, m.r * 0.95, m.r * 0.38, fly ? 0.22 : 0.35);
  if (m.elite && !m.dead) {
    const gr = cx.createRadialGradient(m.x, m.y, 2, m.x, m.y, m.r * 2);
    gr.addColorStop(0, `rgba(255,190,60,${0.35 + 0.15 * Math.sin(G.t * 5)})`); gr.addColorStop(1, 'rgba(255,190,60,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.ellipse(m.x, m.y, m.r * 2, m.r * 0.9, 0, 0, 6.283); cx.fill();
  }
  if (m.boss && !m.dead) {
    const gr = cx.createRadialGradient(m.x, m.y, 4, m.x, m.y, m.r * 2.4);
    gr.addColorStop(0, 'rgba(255,40,40,0.35)'); gr.addColorStop(1, 'rgba(255,40,40,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.ellipse(m.x, m.y, m.r * 2.4, m.r, 0, 0, 6.283); cx.fill();
  }
  const bob = fly && !m.dead ? Math.sin(G.t * 6 + m.id) * 2.5 - 4 : 0;
  const dw = F.fw * s, dh = F.fh * s;
  const shake = m.state === 'windup' && !m.boss ? rand(-1, 1) : 0;
  drawFrame(F.img, F.sx, F.sy, F.fw, F.fh, Math.round(m.x - dw / 2 + shake), Math.round(m.y - F.foot * s + bob), dw, dh,
    { alpha, flip: F.flip, flash: m.flash > 0 ? 1 : (m.status.slow ? 0 : 0), flashColor: 'rgba(255,255,255,0.85)' });
  if (m.dead) return;
  if (m.status.slow) { cx.fillStyle = 'rgba(150,220,255,0.25)'; cx.beginPath(); cx.ellipse(m.x, m.y - 4, m.r, m.r * 0.5, 0, 0, 6.283); cx.fill(); }
  if (m.status.stun) drawStunStars(m.x, m.y - F.foot * s - 4);
  // thanh máu
  if (!m.boss && (m.hp < m.maxHp || m.elite)) {
    const w = Math.max(22, m.r * 2.2), y = m.y - F.foot * s - 6 + bob;
    cx.fillStyle = 'rgba(0,0,0,0.6)'; cx.fillRect(m.x - w / 2 - 1, y - 1, w + 2, 5);
    cx.fillStyle = m.elite ? '#ffb43a' : '#e04545'; cx.fillRect(m.x - w / 2, y, w * Math.max(0, m.hp / m.maxHp), 3);
    if (m.elite) { cx.font = 'bold 7px Bungee, "Alegreya Sans", sans-serif'; cx.textAlign = 'center'; cx.fillStyle = '#000'; cx.fillText(m.name, m.x + 0.5, y - 3.5); cx.fillStyle = '#ffcf5a'; cx.fillText(m.name, m.x, y - 4); }
  }
}
function drawNPC(n) {
  const S = SPR[n.spr];
  shadow(n.x, n.y - 1, 11, 4.5);
  const bob = Math.floor(G.t * 1.5 + n.x) % 2;
  drawFrame(IMG[S.img], 0, S.rows[n.dir] * 64, 64, 64, Math.round(n.x - 32), Math.round(n.y - 61 - bob * 0.5), 64, 64);
  const cx = G.cx;
  cx.font = '8px Bungee, "Alegreya Sans", sans-serif'; cx.textAlign = 'center';
  cx.fillStyle = '#000'; cx.fillText(n.name, n.x + 0.5, n.y - 62.5);
  cx.fillStyle = '#ffe9a8'; cx.fillText(n.name, n.x, n.y - 63);
  // dấu ! nhấp nháy
  cx.fillStyle = '#ffd23a'; cx.font = '10px Bungee, "Alegreya Sans", sans-serif'; cx.fillText('!', n.x, n.y - 74 + Math.sin(G.t * 4) * 2);
}
function drawDeco(d) {
  const img = IMG['deco_' + d.kind];
  if (!img) return;
  if (d.kind === 'pine') { shadow(d.x, d.y, 18, 6); G.cx.drawImage(img, d.x - 32, d.y - 150, 64, 160); }
  else if (d.kind === 'oak') { shadow(d.x, d.y, 24, 8); G.cx.drawImage(img, d.x - 52, d.y - 118, 104, 128); }
  else G.cx.drawImage(img, d.x - 48, d.y - 32, 96, 32);
}
function drawDrop(d) {
  const cx = G.cx;
  const y = d.y - d.z - (d.z === 0 ? Math.sin(G.t * 3 + d.bob) * 1.5 : 0);
  shadow(d.x, d.y + 2, 6, 2.5, 0.3);
  if (d.kind === 'gold') cx.drawImage(IMG.i_gold, d.x - 10, y - 12, 20, 20);
  else if (d.kind === 'hp' || d.kind === 'mp') {
    const img = d.kind === 'hp' ? iconImg('hpot', '#e0413c') : iconImg('hpot', '#3c7ae0');
    if (img) cx.drawImage(img, d.x - 9, y - 16, 18, 18);
  } else if (d.kind === 'stone') { const img = iconImg('stone', '#9fe6ff'); if (img) cx.drawImage(img, d.x - 8, y - 14, 16, 16); }
  else if (d.kind === 'item') {
    const it = d.val, col = RARITY[it.rarity].color;
    if (it.rarity >= 2) {
      const gr = cx.createLinearGradient(0, y - 60, 0, y);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col + '88');
      cx.fillStyle = gr; cx.fillRect(d.x - 2, y - 60, 4, 56);
    }
    const img = iconImg(itemIcon(it), col);
    if (img) cx.drawImage(img, d.x - 10, y - 18, 20, 20);
    if (Math.hypot(P.x - d.x, P.y - d.y) < 110) {
      cx.font = '7px Bungee, "Alegreya Sans", sans-serif'; cx.textAlign = 'center';
      const name = it.name;
      const w = cx.measureText(name).width + 6;
      cx.fillStyle = 'rgba(0,0,0,0.7)'; cx.fillRect(d.x - w / 2, y - 31, w, 10);
      cx.fillStyle = col; cx.fillText(name, d.x, y - 23);
    }
  }
}
const _iconImgCache = {};
function iconImg(name, color) {
  const k = name + color;
  if (!_iconImgCache[k]) { const im = new Image(); im.src = iconURL(name, color, 2); _iconImgCache[k] = im; }
  return _iconImgCache[k].complete ? _iconImgCache[k] : null;
}
function drawChest(c) {
  const img = IMG.chests;
  shadow(c.x, c.y + 2, 14, 4);
  if (c.opened) G.cx.drawImage(img, 0, 64, 32, 32, c.x - 16, c.y - 26, 32, 32);
  else {
    G.cx.drawImage(img, 0, 32, 32, 32, c.x - 16, c.y - 26, 32, 32);
    if (c.rich) { G.cx.fillStyle = `rgba(255,215,90,${0.25 + 0.2 * Math.sin(G.t * 4)})`; G.cx.fillRect(c.x - 16, c.y - 26, 32, 32); }
  }
}
function drawDoor(dr) {
  const cx = G.cx;
  const gr = cx.createRadialGradient(dr.x, dr.y - 10, 4, dr.x, dr.y - 10, 50);
  gr.addColorStop(0, `rgba(180,110,255,${0.45 + 0.15 * Math.sin(G.t * 3)})`); gr.addColorStop(1, 'rgba(180,110,255,0)');
  cx.fillStyle = gr; cx.fillRect(dr.x - 50, dr.y - 60, 100, 100);
  cx.drawImage(IMG.door, dr.x - 24, dr.y - 46, 48, 48);
  for (let i = 0; i < 2; i++) if (Math.random() < 0.15) particles(dr.x + rand(-16, 16), dr.y - 4, '#c9a6ff', 1, 10, 1, 1.5, -40);
}
function drawZone(z) {
  const cx = G.cx;
  const k = 1 - z.t / z.max;
  if (z.kind === 'warn') {
    cx.save();
    const col = z.color || '#ff3030';
    cx.fillStyle = col + '33'; cx.strokeStyle = col + 'cc'; cx.lineWidth = 1.5;
    cx.beginPath();
    if (z.shape === 'circle') { cx.ellipse(z.x, z.y, z.r, z.r * 0.87, 0, 0, 6.283); cx.fill(); cx.stroke(); cx.fillStyle = col + '55'; cx.beginPath(); cx.ellipse(z.x, z.y, z.r * k, z.r * 0.87 * k, 0, 0, 6.283); cx.fill(); }
    else if (z.shape === 'cone') { cx.moveTo(z.x, z.y); cx.arc(z.x, z.y, z.len, z.ang - z.arc / 2, z.ang + z.arc / 2); cx.closePath(); cx.fill(); cx.stroke(); cx.fillStyle = col + '44'; cx.beginPath(); cx.moveTo(z.x, z.y); cx.arc(z.x, z.y, z.len * k, z.ang - z.arc / 2, z.ang + z.arc / 2); cx.closePath(); cx.fill(); }
    else if (z.shape === 'line') { cx.translate(z.x, z.y); cx.rotate(z.ang); cx.fillRect(0, -z.w / 2, z.len, z.w); cx.strokeRect(0, -z.w / 2, z.len, z.w); cx.fillStyle = col + '44'; cx.fillRect(0, -z.w / 2, z.len * k, z.w); }
    cx.restore();
  } else if (z.kind === 'pmeteor') {
    cx.strokeStyle = 'rgba(255,120,40,0.8)'; cx.lineWidth = 1.5; cx.beginPath(); cx.ellipse(z.x, z.y, z.r, z.r * 0.8, 0, 0, 6.283); cx.stroke();
    const my = z.y - 260 * (1 - k);
    const gr = cx.createRadialGradient(z.x + (1 - k) * 80, my, 1, z.x + (1 - k) * 80, my, 14);
    gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.4, '#ff8a3a'); gr.addColorStop(1, 'rgba(255,60,20,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.arc(z.x + (1 - k) * 80, my, 14, 0, 6.283); cx.fill();
  } else if (z.kind === 'pwarn') {
    cx.strokeStyle = `rgba(255,240,160,${0.5 + 0.5 * k})`; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(z.x, z.y, z.r, z.r * 0.8, 0, 0, 6.283); cx.stroke();
  } else if (z.kind === 'parea' || z.kind === 'epool') {
    cx.fillStyle = z.color; cx.beginPath(); cx.ellipse(z.x, z.y, z.r, z.r * 0.85, 0, 0, 6.283); cx.fill();
    if (z.kind === 'epool' && Math.random() < 0.3) particles(z.x + rand(-z.r, z.r) * 0.7, z.y + rand(-z.r, z.r) * 0.5, '#7dff6a', 1, 10, 0.6, 2, -30);
  }
}
function drawProj(p) {
  const cx = G.cx;
  cx.save(); cx.translate(p.x, p.y); cx.rotate(p.ang);
  switch (p.kind) {
    case 'arrow': case 'bigarrow': {
      const L = p.kind === 'bigarrow' ? 22 : 15;
      if (p.kind === 'bigarrow') { cx.fillStyle = 'rgba(255,243,176,0.35)'; cx.fillRect(-L - 10, -3, L + 10, 6); }
      cx.fillStyle = '#7a5230'; cx.fillRect(-L, -1, L, 2);
      cx.fillStyle = '#e6e6e6'; cx.beginPath(); cx.moveTo(4, 0); cx.lineTo(-2, -3); cx.lineTo(-2, 3); cx.fill();
      cx.fillStyle = '#f0f0f0'; cx.fillRect(-L, -3, 4, 2); cx.fillRect(-L, 1, 4, 2);
      break;
    }
    case 'dagger': cx.fillStyle = '#d6e0ea'; cx.fillRect(-6, -1.5, 10, 3); cx.fillStyle = '#8dff6a'; cx.fillRect(-9, -1, 3, 2); cx.rotate(G.t * 30); break;
    case 'rock': cx.fillStyle = '#7d7468'; cx.beginPath(); cx.arc(0, 0, p.r, 0, 6.283); cx.fill(); cx.fillStyle = '#a49a8c'; cx.fillRect(-3, -4, 4, 3); break;
    case 'web': cx.strokeStyle = '#f2f2f2'; cx.lineWidth = 1; for (let i = 0; i < 4; i++) { cx.rotate(0.785); cx.beginPath(); cx.moveTo(-6, 0); cx.lineTo(6, 0); cx.stroke(); } break;
    default: {
      const col = { fire: ['#fff6c0', '#ff8a3a'], arcane: ['#ffffff', '#a070ff'], orb: ['#ffd0ff', '#c040ff'], ice: ['#ffffff', '#6fd0ff'], spit: ['#eaffc0', '#6ad040'] }[p.kind] || ['#fff', '#f0f'];
      const r = p.kind === 'fire' && p.owner === 'p' ? 8 : 6;
      const gr = cx.createRadialGradient(0, 0, 1, 0, 0, r * 1.8);
      gr.addColorStop(0, col[0]); gr.addColorStop(0.45, col[1]); gr.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = gr; cx.beginPath(); cx.arc(0, 0, r * 1.8, 0, 6.283); cx.fill();
    }
  }
  cx.restore();
}
function drawFx(f) {
  const cx = G.cx, k = f.life / f.max;
  if (f.ring) {
    cx.strokeStyle = f.color; cx.globalAlpha = k; cx.lineWidth = f.width * k + 0.5;
    const r = lerp(f.r, f.r0, k);
    cx.beginPath(); cx.ellipse(f.x, f.y, r, r * 0.8, 0, 0, 6.283); cx.stroke(); cx.globalAlpha = 1;
  } else if (f.slash) {
    cx.save(); cx.globalAlpha = k; cx.strokeStyle = f.color; cx.lineCap = 'round';
    const a0 = f.ang - f.arc / 2, sweep = f.arc * (1 - k * 0.6);
    for (let i = 0; i < 3; i++) { cx.lineWidth = 4 - i; cx.beginPath(); cx.arc(f.x, f.y, f.range * (0.7 + i * 0.12), a0, a0 + sweep); cx.stroke(); }
    cx.restore();
  } else if (f.bolt) {
    cx.save(); cx.globalAlpha = k; cx.strokeStyle = f.color; cx.shadowColor = '#7fc8ff'; cx.shadowBlur = 8;
    for (let pass = 0; pass < 2; pass++) {
      cx.lineWidth = pass ? 1 : 3; cx.strokeStyle = pass ? '#ffffff' : f.color;
      cx.beginPath();
      for (let i = 0; i < f.pts.length - 1; i++) {
        const a = f.pts[i], b = f.pts[i + 1];
        cx.moveTo(a.x, a.y);
        for (let s = 1; s <= 6; s++) { const t = s / 6; cx.lineTo(lerp(a.x, b.x, t) + (s < 6 ? rand(-6, 6) : 0), lerp(a.y, b.y, t) + (s < 6 ? rand(-6, 6) : 0)); }
      }
      cx.stroke();
    }
    cx.restore();
  } else if (f.pillar) {
    const gr = cx.createLinearGradient(0, f.y - 260, 0, f.y);
    gr.addColorStop(0, 'rgba(255,250,200,0)'); gr.addColorStop(1, `rgba(255,240,150,${k * 0.8})`);
    cx.fillStyle = gr; cx.fillRect(f.x - 26 * k - 6, f.y - 260, (26 * k + 6) * 2, 262);
    cx.fillStyle = `rgba(255,250,210,${k * 0.5})`; cx.beginPath(); cx.ellipse(f.x, f.y, f.r * (1.2 - k * 0.2), f.r * 0.8, 0, 0, 6.283); cx.fill();
  } else if (f.arrowDrop) {
    const y = f.y - 80 * k;
    cx.strokeStyle = '#e8d3a0'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(f.x, y - 14); cx.lineTo(f.x, y); cx.stroke();
  } else {
    cx.globalAlpha = Math.min(1, k * 1.5);
    cx.fillStyle = f.color;
    const s = f.size * (f.glow ? k + 0.3 : 1);
    cx.fillRect(f.x - s / 2, f.y - s / 2, s, s);
    cx.globalAlpha = 1;
  }
}
function render() {
  const cx = G.cx, W = G.cv.width, H = G.cv.height;
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.imageSmoothingEnabled = false;
  cx.fillStyle = '#07060a'; cx.fillRect(0, 0, W, H);
  if (!G.running || !G.world) return;
  const mw = G.world.grid.w * TILE, mh = G.world.grid.h * TILE;
  let camx = P.x - G.vw / 2, camy = P.y - 20 - G.vh / 2;
  camx = mw <= G.vw ? (mw - G.vw) / 2 : clamp(camx, 0, mw - G.vw);
  camy = mh <= G.vh ? (mh - G.vh) / 2 : clamp(camy, -40, mh - G.vh);
  if (G.shake > 0) { camx += rand(-1, 1) * G.shake * 0.5; camy += rand(-1, 1) * G.shake * 0.5; }
  G.cam.x = camx; G.cam.y = camy;
  const z = G.zoom;
  cx.setTransform(z, 0, 0, z, Math.round(-camx * z), Math.round(-camy * z));
  cx.drawImage(G.mapCv, 0, 0);
  // ánh dung nham
  for (const zz of G.zones) if (zz.kind !== 'warn') drawZone(zz);
  for (const zz of G.zones) if (zz.kind === 'warn') drawZone(zz);
  if (G.door) drawDoor(G.door);
  for (const c of G.chests) drawChest(c);
  for (const d of G.drops) drawDrop(d);
  // sắp xếp theo y
  const list = [];
  list.push({ y: P.y, f: drawPlayer });
  for (const m of G.mons) if (Math.abs(m.x - P.x) < G.vw && Math.abs(m.y - P.y) < G.vh + 100) list.push({ y: m.y + (m.dead ? -100 : 0), f: () => drawMonster(m) });
  if (G.world.town) {
    for (const n of G.world.npcs) list.push({ y: n.y, f: () => drawNPC(n) });
    for (const d of G.world.deco) list.push({ y: d.y, f: () => drawDeco(d) });
  }
  list.sort((a, b) => a.y - b.y);
  for (const e of list) e.f();
  for (const p of G.projs) drawProj(p);
  for (const f of G.fx) drawFx(f);
  // ánh sáng
  if (!G.world.town && G.world.biome.dark > 0) drawLighting(camx, camy);
  cx.setTransform(z, 0, 0, z, Math.round(-camx * z), Math.round(-camy * z));
  // chữ nổi
  cx.textAlign = 'center';
  for (const t of G.texts) {
    const a = Math.min(1, t.life / t.max * 2);
    cx.globalAlpha = a;
    cx.font = `${t.size}px Bungee, "Alegreya Sans", sans-serif`;
    cx.fillStyle = '#000'; cx.fillText(t.txt, t.x + 1, t.y + 1);
    cx.fillStyle = t.color; cx.fillText(t.txt, t.x, t.y);
  }
  cx.globalAlpha = 1;
  // cổng dịch chuyển
  if (P.portal) {
    const k = 1 - P.portal.t / 1.5;
    cx.strokeStyle = '#b56cff'; cx.lineWidth = 2;
    cx.beginPath(); cx.arc(P.x, P.y - 70, 10, -Math.PI / 2, -Math.PI / 2 + k * 6.283); cx.stroke();
  }
  cx.setTransform(1, 0, 0, 1, 0, 0);
  if (P.hp / P.st.maxHp < 0.25 && !G.world.town) {
    const gr = cx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(160,0,0,0)'); gr.addColorStop(1, `rgba(160,0,0,${0.35 + 0.15 * Math.sin(G.t * 6)})`);
    cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
  }
}
function drawLighting(camx, camy) {
  const L = G.lightCv, lx = L.getContext('2d'), z = G.zoom;
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.globalCompositeOperation = 'source-over';
  lx.clearRect(0, 0, L.width, L.height);
  lx.fillStyle = `rgba(4,3,10,${G.world.biome.dark})`;
  lx.fillRect(0, 0, L.width, L.height);
  lx.globalCompositeOperation = 'destination-out';
  const light = (wx, wy, r, a = 1) => {
    const sx = (wx - camx) * z, sy = (wy - camy) * z, rr = r * z;
    const gr = lx.createRadialGradient(sx, sy, rr * 0.15, sx, sy, rr);
    gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    lx.fillStyle = gr; lx.beginPath(); lx.arc(sx, sy, rr, 0, 6.283); lx.fill();
  };
  light(P.x, P.y - 16, 230);
  if (G.door) light(G.door.x, G.door.y - 16, 90, 0.8);
  for (const p of G.projs) if (p.kind === 'fire' || p.kind === 'arcane') light(p.x, p.y, 60, 0.6);
  for (const z2 of G.zones) if (z2.kind === 'warn') light(z2.x, z2.y, (z2.r || 80) * 1.2, 0.7);
  for (const m of G.mons) if (m.boss && !m.dead) light(m.x, m.y - 30, 160, 0.6);
  G.cx.setTransform(1, 0, 0, 1, 0, 0);
  G.cx.drawImage(L, 0, 0);
}

// ---------- Minimap ----------
function drawMinimap(cv) {
  if (!G.running || !G.world || G.world.town || !G.explored) { cv.style.display = 'none'; return; }
  cv.style.display = 'block';
  const g = G.world.grid, mx = cv.getContext('2d');
  const s = Math.min(cv.width / g.w, cv.height / g.h);
  const ox = (cv.width - g.w * s) / 2, oy = (cv.height - g.h * s) / 2;
  mx.clearRect(0, 0, cv.width, cv.height);
  mx.fillStyle = 'rgba(10,8,16,0.75)'; mx.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!G.explored[x + y * g.w]) continue;
    const v = gget(g, x, y);
    if (!walkable(v)) continue;
    mx.fillStyle = v === T_LAVA ? '#a8401c' : '#6f6a7a';
    mx.fillRect(ox + x * s, oy + y * s, Math.ceil(s), Math.ceil(s));
  }
  if (G.door) { const tx = Math.floor(G.door.x / TILE), ty = Math.floor(G.door.y / TILE); if (G.explored[tx + ty * g.w]) { mx.fillStyle = '#c47aff'; mx.fillRect(ox + tx * s - 2, oy + ty * s - 2, 5, 5); } }
  for (const m of G.mons) {
    if (m.dead) continue;
    const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE);
    if (!G.explored[tx + ty * g.w]) continue;
    mx.fillStyle = m.boss ? '#ff2020' : (m.elite ? '#ffb43a' : '#e05050');
    mx.fillRect(ox + m.x / TILE * s - 1, oy + m.y / TILE * s - 1, m.boss ? 4 : 2, m.boss ? 4 : 2);
  }
  for (const c of G.chests) if (!c.opened) { const tx = Math.floor(c.x / TILE), ty = Math.floor(c.y / TILE); if (G.explored[tx + ty * g.w]) { mx.fillStyle = '#ffd23a'; mx.fillRect(ox + tx * s - 1, oy + ty * s - 1, 3, 3); } }
  mx.fillStyle = '#7dff8a';
  mx.fillRect(ox + P.x / TILE * s - 2, oy + P.y / TILE * s - 2, 4, 4);
}

// ---------- Vòng lặp ----------
let _last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - _last) / 1000 || 0);
  _last = ts;
  try {
    update(dt);
    render();
    UI.frame(dt);
  } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
