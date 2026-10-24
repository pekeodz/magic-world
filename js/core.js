// ============================================================
//  MAGIC WORLD — tiện ích, asset, lưu game, chỉ số, item
// ============================================================
'use strict';

// ---------- Tiện ích ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const hash2 = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0); };
const fmt = n => Math.round(n).toLocaleString('vi-VN');
function dirFromAngle(a) {
  const c = Math.cos(a), s = Math.sin(a);
  if (Math.abs(c) > Math.abs(s)) return c > 0 ? DIR.RIGHT : DIR.LEFT;
  return s > 0 ? DIR.DOWN : DIR.UP;
}
let _uid = 1; const uid = () => _uid++;

// ---------- Asset ----------
const IMG = {};
const ASSET_NAMES = [
  'hero_knight', 'hero_mage', 'hero_archer', 'hero_holy', 'hero_assassin', 'tiles',
  'm_slime', 'm_rat', 'm_bat', 'm_bee', 'm_snake', 'm_worm', 'm_eyeball', 'm_ghost', 'm_pumpking', 'm_bigworm', 'm_flower',
  'm_goblin', 'm_goblinsword', 'm_spider_g', 'm_spider_r', 'm_spider_b', 'm_spider_y',
  'm_imp_r_walk', 'm_imp_r_atk', 'm_imp_r_die', 'm_imp_b_walk', 'm_imp_b_atk', 'm_imp_b_die', 'm_imp_g_walk', 'm_imp_g_atk', 'm_imp_g_die',
  'b_golem_walk', 'b_golem_atk', 'b_golem_die', 'b_dragon',
  'hud', 'i_gold', 'i_potion', 'door', 'chests', 'npc_merchant', 'npc_smith', 'npc_guard',
  'deco_pine', 'deco_oak', 'deco_rocks', 'deco_arch', 'deco_tower', 'deco_wall', 'deco_banner0', 'deco_banner1', 'deco_banner2', 'deco_banner3', 'deco_banner4', 'signpost',
];
let TILEMETA = null;
function loadAssets(onProgress) {
  let done = 0;
  const total = ASSET_NAMES.length + 1;
  const ps = ASSET_NAMES.map(n => new Promise(res => {
    const im = new Image();
    im.onload = () => { done++; onProgress && onProgress(done / total); res(); };
    im.onerror = () => { console.warn('Thiếu asset', n); done++; res(); };
    im.src = 'assets/' + n + '.png';
    IMG[n] = im;
  }));
  ps.push(fetch('assets/tiles.json').then(r => r.json()).then(j => { TILEMETA = j; done++; onProgress && onProgress(done / total); }));
  return Promise.all(ps);
}

// ---------- Lưu game ----------
const SAVE_KEY = 'magicworld_save_v1';
const Save = {
  data: { chars: [], unlocks: {} },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.chars)) this.data = Object.assign({ chars: [], unlocks: {} }, d); }
    } catch (e) { console.warn('Không đọc được save', e); }
  },
  store() {
    this.data.updatedAt = Date.now();
    if (typeof Cloud !== 'undefined') Cloud.queue();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); return true; } catch (e) { return false; }
  },
};

// ---------- Nhân vật ----------
function newChar(name, cls) {
  const c = CLASSES[cls];
  const ch = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, cls, lvl: 1, xp: 0, gold: 60,
    attrs: Object.assign({}, c.attrs), freeAttr: 0, skillPts: 1, skills: {},
    equip: {}, bag: [], potions: { hp: 4, mp: 3 }, stones: 0,
    maxFloor: 1, kills: 0, deaths: 0, bossKills: 0, created: Date.now(), playTime: 0,
  };
  const w = genItem(1, { slot: 'weapon', wtype: CLASS_WEAPON[cls], rarity: 0 });
  ch.equip.weapon = w;
  ch.equip.armor = genItem(1, { slot: 'armor', rarity: 0 });
  return ch;
}

// ---------- Item ----------
function rollRarity(mf, minR = 0, floor = 1) {
  const m = 1 + (mf || 0) / 100;
  const fb = 1 + floor * 0.03;
  const r = Math.random() * 100;
  let rar = 0;
  if (r < 0.7 * m * fb) rar = 4;
  else if (r < 3.5 * m * fb) rar = 3;
  else if (r < 12 * m * fb) rar = 2;
  else if (r < 38 * m) rar = 1;
  return Math.max(rar, minR);
}
function roundStat(k, v) {
  const a = AFFIXES.find(x => x.k === k);
  if (a && a.dec) return Math.round(v * 10) / 10;
  return Math.max(1, Math.round(v));
}
function genItem(ilvl, opt = {}) {
  ilvl = Math.max(1, ilvl);
  const slot = opt.slot || pick(SLOTS.concat(['weapon', 'weapon']));
  const rarity = opt.rarity != null ? opt.rarity : rollRarity(opt.mf, opt.minR || 0, ilvl);
  const R = RARITY[rarity];
  let wtype = null;
  if (slot === 'weapon') wtype = opt.wtype || (opt.cls && Math.random() < 0.6 ? CLASS_WEAPON[opt.cls] : pick(Object.keys(WEAPON_TYPES)));
  const tier = Math.min(5, Math.floor((ilvl - 1) / 6));
  const base = {};
  const v = () => R.mult * rand(0.9, 1.1);
  switch (slot) {
    case 'weapon':
      base.atk = (4 + ilvl * 2.0) * v();
      if (wtype === 'sword') base.hp = (8 + ilvl * 3) * v();
      if (wtype === 'staff') base.mp = (10 + ilvl * 3) * v();
      if (wtype === 'bow') base.crit = 3 + tier;
      if (wtype === 'dagger') base.aspdPct = 6 + tier * 2;
      break;
    case 'helm': base.def = (1 + ilvl * 0.6) * v(); base.hp = (8 + ilvl * 3) * v(); break;
    case 'armor': base.def = (2 + ilvl * 1.1) * v(); base.hp = (14 + ilvl * 6) * v(); break;
    case 'gloves': base.def = (1 + ilvl * 0.4) * v(); base.atk = (1 + ilvl * 0.5) * v(); break;
    case 'boots': base.def = (1 + ilvl * 0.5) * v(); base.movePct = 4 + tier; break;
  }
  for (const k in base) base[k] = roundStat(k, base[k]);
  let nAff = R.affix + ((slot === 'ring' || slot === 'amulet') ? 1 : 0);
  const affixes = [];
  const used = new Set();
  const pool = AFFIXES.slice();
  while (affixes.length < nAff && pool.length) {
    // chọn theo trọng số
    const tw = pool.reduce((s, a) => s + a.w, 0);
    let r = Math.random() * tw, idx = 0;
    for (; idx < pool.length; idx++) { r -= pool[idx].w; if (r <= 0) break; }
    const a = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
    if (used.has(a.k)) continue;
    used.add(a.k);
    const [mn, mx] = a.r(ilvl);
    let val = lerp(mn, mx, Math.random()) * (0.85 + 0.15 * R.mult);
    affixes.push({ k: a.k, v: roundStat(a.k, val) });
  }
  let name = TIER_NAMES[slot === 'weapon' ? wtype : slot][tier];
  let legend = false;
  if (rarity === 4) {
    legend = true;
    name = pick(LEGEND_NAMES[slot === 'weapon' ? wtype : slot]);
    // affix huyền thoại: x2 một chỉ số mạnh
    const big = pick(['dmgPct', 'critDmg', 'atk', 'hp', 'lifesteal', 'cdr']);
    const a = AFFIXES.find(x => x.k === big);
    const [mn, mx] = a.r(ilvl);
    const ex = affixes.find(x => x.k === big);
    if (ex) ex.v = roundStat(big, ex.v + mx * 1.5); else affixes.push({ k: big, v: roundStat(big, mx * 2) });
  }
  return { id: uid() + '_' + Math.random().toString(36).slice(2, 7), slot, wtype, name, rarity, ilvl, base, affixes, plus: 0, legend };
}
function itemStats(it) {
  const s = {};
  const pm = 1 + 0.1 * (it.plus || 0);
  for (const k in it.base) s[k] = (s[k] || 0) + (PCT_STATS.has(k) ? it.base[k] : it.base[k] * pm);
  for (const a of it.affixes) s[a.k] = (s[a.k] || 0) + a.v;
  return s;
}
function itemIcon(it) {
  if (it.slot === 'weapon') return WEAPON_TYPES[it.wtype].icon;
  return it.slot;
}
function itemDisplayName(it) { return it.name + (it.plus ? ` +${it.plus}` : ''); }
function sellValue(it) { return Math.round((5 + it.ilvl * 3) * (1 + it.rarity * it.rarity * 0.8) * (1 + (it.plus || 0) * 0.25)); }
function buyValue(it) { return sellValue(it) * 4; }
function upgradeCost(it) { return { gold: Math.round((40 + it.ilvl * 8) * (it.plus + 1)), stones: it.plus + 1 }; }
function salvageValue(it) { return { stones: 1 + it.rarity + (it.rarity === 4 ? 4 : 0) + Math.floor((it.plus || 0) / 2), gold: Math.round(sellValue(it) * 0.3) }; }
function canEquip(ch, it) {
  if (it.slot !== 'weapon') return true;
  return WEAPON_TYPES[it.wtype].classes.includes(ch.cls);
}
function potionPrice(ch, kind) { return kind === 'hp' ? 18 + ch.lvl * 4 : 14 + ch.lvl * 3; }

// ---------- Chỉ số ----------
function calcStats(ch, buffs) {
  const c = CLASSES[ch.cls];
  const L = ch.lvl;
  const eq = {};
  for (const sl of SLOTS) {
    const it = ch.equip[sl];
    if (!it) continue;
    const s = itemStats(it);
    for (const k in s) eq[k] = (eq[k] || 0) + s[k];
  }
  const pas = {};
  for (const sk of c.skills) {
    const d = SKILLS[sk], lv = ch.skills[sk] || 0;
    if (d.passive && lv > 0) { const p = d.pass(lv); for (const k in p) pas[k] = (pas[k] || 0) + p[k]; }
  }
  const bf = {};
  if (buffs) for (const b of buffs) for (const k in b.mods) bf[k] = (bf[k] || 0) + b.mods[k];
  const g = k => (eq[k] || 0) + (pas[k] || 0) + (bf[k] || 0);
  const at = {
    str: ch.attrs.str + (eq.str || 0), int: ch.attrs.int + (eq.int || 0),
    agi: ch.attrs.agi + (eq.agi || 0), vit: ch.attrs.vit + (eq.vit || 0),
  };
  const mainV = at[c.main];
  const st = {};
  st.attrs = at;
  st.maxHp = Math.round((c.base.hp + c.grow.hp * (L - 1) + at.vit * 12 + (eq.hp || 0)) * (1 + g('hpPct') / 100));
  st.maxMp = Math.round((c.base.mp + c.grow.mp * (L - 1) + at.int * 6 + (eq.mp || 0)) * (1 + g('mpPct') / 100));
  st.atk = (c.base.atk + c.grow.atk * (L - 1) + mainV * 2 + (eq.atk || 0)) * (1 + g('atkPct') / 100);
  st.def = (c.base.def + c.grow.def * (L - 1) + at.vit * 0.6 + at.str * 0.5 + (eq.def || 0)) * (1 + g('defPct') / 100);
  st.crit = Math.min(75, c.base.crit + at.agi * 0.3 + g('crit'));
  st.critDmg = c.base.critDmg + g('critDmg');
  const aspdBonus = at.agi * 0.5 + g('aspdPct');
  st.aspd = c.base.aspd / (1 + aspdBonus / 100);
  st.aspdPct = aspdBonus;
  st.move = c.base.move * Math.min(1.7, 1 + g('movePct') / 100);
  st.dmgPct = g('dmgPct');
  st.skillPct = at.int * 0.6;
  st.hpRegen = 0.5 + at.vit * 0.05 + g('hpRegen') + (bf.hpRegenFlat || 0);
  st.mpRegen = 1 + L * 0.05 + at.int * 0.05 + g('mpRegen');
  st.lifesteal = g('lifesteal');
  st.cdr = Math.min(40, g('cdr'));
  st.dodge = Math.min(40, g('dodge'));
  st.block = Math.min(40, g('block'));
  st.thorns = g('thorns');
  st.goldFind = g('goldFind');
  st.magicFind = g('magicFind');
  st.stealth = (bf.stealth || 0) > 0;
  st.ambush = bf.ambush || 0;
  return st;
}

// ---------- Icon pixel → dataURL (cache) ----------
const _iconCache = {};
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function iconURL(name, color, scale = 4) {
  const key = name + color + scale;
  if (_iconCache[key]) return _iconCache[key];
  const rows = ICONS[name] || ICONS.ring;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 12 * scale;
  const cx = cv.getContext('2d');
  const pal = { '1': '#1a1220', '2': shade(color, -0.15), '3': shade(color, 0.45), '4': '#f5c542', '5': '#8a5a2b', '6': shade(color, -0.45) };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (!pal[ch]) continue;
      cx.fillStyle = pal[ch];
      cx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return (_iconCache[key] = cv.toDataURL());
}
