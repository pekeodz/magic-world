// ============================================================
//  MAGIC WORLD — hệ thống ngoại hình: ghép layer + đổi màu theo bảng màu
//  Dữ liệu: assets/look/catalog.json (tạo bởi tools/build_looks.py)
// ============================================================
'use strict';

const LOOK_ORDER = ['body', 'head', 'eyes', 'nose', 'ears', 'shoes', 'pants', 'shirt', 'belt', 'gloves', 'jacket',
  'facial', 'hair', 'hairadd', 'horns', 'hat', 'glasses', 'mask', 'tail', 'wings', 'back', 'offhand', 'mainhand'];
const CHAR_SLOTS_L = ['body', 'head', 'ears', 'eyes', 'nose', 'hair', 'hairadd', 'facial', 'horns', 'tail', 'wings'];
const GEAR_SLOTS_L = ['shirt', 'jacket', 'pants', 'shoes', 'belt', 'gloves', 'back', 'hat', 'glasses', 'mask', 'mainhand', 'offhand'];
const SKIN_SLOTS = ['body', 'head', 'ears', 'nose'];
const HAIR_SLOTS = ['hair', 'hairadd', 'facial'];
const LOOK_SLOT_NAME = {
  body: 'Thân', head: 'Đầu', ears: 'Tai', eyes: 'Mắt', nose: 'Mũi', hair: 'Kiểu tóc', hairadd: 'Tóc thêm', facial: 'Râu',
  horns: 'Sừng', tail: 'Đuôi', wings: 'Cánh', shirt: 'Áo', jacket: 'Áo khoác / Váy', pants: 'Quần', shoes: 'Giày',
  belt: 'Thắt lưng', gloves: 'Găng tay', back: 'Sau lưng', hat: 'Mũ / Mũ giáp', glasses: 'Kính / Khăn', mask: 'Mặt nạ',
  mainhand: 'Vũ khí', offhand: 'Khiên',
};
// Việt hóa sơ bộ tên item (thay theo từ)
const LOOK_WORDS = {
  None: 'Không', Shirt: 'Áo', Longsleeved: 'Áo dài tay', Shortsleeved: 'Áo ngắn tay', Blouse: 'Áo kiểu', Vest: 'Gi-lê', Tunic: 'Áo chẽn',
  Robes: 'Áo choàng pháp sư', Dress: 'Váy', Corset: 'Áo nịt', Kimono: 'Kimono', Leather: 'Da', Mail: 'Giáp xích', Plate: 'Giáp tấm',
  Arms: 'tay', Legion: 'Lê dương', Formal: 'Lịch lãm', Fancy: 'Sang trọng', Tanktop: 'Áo ba lỗ', Jacket: 'Áo khoác', Frock: 'Áo choàng dài',
  Trenchcoat: 'Áo măng tô', Apron: 'Tạp dề', Skirt: 'Váy', Overalls: 'Quần yếm', Tabard: 'Áo tabard', Pants: 'Quần', Loose: 'Rộng',
  Leggings: 'Quần bó', Boots: 'Ủng', Shoes: 'Giày', Sandals: 'Dép', Slippers: 'Dép lê', Long: 'Dài', Folded: 'Gấp', Rimmed: 'Viền',
  Plated: 'Bọc thép', Gloves: 'Găng', Bracers: 'Bao tay', Cloth: 'Vải', Cape: 'Áo choàng', Torn: 'Rách', Trimmed: 'Viền', Quiver: 'Ống tên',
  Empty: 'Rỗng', Backpack: 'Ba lô', Basket: 'Gùi', Hood: 'Mũ trùm', Bandana: 'Khăn rằn', Wizard: 'Phù thủy', Tiara: 'Vương miện nhỏ',
  Helmet: 'Mũ giáp', Sword: 'Kiếm', Saber: 'Đao', Rapier: 'Kiếm mảnh', Glowsword: 'Kiếm phát sáng', Staff: 'Trượng', Wand: 'Đũa phép',
  Wooden: 'Gỗ', Metal: 'Kim loại', Bow: 'Cung', Great: 'Lớn', Recurve: 'Cung cánh cong', Crossbow: 'Nỏ', Dagger: 'Dao găm',
  Mace: 'Chùy', Flail: 'Chùy xích', War: 'Chiến', Axe: 'Rìu', Kite: 'Khiên diều', Crusader: 'Khiên thập tự', Spartan: 'Khiên Sparta',
  Mask: 'Mặt nạ', Scarf: 'Khăn quàng', Eyepatch: 'Bịt mắt', Glasses: 'Kính', Sun: 'Mát', Beard: 'Râu quai nón', Mustache: 'Ria mép',
  Horned: 'Có sừng', Belt: 'Thắt lưng', Sash: 'Đai vải', Narrow: 'Hẹp', Rope: 'Dây thừng', Double: 'Đôi', Raised: 'Cao',
};
function lookName(n) { return String(n).split(/(\s+|\(|\))/).map(w => LOOK_WORDS[w] || w).join(''); }

const Look = {
  cat: null, ok: false, texP: {}, layerC: new Map(), atlas: {}, building: {},
  async init() {
    if (this.cat) return this.cat;
    try { const r = await fetch('assets/look/catalog.json'); if (!r.ok) throw 0; this.cat = await r.json(); this.ok = true; }
    catch (e) { this.cat = null; this.ok = false; }
    return this.cat;
  },
  race(look) { return this.cat.races.find(r => r.id === look.race) || this.cat.races[0]; },
  cfg(look) { const r = this.race(look); return r.configs.find(c => c.id === look.cfg) || r.configs[0]; },
  item(slot, id) { const s = this.cat.items[slot]; return s ? s[id] : null; },
  typeFor(it, cfg) { return it.key === 'head' ? cfg.head : cfg.body; },
  has(slot, id, cfg) { if (id === 'none') return true; const it = this.item(slot, id); return !!(it && it.tx[this.typeFor(it, cfg)]); },
  // danh sách lựa chọn hợp lệ cho một ô
  options(slot, look, cls) {
    const cfg = this.cfg(look);
    let ids;
    if (CHAR_SLOTS_L.includes(slot)) ids = (cfg.slots[slot] || []).slice();
    else if (slot === 'mainhand') ids = (this.cat.weapons[CLASS_WEAPON[cls]] || []).slice();
    else if (slot === 'offhand') ids = (cls === 'knight' || cls === 'holy') ? this.cat.shields.slice() : ['none'];
    else ids = ['none'].concat(Object.keys(this.cat.items[slot] || {}).filter(i => i !== 'none').sort());
    return ids.filter(i => this.has(slot, i, cfg));
  },
  colors(slot, id, which = 'p') { const it = this.item(slot, id); return (it && it[which]) || []; },

  // ---------- texture + đổi màu ----------
  loadTex(h) {
    if (!this.texP[h]) this.texP[h] = (async () => {
      const url = 'assets/look/t/' + h + '.png';
      let src;
      try { const b = await (await fetch(url)).blob(); src = await createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); }
      catch (e) { src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; }); }
      const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(src, 0, 0);
      return cx.getImageData(0, 0, cv.width, cv.height);
    })().catch(e => { console.warn('Thiếu texture', h); return null; });
    return this.texP[h];
  },
  palette(it, choice) {
    const groups = [new Int16Array(768).fill(-1), new Int16Array(768).fill(-1), new Int16Array(768).fill(-1)];
    const add = (g, ids) => {
      for (const id of ids) {
        const m = this.cat.colormaps[id]; if (!m) continue;
        for (const k in m.m) { const i = +k * 3; if (groups[g][i] < 0) { groups[g][i] = m.m[k][0]; groups[g][i + 1] = m.m[k][1]; groups[g][i + 2] = m.m[k][2]; } }
      }
    };
    add(0, [choice.p || (it.p || [])[0]].filter(Boolean));
    add(1, [choice.s || ((it.s || []).includes(choice.p) ? choice.p : (it.s || [])[0])].filter(Boolean));
    add(2, it.f || []);
    return groups;
  },
  async layer(h, it, choice) {
    const key = h + '|' + (choice.p || '') + '|' + (choice.s || '');
    if (this.layerC.has(key)) return this.layerC.get(key);
    const p = (async () => {
      const src = await this.loadTex(h);
      if (!src) return null;
      const pal = this.palette(it, choice);
      const out = new ImageData(src.width, src.height);
      const s = src.data, d = out.data;
      for (let i = 0; i < s.length; i += 4) {
        if (s[i + 3] === 0) continue;
        const g = s[i] > 127 ? 2 : (s[i + 1] > 127 ? 1 : 0), k = s[i + 2] * 3;
        let P = pal[g];
        if (P[k] < 0) P = pal[0][k] >= 0 ? pal[0] : (pal[1][k] >= 0 ? pal[1] : (pal[2][k] >= 0 ? pal[2] : null));
        if (P) { d[i] = P[k]; d[i + 1] = P[k + 1]; d[i + 2] = P[k + 2]; } else { d[i] = d[i + 1] = d[i + 2] = s[i + 2]; }
        d[i + 3] = s[i + 3];
      }
      const cv = document.createElement('canvas'); cv.width = out.width; cv.height = out.height;
      cv.getContext('2d').putImageData(out, 0, 0);
      return cv;
    })();
    this.layerC.set(key, p);
    if (this.layerC.size > 400) this.layerC.delete(this.layerC.keys().next().value);
    return p;
  },
  choiceFor(look, slot) {
    const s = look.slots[slot] || { id: 'none' };
    if (SKIN_SLOTS.includes(slot)) return { p: look.skin };
    if (HAIR_SLOTS.includes(slot)) return { p: look.hairC, s: look.hairC2 };
    return s;
  },
  // ---------- ghép ----------
  async compose(look) {
    const cfg = this.cfg(look);
    const hidden = new Set();
    for (const sl in look.slots) { const it = this.item(sl, look.slots[sl].id); if (it && it.hide) it.hide.forEach(h => hidden.add(h)); }
    const jobs = [];
    for (const sl of LOOK_ORDER) {
      const id = (look.slots[sl] || {}).id;
      if (!id || id === 'none' || hidden.has(sl)) continue;
      const it = this.item(sl, id); if (!it) continue;
      const t = it.tx[this.typeFor(it, cfg)]; if (!t) continue;
      const ch = this.choiceFor(look, sl);
      const rec = { slot: sl };
      for (const sheet of ['base', 'slash', 'thrust']) if (t[sheet]) rec[sheet] = Promise.all(t[sheet].map(h => h ? this.layer(h, it, ch) : null));
      jobs.push(rec);
    }
    for (const j of jobs) for (const k of ['base', 'slash', 'thrust']) if (j[k]) j[k] = await j[k];
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
    const [full, fx] = mk(832, 1344), [now, nx] = mk(832, 1344);
    for (const pass of [0, 1]) for (const j of jobs) {
      const l = j.base && j.base[pass]; if (!l) continue;
      fx.drawImage(l, 0, 0);
      if (j.slot !== 'mainhand') nx.drawImage(l, 0, 0);
    }
    const weapon = jobs.find(j => j.slot === 'mainhand');
    return { full, noWeapon: now, weapon };
  },
  // ---------- atlas theo bố cục HERO_ANIM của game ----------
  async buildAtlas(look) {
    const C = await this.compose(look);
    // texture theo bố cục LPC chuẩn: phép 0-3 (7), đâm 4-7 (8), đi 8-11 (9), chém 12-15 (6), bắn 16-19 (13), bị đánh 20 (6)
    const D = [0, 1, 2, 3];
    const at = document.createElement('canvas'); at.width = 832; at.height = 64 * 25;
    const ax = at.getContext('2d'); ax.imageSmoothingEnabled = false;
    const put = (sc, sr, col, row) => ax.drawImage(C.full, sc * 64, sr * 64, 64, 64, col * 64, row * 64, 64, 64);
    D.forEach(d => {
      for (let i = 0; i < 9; i++) put(i, 8 + d, i, d);          // đi
      for (let i = 0; i < 6; i++) put(i, 12 + d, i, 4 + d);     // chém
      for (let i = 0; i < 7; i++) put(i, 0 + d, i, 8 + d);      // phép
      for (let i = 0; i < 13; i++) put(i, 16 + d, i, 12 + d);   // bắn
      for (let i = 0; i < 8; i++) put(i, 4 + d, i, 16 + d);     // đâm
      put(0, 8 + d, 0, 20 + d); put(0, 8 + d, 1, 20 + d);       // đứng
    });
    for (let i = 0; i < 6; i++) put(i, 20, i, 24);              // bị đánh
    // vũ khí lớn khi chém / đâm (khung 192px)
    let big = null; const bigHas = {};
    const W = C.weapon;
    if (W && (W.slash || W.thrust)) {
      big = document.createElement('canvas'); big.width = 192 * 8; big.height = 192 * 8;
      const bx = big.getContext('2d'); bx.imageSmoothingEnabled = false;
      const doAnim = (name, rowBase, n, srcRow) => {
        const L = W[name]; if (!L) return; bigHas[name] = true;
        D.forEach(d => {
          for (let i = 0; i < n; i++) {
            const dx = i * 192, dy = (rowBase + d) * 192;
            if (L[0]) bx.drawImage(L[0], i * 192, d * 192, 192, 192, dx, dy, 192, 192);
            bx.drawImage(C.noWeapon, i * 64, (srcRow + d) * 64, 64, 64, dx + 64, dy + 64, 64, 64);
            if (L[1]) bx.drawImage(L[1], i * 192, d * 192, 192, 192, dx, dy, 192, 192);
          }
        });
      };
      doAnim('slash', 0, 6, 12);
      doAnim('thrust', 4, 8, 4);
    }
    return { img: at, big, bigHas };
  },
  async ensure(ch) {
    if (!ch || !ch.look || !this.ok) return null;
    const sig = JSON.stringify(ch.look);
    const cur = this.atlas[ch.id];
    if (cur && cur.sig === sig) return cur;
    if (this.building[ch.id] && this.building[ch.id].sig === sig) return this.building[ch.id].p;
    const p = this.buildAtlas(ch.look).then(a => { a.sig = sig; this.atlas[ch.id] = a; delete this.building[ch.id]; return a; })
      .catch(e => { console.warn('Lỗi ghép nhân vật', e); delete this.building[ch.id]; return null; });
    this.building[ch.id] = { sig, p };
    return p;
  },
  // ---------- mặc định & ngẫu nhiên ----------
  firstColor(slot, id, wants) {
    const list = this.colors(slot, id, 'p');
    for (const w of wants || []) if (list.includes(w)) return w;
    return list[0];
  },
  defaultLook(cls, gender = 'male') {
    const race = this.cat.races.find(r => r.id === 'human');
    const cfg = race.configs.find(c => c.gender === gender) || race.configs[0];
    const F = gender === 'female';
    const P = {
      knight:   { shirt: ['plate1', 'metal_steel'], pants: ['plate', 'metal_steel'], shoes: ['plate', 'metal_steel'], gloves: ['gloves2', 'metal_steel'], hat: ['helmet54', 'metal_steel'], back: ['cape2a', 'cloth_red2'], belt: ['none'], mainhand: ['sword1'], offhand: ['kite1'] },
      holy:     { shirt: ['plate2', 'metal_gold'], pants: ['plate', 'metal_brushed'], shoes: ['boots3', 'metal_gold'], gloves: ['bracers2', 'metal_gold'], jacket: ['tabard', 'cloth_white1'], back: ['cape3a', 'cloth_blue2'], hat: ['none'], mainhand: ['swordglow'], offhand: ['crusader'] },
      mage:     { shirt: [F ? 'robes' : 'shirt4', 'cloth_purple1'], jacket: [F ? 'skirt2' : 'frock1', 'cloth_purple2'], pants: ['pants', 'cloth_purple2'], shoes: ['sandals3', 'cloth_brown2'], hat: ['wizard2', 'cloth_purple1'], belt: ['belt2', 'cloth_yellow1'], mainhand: ['staff2'], offhand: ['none'] },
      archer:   { shirt: ['leather1', 'cloth_green2'], pants: ['pants', 'cloth_brown2'], shoes: ['boots1', 'cloth_brown3'], hat: ['hood', 'cloth_green1'], back: ['quiver2'], belt: ['belt5'], gloves: ['bracers1', 'cloth_brown2'], mainhand: ['bow2'], offhand: ['none'] },
      assassin: { shirt: ['leather2', 'cloth_black1'], pants: ['pants', 'cloth_black1'], shoes: ['boots4', 'cloth_black1'], hat: ['hood', 'cloth_black1'], glasses: ['mask', 'cloth_red2'], belt: ['belt2', 'cloth_red2'], back: ['cape1a', 'cloth_red3'], mainhand: ['dagger1'], offhand: ['none'] },
    }[cls] || {};
    const look = { race: race.id, cfg: cfg.id, skin: 'human_skin_light', hairC: F ? 'human_hair_brown2' : 'human_hair_black', hairC2: null, slots: {} };
    look.slots.body = { id: 'human' }; look.slots.head = { id: 'human' }; look.slots.ears = { id: 'base' }; look.slots.nose = { id: F ? 'button' : 'straight' };
    look.slots.eyes = { id: 'human', p: 'human_eyes_blue' };
    look.slots.hair = { id: F ? 'long2' : 'messy1' };
    for (const sl of GEAR_SLOTS_L) {
      const [id, col] = P[sl] || ['none'];
      look.slots[sl] = { id: this.has(sl, id, cfg) ? id : 'none' };
      if (look.slots[sl].id !== 'none') look.slots[sl].p = this.firstColor(sl, look.slots[sl].id, [col]);
    }
    return this.validate(look, cls);
  },
  validate(look, cls) {
    const cfg = this.cfg(look);
    look.cfg = cfg.id;
    for (const sl of CHAR_SLOTS_L.concat(GEAR_SLOTS_L)) {
      const opts = this.options(sl, look, cls);
      const cur = look.slots[sl] || (look.slots[sl] = { id: 'none' });
      if (!opts.includes(cur.id)) {
        const req = ['body', 'head', 'eyes'].includes(sl) || (sl === 'mainhand');
        look.slots[sl] = { id: req ? (opts[0] || 'none') : (opts.includes('none') ? 'none' : (opts[0] || 'none')) };
      }
    }
    const skins = this.colors('body', look.slots.body.id);
    if (skins.length && !skins.includes(look.skin)) look.skin = skins[0];
    const hairs = this.colors('hair', look.slots.hair.id);
    if (look.slots.hair.id !== 'none' && hairs.length && !hairs.includes(look.hairC)) look.hairC = hairs[0];
    const eyes = this.colors('eyes', look.slots.eyes.id);
    if (eyes.length && !eyes.includes(look.slots.eyes.p)) look.slots.eyes.p = eyes[0];
    return look;
  },
  randomize(look, cls) {
    const rp = a => a[Math.floor(Math.random() * a.length)];
    const race = rp(this.cat.races); look.race = race.id; look.cfg = rp(race.configs).id;
    look.slots = {}; this.validate(look, cls);
    const cfg = this.cfg(look);
    for (const sl of CHAR_SLOTS_L) { const o = this.options(sl, look, cls); if (o.length) look.slots[sl] = { id: rp(o) }; }
    for (const sl of ['shirt', 'pants', 'shoes', 'belt', 'back', 'hat', 'jacket']) {
      const o = this.options(sl, look, cls).filter(i => i !== 'none' || Math.random() < 0.3);
      if (o.length) look.slots[sl] = { id: rp(o) };
    }
    for (const sl in look.slots) { const c = this.colors(sl, look.slots[sl].id); if (c.length && !SKIN_SLOTS.includes(sl) && !HAIR_SLOTS.includes(sl)) look.slots[sl].p = rp(c); }
    look.skin = rp(this.colors('body', look.slots.body.id).concat([look.skin]));
    const hc = this.colors('hair', look.slots.hair.id); if (hc.length) look.hairC = rp(hc);
    return this.validate(look, cls);
  },
};

// nguồn sprite của một nhân vật (atlas tùy chỉnh hoặc sprite class mặc định)
function heroSrc(ch) {
  const a = ch && Look.atlas[ch.id];
  if (a && ch.look && a.sig === JSON.stringify(ch.look)) return a;
  return { img: IMG['hero_' + (ch ? ch.cls : 'knight')], big: null, bigHas: {} };
}
