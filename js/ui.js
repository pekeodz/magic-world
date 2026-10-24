// ============================================================
//  MAGIC WORLD — giao diện (DOM)
// ============================================================
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SKILL_GLYPH = {
  whirl: '↻', shield: '⛨', charge: '➤', quake: '✷', heart: '♥', armor: '⛊', fire: '✹', ice: '❄', bolt: 'ϟ', meteor: '☄',
  book: '✎', mana: '◈', multi: '⋔', pierce: '➶', wind: '≋', rain: '⇣', eye: '◉', boot: '»', holy: '✠', heal: '✚', pillar: '⇓',
  wing: '✧', sun: '☼', shadow: '◐', dagger: '†', mask: '◑', skull: '☠', blood: '♦',
};
function fmtStat(k, v) {
  if (PCT_STATS.has(k)) return `+${Math.round(v * 10) / 10}%`;
  if (k === 'hpRegen' || k === 'mpRegen') return `+${(Math.round(v * 10) / 10).toFixed(1)}`;
  return `+${Math.round(v)}`;
}
function skillIconHTML(sk, cls, size = 52) {
  const d = SKILLS[sk], col = CLASSES[cls].color;
  return `<div class="ic sk-glyph" style="width:${size}px;height:${size}px;font-size:${size * 0.55}px;background:radial-gradient(circle at 40% 30%, ${col}55, #120e17 75%);color:${col}">${SKILL_GLYPH[d.icon] || '✦'}</div>`;
}

const UI = {
  panel: null, panelCtx: null, sel: null, tab: 'buy', logs: [], frameT: 0, createSel: 'knight',
  heroCanvases: [],

  init() {
    $('btn-new').onclick = () => { sfx('ui'); this.openCreate(); };
    $('btn-help').onclick = () => { sfx('ui'); this.openPanel('help'); };
    $('btn-back').onclick = () => { this.showScreen('title'); this.renderTitle(); };
    $('btn-create').onclick = () => this.doCreate();
    $('cname').addEventListener('keydown', e => { if (e.key === 'Enter') this.doCreate(); });
    $('look-ok').onclick = () => this.lookConfirm();
    $('look-back').onclick = () => this.lookCancel();
    $('look-rand').onclick = () => { Look.randomize(this.L.look, this.L.cls); this.renderLook(); this.lookPreview(); };
    $('look-def').onclick = () => { const g = Look.cfg(this.L.look).gender; this.L.look = Look.defaultLook(this.L.cls, g); this.renderLook(); this.lookPreview(); };
    $('look-rl').onclick = () => { this.L.dir = (this.L.dir + 3) % 4; };
    $('look-rr').onclick = () => { this.L.dir = (this.L.dir + 1) % 4; };
    document.querySelectorAll('[data-lanim]').forEach(b => b.onclick = () => { this.L.anim = b.dataset.lanim; document.querySelectorAll('[data-lanim]').forEach(x => x.classList.toggle('on', x === b)); });
    const mb = $('btn-music');
    const mlabel = () => { mb.textContent = '♪ Nhạc: ' + (Settings.music > 0 && !G.muted ? 'Bật' : 'Tắt'); };
    mb.onclick = () => { if (Settings.music > 0 && !G.muted) { Settings.music = 0; } else { Settings.music = Settings.music || 0.45; G.muted = false; } saveSettings(); Music.start(); Music.apply(); mlabel(); };
    mlabel();
    $('btn-respawn').onclick = () => { $('death').classList.add('hidden'); respawn(); };
    $('mb-inv').onclick = () => this.togglePanel('inv');
    $('mb-skills').onclick = () => this.togglePanel('skills');
    $('mb-char').onclick = () => this.togglePanel('char');
    $('mb-portal').onclick = () => startPortal();
    $('mb-menu').onclick = () => this.togglePanel('menu');
    $('prompt').onclick = () => interact();
    $('overlay').addEventListener('pointerdown', e => { if (e.target.id === 'overlay') this.closePanel(); });
    $('ic-gold').src = 'assets/i_gold.png';
    $('ic-stone').src = iconURL('stone', '#9fe6ff', 2);
    this.initTouch();
  },
  showScreen(name) {
    for (const s of ['loading', 'title', 'create', 'look']) $('screen-' + s).classList.toggle('hidden', s !== name);
  },

  // ---------- Màn hình tiêu đề ----------
  renderTitle() {
    const list = $('charlist');
    const chars = Save.data.chars;
    if (!chars.length) { list.innerHTML = '<div class="empty">Chưa có nhân vật nào. Tạo nhân vật đầu tiên để vào thế giới Magic World.</div>'; }
    else {
      list.innerHTML = chars.map((c, i) => `
        <div class="charrow" data-i="${i}" tabindex="0">
          <canvas width="64" height="64" data-cls="${c.cls}"></canvas>
          <div><div class="nm">${esc(c.name)}</div><div class="sub">${CLASSES[c.cls].name} · Cấp ${c.lvl} · Tầng cao nhất ${c.maxFloor}</div></div>
          <div style="display:flex;gap:6px"><button class="btn gold small" data-play="${i}">Chơi</button><button class="btn danger small" data-del="${i}">Xóa</button></div>
        </div>`).join('');
      list.querySelectorAll('canvas').forEach((cv, i) => drawHeroThumb(cv, chars[i], 0));
      list.querySelectorAll('[data-play]').forEach(b => b.onclick = e => { e.stopPropagation(); this.play(+b.dataset.play); });
      list.querySelectorAll('.charrow').forEach(r => r.ondblclick = () => this.play(+r.dataset.i));
      list.querySelectorAll('[data-del]').forEach(b => b.onclick = e => {
        e.stopPropagation();
        if (b.dataset.confirm) { Save.data.chars.splice(+b.dataset.del, 1); Save.store(); this.renderTitle(); }
        else { b.dataset.confirm = '1'; b.textContent = 'Chắc chắn?'; setTimeout(() => { if (b.isConnected) { b.textContent = 'Xóa'; delete b.dataset.confirm; } }, 2500); }
      });
    }
    $('btn-new').disabled = chars.length >= 6;
  },
  play(i) {
    const ch = Save.data.chars[i];
    if (!ch) return;
    migrateChar(ch);
    sfx('door');
    this.showScreen(null);
    startGame(ch);
  },

  // ---------- Tạo nhân vật ----------
  openCreate() {
    this.showScreen('create');
    const grid = $('classgrid');
    grid.innerHTML = CLASS_ORDER.map(k => {
      const c = CLASSES[k];
      const locked = c.hidden && !Save.data.unlocks.assassin;
      return `<div class="ccard ${locked ? 'locked' : ''}" data-k="${k}" tabindex="0">
        ${c.hidden ? `<span class="tag">${locked ? 'KHÓA' : 'ẨN'}</span>` : ''}
        <canvas width="64" height="64" data-cls="${k}"></canvas>
        <div class="cn">${locked ? '???' : c.name}</div><div class="cr">${locked ? 'Class ẩn' : c.role}</div></div>`;
    }).join('');
    this.heroCanvases = [...grid.querySelectorAll('canvas')];
    grid.querySelectorAll('.ccard').forEach(el => {
      el.onclick = () => { this.createSel = el.dataset.k; sfx('ui'); this.renderCreateDetail(); };
      el.onkeydown = e => { if (e.key === 'Enter') el.click(); };
    });
    if (CLASSES[this.createSel].hidden && !Save.data.unlocks.assassin) this.createSel = 'knight';
    this.renderCreateDetail();
    setTimeout(() => $('cname').focus(), 50);
  },
  renderCreateDetail() {
    const k = this.createSel, c = CLASSES[k];
    const locked = c.hidden && !Save.data.unlocks.assassin;
    document.querySelectorAll('.ccard').forEach(el => el.classList.toggle('sel', el.dataset.k === k));
    const mx = { hp: 150, mp: 130, atk: 14, def: 9, crit: 22, aspd: 1 / 0.38, move: 108 };
    const bars = [['HP', c.base.hp / mx.hp], ['MP', c.base.mp / mx.mp], ['Tấn công', c.base.atk / mx.atk], ['Phòng thủ', c.base.def / mx.def], ['Chí mạng', c.base.crit / mx.crit], ['Tốc đánh', (1 / c.base.aspd) / mx.aspd], ['Tốc chạy', c.base.move / mx.move]];
    $('cdetail').innerHTML = locked ? `<div><h3 style="color:#ff8aa0">Class Ẩn</h3><p>${c.unlockHint}</p></div><div><p>Một bóng hình ẩn trong bóng tối của hầm ngục. Chỉ những ai đã chiến thắng Quỷ Vương Hỏa Ngục mới có thể triệu hồi class này.</p></div>` : `
      <div><h3 style="color:${c.color}">${c.name}</h3><p>${c.desc}</p>
        <div class="skillpreview">${c.skills.map(s => `<span class="chip">${SKILLS[s].passive ? '◇ ' : '◆ '}${SKILLS[s].name}</span>`).join('')}</div>
        <p style="margin-top:10px">Thuộc tính chính: <b style="color:var(--gold)">${ATTR_INFO[c.main].name}</b> · Vũ khí: <b>${WEAPON_TYPES[CLASS_WEAPON[k]].name}</b></p></div>
      <div>${bars.map(([n, v]) => `<div class="sbar"><span>${n}</span><b><i style="width:${Math.round(clamp(v, 0.05, 1) * 100)}%;background:${c.color}"></i></b></div>`).join('')}</div>`;
    $('btn-create').disabled = locked;
  },
  doCreate() {
    const k = this.createSel, c = CLASSES[k];
    if (c.hidden && !Save.data.unlocks.assassin) return;
    let name = $('cname').value.trim();
    if (!name) { $('cname').focus(); this.toast('Hãy đặt tên cho nhân vật'); return; }
    if (Save.data.chars.length >= 6) { this.toast('Đã đủ 6 nhân vật'); return; }
    if (Look.ok) { this.openLook({ mode: 'new', cls: k, name: name.slice(0, 16) }); return; }
    const ch = newChar(name.slice(0, 16), k);
    Save.data.chars.push(ch); Save.store();
    $('cname').value = '';
    this.play(Save.data.chars.length - 1);
  },

  // ---------- Ngoại hình ----------
  openLook(st) {
    const cls = st.ch ? st.ch.cls : st.cls;
    const look = st.ch && st.ch.look ? JSON.parse(JSON.stringify(st.ch.look)) : Look.defaultLook(cls, st.gender || 'male');
    this.L = Object.assign({ dir: DIR.DOWN, anim: 'walk', tab: 'body', atlas: null, tok: 0 }, st, { cls, look });
    if (st.mode === 'edit') { this.showHUD(false); $('touch').classList.add('hidden'); G.paused = true; }
    this.showScreen('look');
    $('look-ok').textContent = st.mode === 'new' ? 'Bắt đầu hành trình' : 'Lưu ngoại hình';
    $('look-title').textContent = st.mode === 'new' ? `Ngoại hình · ${st.name}` : 'Đổi ngoại hình';
    this.renderLook();
    this.lookPreview();
  },
  lookTabs: { body: ['Cơ thể', ['race', 'cfg', 'skin', 'eyes', 'ears', 'nose', 'horns', 'tail', 'wings']], hair: ['Tóc', ['hair', 'hairadd', 'facial']],
    outfit: ['Trang phục', ['shirt', 'jacket', 'pants', 'shoes', 'belt', 'gloves', 'back', 'hat', 'glasses', 'mask']], weapon: ['Vũ khí', ['mainhand', 'offhand']] },
  renderLook() {
    const L = this.L, look = L.look;
    $('looktabs').innerHTML = Object.entries(this.lookTabs).map(([k, v]) => `<button class="btn small ${L.tab === k ? 'on' : ''}" data-ltab="${k}">${v[0]}</button>`).join('');
    const sw = (list, cur, attr) => list.length ? `<div class="swatches">${list.map(id => { const c = Look.cat.colormaps[id]; return c ? `<button class="sw ${cur === id ? 'on' : ''}" style="background:${c.c}" title="${esc(c.n)}" aria-label="${esc(c.n)}" ${attr}="${id}"></button>` : ''; }).join('')}</div>` : '';
    const rows = [];
    for (const key of this.lookTabs[L.tab][1]) {
      if (key === 'race') { rows.push(`<div class="lrow"><label for="l-race">Chủng tộc</label><select id="l-race">${Look.cat.races.map(r => `<option value="${r.id}" ${r.id === look.race ? 'selected' : ''}>${r.name}</option>`).join('')}</select></div>`); continue; }
      if (key === 'cfg') { rows.push(`<div class="lrow"><label for="l-cfg">Giới tính · Dáng</label><select id="l-cfg">${Look.race(look).configs.map(c => `<option value="${c.id}" ${c.id === look.cfg ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>`); continue; }
      if (key === 'skin') { rows.push(`<div class="lrow"><label>Màu da</label>${sw(Look.colors('body', look.slots.body.id), look.skin, 'data-skin')}</div>`); continue; }
      const opts = Look.options(key, look, L.cls);
      if (opts.length <= 1 && !['mainhand'].includes(key)) continue;
      const cur = (look.slots[key] || { id: 'none' }).id;
      let col = '';
      if (cur !== 'none') {
        if (key === 'hair') col = sw(Look.colors('hair', cur), look.hairC, 'data-hairc') + sw(Look.colors('hair', cur, 's'), look.hairC2 || Look.colors('hair', cur, 's')[0], 'data-hairc2');
        else if (!SKIN_SLOTS.includes(key) && !HAIR_SLOTS.includes(key)) {
          const s = look.slots[key];
          col = sw(Look.colors(key, cur), s.p || Look.colors(key, cur)[0], `data-c="${key}" data-cp`) + sw(Look.colors(key, cur, 's'), s.s || (Look.colors(key, cur, 's').includes(s.p) ? s.p : Look.colors(key, cur, 's')[0]), `data-c="${key}" data-cs`);
        }
      }
      rows.push(`<div class="lrow"><label for="l-${key}">${LOOK_SLOT_NAME[key]}</label>
        <div class="lsel"><button class="btn small" data-step="${key}" data-d="-1" aria-label="Trước">◀</button>
        <select id="l-${key}" data-slot="${key}">${opts.map(id => `<option value="${id}" ${id === cur ? 'selected' : ''}>${id === 'none' ? 'Không' : esc(lookName(Look.item(key, id).n))}</option>`).join('')}</select>
        <button class="btn small" data-step="${key}" data-d="1" aria-label="Sau">▶</button></div>${col}</div>`);
    }
    $('lookrows').innerHTML = rows.join('');
    const root = $('screen-look');
    root.querySelectorAll('[data-ltab]').forEach(b => b.onclick = () => { L.tab = b.dataset.ltab; this.renderLook(); });
    const changed = () => { Look.validate(look, L.cls); this.renderLook(); this.lookPreview(); };
    const rs = $('l-race'); if (rs) rs.onchange = () => { look.race = rs.value; look.cfg = Look.race(look).configs[0].id; changed(); };
    const cs = $('l-cfg'); if (cs) cs.onchange = () => { look.cfg = cs.value; changed(); };
    root.querySelectorAll('select[data-slot]').forEach(sel => sel.onchange = () => { look.slots[sel.dataset.slot] = { id: sel.value }; changed(); });
    root.querySelectorAll('[data-step]').forEach(b => b.onclick = () => {
      const k = b.dataset.step, opts = Look.options(k, look, L.cls), i = opts.indexOf((look.slots[k] || {}).id);
      look.slots[k] = { id: opts[(i + +b.dataset.d + opts.length) % opts.length] }; changed();
    });
    root.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => { look.skin = b.dataset.skin; changed(); });
    root.querySelectorAll('[data-hairc]').forEach(b => b.onclick = () => { look.hairC = b.dataset.hairc; changed(); });
    root.querySelectorAll('[data-hairc2]').forEach(b => b.onclick = () => { look.hairC2 = b.dataset.hairc2; changed(); });
    root.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => { look.slots[b.dataset.c].p = b.dataset.cp; changed(); });
    root.querySelectorAll('[data-cs]').forEach(b => b.onclick = () => { look.slots[b.dataset.c].s = b.dataset.cs; changed(); });
    root.querySelectorAll('[data-eyes]').forEach(b => b.onclick = () => { look.slots.eyes.p = b.dataset.eyes; changed(); });
  },
  lookPreview() {
    const L = this.L, tok = ++L.tok;
    $('lookstatus').textContent = 'Đang ghép...';
    clearTimeout(this._lp);
    this._lp = setTimeout(async () => {
      const a = await Look.buildAtlas(L.look).catch(e => { console.warn(e); return null; });
      if (tok !== L.tok) return;
      L.atlas = a; $('lookstatus').textContent = a ? '' : 'Không ghép được, thử lựa chọn khác';
    }, 60);
  },
  lookFrame() {
    if (!this.L || $('screen-look').classList.contains('hidden')) return;
    drawHeroPreview($('lookcv'), this.L.atlas, this.L.dir, this.L.anim, performance.now() / 1000);
  },
  lookConfirm() {
    const L = this.L;
    if (L.mode === 'new') {
      if (Save.data.chars.length >= 6) { this.toast('Đã đủ 6 nhân vật'); return; }
      const ch = newChar(L.name, L.cls);
      ch.look = L.look;
      Save.data.chars.push(ch); Save.store();
      $('cname').value = '';
      this.L = null;
      this.play(Save.data.chars.length - 1);
    } else {
      L.ch.look = L.look; Look.ensure(L.ch); saveGame();
      this.L = null; this.showScreen(null); this.showHUD(true); G.paused = false;
      this.toast('Đã lưu ngoại hình mới');
    }
  },
  lookCancel() {
    const L = this.L; this.L = null;
    if (L && L.mode === 'edit') { this.showScreen(null); this.showHUD(true); G.paused = false; }
    else this.showScreen('create');
  },

  // ---------- HUD ----------
  showHUD(on) {
    $('hud').classList.toggle('hidden', !on);
    $('touch').classList.toggle('hidden', !(on && G.touch));
    if (on) this.buildSkillbar();
  },
  buildSkillbar() {
    const bar = $('skillbar');
    bar.querySelectorAll('.slot,.sep').forEach(e => e.remove());
    const acts = activeSkills();
    acts.forEach((sk, i) => {
      const b = document.createElement('button');
      b.className = 'slot skillslot'; b.dataset.sk = sk;
      b.innerHTML = `<span class="sk-glyph" style="color:${CLASSES[P.ch.cls].color}">${SKILL_GLYPH[SKILLS[sk].icon]}</span><span class="key">${i + 1}</span><div class="cd" style="height:0"></div><div class="cdt"></div>`;
      b.title = SKILLS[sk].name;
      b.onclick = () => useSkill(i);
      b.onmouseenter = () => this.showTip(b, this.skillTip(sk));
      b.onmouseleave = () => this.hideTip();
      bar.appendChild(b);
    });
    const sep = document.createElement('div'); sep.className = 'sep'; bar.appendChild(sep);
    for (const k of ['hp', 'mp']) {
      const b = document.createElement('button');
      b.className = 'slot potslot'; b.dataset.pot = k;
      b.innerHTML = `<img src="${iconURL('hpot', k === 'hp' ? '#e0413c' : '#3c7ae0', 3)}" alt=""><span class="key">${k === 'hp' ? 'Q' : 'R'}</span><span class="cnt"></span>`;
      b.title = k === 'hp' ? 'Bình máu (Q)' : 'Bình mana (R)';
      b.onclick = () => usePotion(k);
      bar.appendChild(b);
    }
    this.buildTouchButtons();
    this.refreshSkillbar();
  },
  skillTip(sk) {
    const d = SKILLS[sk], L = P.ch.skills[sk] || 0;
    return `<div class="icard"><div class="iname">${d.name} <span class="pips">${pips(L)}</span></div><div class="itype">${d.passive ? 'Bị động' : `MP ${d.mp} · Hồi ${d.cd}s`}</div><div class="sd">${d.desc(Math.max(1, L))}</div>${L === 0 ? `<div class="down" style="font-size:20px">Chưa học · cần cấp ${d.req}</div>` : ''}</div>`;
  },
  refreshSkillbar() {
    if (!P) return;
    document.querySelectorAll('#skillbar .potslot').forEach(b => { b.querySelector('.cnt').textContent = P.ch.potions[b.dataset.pot]; });
  },
  refreshBuffs() {
    if (!P) return;
    $('buffs').innerHTML = P.buffs.map(b => `<div class="buff sk-glyph" data-id="${b.id}" title="${SKILLS[b.id] ? SKILLS[b.id].name : ''}" style="color:${CLASSES[P.ch.cls].color}">${SKILLS[b.id] ? SKILL_GLYPH[SKILLS[b.id].icon] : '✦'}<i></i></div>`).join('');
  },
  setLocation(name, floor) {
    $('locfloor').textContent = floor ? `Tầng ${floor}` : 'Thị trấn';
    $('locname').textContent = name;
    $('mb-portal').style.display = floor ? '' : 'none';
  },
  bossBar(m) {
    G.bossShown = m;
    $('bossbar').classList.toggle('hidden', !m);
    if (m) $('bossname').textContent = m.name;
  },
  setPrompt(p) {
    const el = $('prompt');
    const txt = p ? (G.touch ? p.text.replace('[E] ', '👆 ') : p.text) : '';
    if (!p) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    if (el.textContent !== txt) el.textContent = txt;
  },
  frame(dt) {
    if (!G.running || !P) return;
    this.frameT -= dt;
    // thời gian hồi chiêu (mỗi frame cho mượt)
    document.querySelectorAll('#skillbar .skillslot, #tbtns .tb[data-sk]').forEach(b => {
      const sk = b.dataset.sk, d = SKILLS[sk], L = P.ch.skills[sk] || 0;
      const cd = Math.max(0, P.skillCd[sk] || 0), max = d.cd * (1 - P.st.cdr / 100);
      const cdEl = b.querySelector('.cd'), t = b.querySelector('.cdt');
      if (cdEl) cdEl.style.height = (cd > 0 ? cd / max * 100 : 0) + '%';
      if (t) { t.textContent = cd > 0 ? (cd < 10 ? cd.toFixed(1) : Math.ceil(cd)) : ''; t.style.display = cd > 0 ? '' : 'none'; }
      b.classList.toggle('off', L === 0);
      b.classList.toggle('nomp', L > 0 && P.mp < d.mp);
    });
    if (this.frameT > 0) return;
    this.frameT = 0.08;
    const st = P.st, ch = P.ch;
    drawHudFrame();
    $('hudlv').textContent = 'Lv ' + ch.lvl;
    $('hudname').innerHTML = `${esc(ch.name)} <span style="color:${CLASSES[ch.cls].color};font-weight:500">· ${CLASSES[ch.cls].short}</span>`;
    const need = xpNeed(ch.lvl);
    $('xpfill').style.width = (ch.lvl >= MAX_LEVEL ? 100 : ch.xp / need * 100) + '%';
    $('w-gold').textContent = fmt(ch.gold);
    $('w-stone').textContent = fmt(ch.stones);
    $('dot-attr').classList.toggle('hidden', !ch.freeAttr); $('dot-attr').textContent = ch.freeAttr;
    $('dot-skill').classList.toggle('hidden', !ch.skillPts); $('dot-skill').textContent = ch.skillPts;
    document.querySelectorAll('#buffs .buff').forEach(el => { const b = P.buffs.find(x => x.id === el.dataset.id); if (b) el.querySelector('i').style.height = (b.t / b.max * 100) + '%'; });
    if (G.bossShown && !G.bossShown.dead) {
      const m = G.bossShown, r = Math.max(0, m.hp / m.maxHp) * 100;
      $('bosshp').style.width = r + '%'; $('bosslag').style.width = r + '%';
    }
    drawMinimap($('minimap'));
    // log mờ dần
    const now = performance.now();
    document.querySelectorAll('#log div').forEach(d => { if (now - d.dataset.t > 5000) d.style.opacity = 0; if (now - d.dataset.t > 6000) d.remove(); });
    // preview nhân vật trong túi đồ
    const pc = document.querySelector('.paper canvas');
    if (pc) drawHeroThumb(pc, ch, G.t, true);
  },
  log(html) {
    const el = document.createElement('div');
    el.innerHTML = html; el.dataset.t = performance.now();
    const L = $('log'); L.appendChild(el);
    while (L.children.length > 6) L.firstChild.remove();
  },
  toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 1800);
  },
  showBanner(a, b) {
    $('b1').textContent = a; $('b2').textContent = b || '';
    const el = $('banner'); el.classList.add('show');
    clearTimeout(this._bt); this._bt = setTimeout(() => el.classList.remove('show'), 2200);
  },
  bigNotice(a, b) {
    $('nt1').textContent = a; $('nt2').textContent = b;
    const n = $('notice'); n.classList.remove('hidden'); sfx('level');
    clearTimeout(this._nt); this._nt = setTimeout(() => n.classList.add('hidden'), 4500);
  },
  showDeath(lost) {
    $('deathtxt').innerHTML = `Mất <b class="num" style="color:var(--gold)">${fmt(lost)}</b> vàng. Trang bị và kinh nghiệm được giữ nguyên.`;
    setTimeout(() => $('death').classList.remove('hidden'), 700);
  },

  // ---------- Panels ----------
  anyPanelOpen() { return !!this.panel; },
  togglePanel(name) { if (this.panel === name) this.closePanel(); else this.openPanel(name); },
  escape() { if (this.panel) this.closePanel(); else this.openPanel('menu'); },
  openPanel(name, ctx) {
    if (!G.running && name !== 'help') return;
    this.panel = name; this.panelCtx = ctx || null; this.sel = null;
    if (name === 'shop') this.tab = 'buy';
    if (G.running && G.world && !G.world.town) G.paused = true;
    $('overlay').classList.remove('hidden');
    this.renderPanel();
    sfx('ui');
  },
  closePanel() {
    this.panel = null; this.hideTip();
    $('overlay').classList.add('hidden'); $('overlay').innerHTML = '';
    G.paused = false;
    if (G.running) saveGame();
  },
  refreshAll() { if (this.panel) this.renderPanel(); this.refreshSkillbar(); },
  refreshInv() { if (this.panel === 'inv' || this.panel === 'shop' || this.panel === 'forge') this.renderPanel(); },
  renderPanel() {
    const titles = { inv: 'Túi Đồ', skills: 'Kỹ Năng', char: 'Nhân Vật', shop: 'Thương Nhân Lyra', forge: 'Lò Rèn Borin', gate: 'Cổng Hầm Ngục', menu: 'Tạm Dừng', help: 'Hướng Dẫn' };
    const n = this.panel;
    const body = this['p_' + n] ? this['p_' + n]() : '';
    const wide = ['inv', 'shop', 'forge', 'char'].includes(n);
    $('overlay').innerHTML = `<div class="panel" style="${wide ? '' : 'width:min(680px,100%)'}">
      <div class="phead"><h2>${titles[n]}</h2>${this.panelHeadExtra(n)}<button class="btn x" id="pclose" aria-label="Đóng">✕</button></div>
      <div class="pbody" id="pbody">${body}</div></div>`;
    $('pclose').onclick = () => this.closePanel();
    if (this['b_' + n]) this['b_' + n]();
  },
  panelHeadExtra(n) {
    if (n === 'shop') return `<div class="tabs"><button class="btn small ${this.tab === 'buy' ? 'on' : ''}" data-tab="buy">Mua</button><button class="btn small ${this.tab === 'sell' ? 'on' : ''}" data-tab="sell">Bán</button></div>`;
    if (n === 'skills') return `<span class="num" style="color:var(--gold);font-size:20px">Điểm: ${P.ch.skillPts}</span>`;
    if (n === 'char') return `<span class="num" style="color:var(--gold);font-size:20px">Điểm: ${P.ch.freeAttr}</span>`;
    return '';
  },

  // ----- Túi đồ -----
  itemSlotHTML(it, attrs, extraCls = '') {
    if (!it) return `<button class="slot ${extraCls}" ${attrs}></button>`;
    const bad = !canEquip(P.ch, it) ? 'bad' : '';
    return `<button class="slot r${it.rarity} ${bad} ${extraCls}" ${attrs}><img src="${iconURL(itemIcon(it), RARITY[it.rarity].color, 3)}" alt="">${it.plus ? `<span class="plus">+${it.plus}</span>` : ''}</button>`;
  },
  p_inv() {
    const ch = P.ch;
    const EIC = { helm: 'helm', armor: 'armor', amulet: 'amulet', weapon: 'weapon', boots: 'boots', ring: 'ring', gloves: 'shield' };
    const eq = s => this.itemSlotHTML(ch.equip[s], `data-eq="${s}" title="${SLOT_NAME[s]}"`, this.sel && this.sel.eq === s ? 'sel' : '').replace('</button>', ch.equip[s] ? '</button>' : `<img class="lblic" src="assets/ui/ic_${EIC[s]}.png" alt="${SLOT_NAME[s]}"></button>`);
    const bag = [];
    for (let i = 0; i < BAG_SIZE; i++) bag.push(this.itemSlotHTML(ch.bag[i], `data-bag="${i}"`, this.sel && this.sel.bag === i ? 'sel' : ''));
    return `<div class="invgrid">
      <div>
        <div class="paper">
          ${eq('helm')}<div></div>${eq('amulet')}
          ${eq('weapon')}<div class="heroc"><canvas width="64" height="64"></canvas></div>${eq('armor')}
          ${eq('gloves')}${eq('ring')}
          <div></div>${eq('boots')}<div></div>
        </div>
        <div class="sec-title">Chỉ số chính</div>
        ${this.miniStats()}
      </div>
      <div>
        <div class="bagmeta"><span>Túi: <b class="num">${ch.bag.length}/${BAG_SIZE}</b></span><span>Bình máu <b class="num">${ch.potions.hp}</b> · Bình mana <b class="num">${ch.potions.mp}</b> · Đá cường hóa <b class="num">${ch.stones}</b></span></div>
        <div class="bag">${bag.join('')}</div>
        <div id="selcard" style="margin-top:12px">${this.selCardInv()}</div>
      </div></div>`;
  },
  miniStats() {
    const st = P.st;
    const rows = [['Tấn công', Math.round(st.atk)], ['Phòng thủ', Math.round(st.def)], ['HP', st.maxHp], ['MP', st.maxMp], ['Chí mạng', st.crit.toFixed(1) + '%'], ['ST chí mạng', Math.round(st.critDmg) + '%'], ['Tốc đánh', (1 / st.aspd).toFixed(2) + '/s'], ['Tốc chạy', Math.round(st.move)]];
    return `<div class="statlist">${rows.map(r => `<span>${r[0]}</span><span>${r[1]}</span>`).join('')}</div>`;
  },
  selItem() {
    if (!this.sel) return null;
    if (this.sel.eq) return P.ch.equip[this.sel.eq];
    if (this.sel.bag != null) return P.ch.bag[this.sel.bag];
    if (this.sel.shop != null) return G.shopStock[this.sel.shop];
    return null;
  },
  selCardInv() {
    const it = this.selItem();
    if (!it) return `<div class="hint" style="text-align:left">Chọn một món đồ để xem chi tiết. Nhấp đúp để trang bị nhanh. Đồ có nền đỏ không dùng được cho class của bạn.</div>`;
    let actions = '';
    if (this.sel.eq) actions = `<button class="btn small" data-act="unequip">Tháo ra</button>`;
    else {
      actions = canEquip(P.ch, it) ? `<button class="btn gold small" data-act="equip">Trang bị</button>` : '';
      const sv = salvageValue(it);
      actions += `<button class="btn small" data-act="salvage">Phân giải (+${sv.stones} đá)</button><button class="btn danger small" data-act="drop">Vứt bỏ</button>`;
    }
    return itemCardHTML(it, this.sel.eq ? null : P.ch.equip[it.slot]) + `<div class="iactions">${actions}</div>`;
  },
  b_inv() {
    const root = $('pbody');
    root.querySelectorAll('[data-eq]').forEach(b => {
      b.onclick = () => { this.sel = P.ch.equip[b.dataset.eq] ? { eq: b.dataset.eq } : null; this.renderPanel(); };
      b.ondblclick = () => { this.unequip(b.dataset.eq); };
    });
    root.querySelectorAll('[data-bag]').forEach(b => {
      const i = +b.dataset.bag;
      b.onclick = () => { this.sel = P.ch.bag[i] ? { bag: i } : null; this.renderPanel(); };
      b.ondblclick = () => { if (P.ch.bag[i]) this.equip(i); };
      b.onmouseenter = () => { const it = P.ch.bag[i]; if (it && !G.touch) this.showTip(b, itemCardHTML(it, P.ch.equip[it.slot])); };
      b.onmouseleave = () => this.hideTip();
    });
    root.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'equip') this.equip(this.sel.bag);
      if (a === 'unequip') this.unequip(this.sel.eq);
      if (a === 'salvage') this.salvage(this.sel.bag);
      if (a === 'drop') { if (b.dataset.c) { P.ch.bag.splice(this.sel.bag, 1); this.sel = null; this.renderPanel(); } else { b.dataset.c = 1; b.textContent = 'Bấm lần nữa để vứt'; } }
    });
  },
  equip(i) {
    const ch = P.ch, it = ch.bag[i];
    if (!it || !canEquip(ch, it)) { this.toast('Class của bạn không dùng được vũ khí này'); return; }
    const old = ch.equip[it.slot];
    ch.equip[it.slot] = it;
    ch.bag.splice(i, 1);
    if (old) ch.bag.splice(i, 0, old);
    const r = P.hp / P.st.maxHp; recalc(false); P.hp = Math.min(P.st.maxHp, Math.max(P.hp, r * P.st.maxHp));
    this.sel = { eq: it.slot };
    sfx('pick'); this.renderPanel();
  },
  unequip(slot) {
    const ch = P.ch;
    if (!ch.equip[slot]) return;
    if (ch.bag.length >= BAG_SIZE) { this.toast('Túi đầy!'); return; }
    ch.bag.push(ch.equip[slot]); delete ch.equip[slot];
    recalc(false); this.sel = null; sfx('pick'); this.renderPanel();
  },
  salvage(i) {
    const ch = P.ch, it = ch.bag[i];
    if (!it) return;
    const v = salvageValue(it);
    ch.stones += v.stones; ch.gold += v.gold;
    ch.bag.splice(i, 1);
    this.sel = null;
    this.toast(`Phân giải: +${v.stones} đá cường hóa, +${v.gold} vàng`);
    sfx('coin'); this.renderPanel();
  },

  // ----- Kỹ năng -----
  p_skills() {
    const ch = P.ch, c = CLASSES[ch.cls];
    const acts = activeSkills();
    return `<div class="hint" style="text-align:left;margin-bottom:10px">Mỗi cấp nhận 1 điểm kỹ năng. Kỹ năng chủ động gắn vào phím <kbd>1</kbd>–<kbd>4</kbd>. Kỹ năng bị động cộng thẳng vào chỉ số. Tối đa cấp ${SKILL_MAX}.</div>
    <div class="sklist">${c.skills.map(sk => {
      const d = SKILLS[sk], L = ch.skills[sk] || 0;
      const can = ch.skillPts > 0 && ch.lvl >= d.req && L < SKILL_MAX;
      const key = d.passive ? 'Bị động' : `Phím ${acts.indexOf(sk) + 1} · MP ${d.mp} · Hồi ${d.cd}s`;
      return `<div class="skrow">${skillIconHTML(sk, ch.cls)}
        <div><div class="sn">${d.name}<span class="pips">${pips(L)}</span></div><div class="sm">${key} · Yêu cầu cấp ${d.req}</div>
        <div class="sd">${d.desc(Math.max(1, L))}</div>${L > 0 && L < SKILL_MAX ? `<div class="sn2">Cấp ${L + 1}: ${d.desc(L + 1)}</div>` : ''}</div>
        <button class="btn ${can ? 'gold' : ''} small" data-up="${sk}" ${can ? '' : 'disabled'}>${L === 0 ? 'Học' : (L >= SKILL_MAX ? 'Tối đa' : 'Nâng')}</button></div>`;
    }).join('')}</div>`;
  },
  b_skills() {
    $('pbody').querySelectorAll('[data-up]').forEach(b => b.onclick = () => {
      const sk = b.dataset.up, ch = P.ch;
      if (ch.skillPts <= 0) return;
      ch.skillPts--; ch.skills[sk] = (ch.skills[sk] || 0) + 1;
      recalc(false); sfx('level'); this.renderPanel(); saveGame();
    });
  },

  // ----- Nhân vật -----
  p_char() {
    const ch = P.ch, st = P.st, c = CLASSES[ch.cls];
    const attrs = ['str', 'int', 'agi', 'vit'];
    const rows = [
      ['Tấn công', Math.round(st.atk)], ['Phòng thủ', Math.round(st.def)], ['HP tối đa', st.maxHp], ['MP tối đa', st.maxMp],
      ['Chí mạng', st.crit.toFixed(1) + '%'], ['ST chí mạng', '+' + Math.round(st.critDmg) + '%'], ['Đòn/giây', (1 / st.aspd).toFixed(2)], ['Tốc chạy', Math.round(st.move)],
      ['% Sát thương', '+' + Math.round(st.dmgPct) + '%'], ['% ST kỹ năng (INT)', '+' + st.skillPct.toFixed(1) + '%'], ['Hồi HP/giây', st.hpRegen.toFixed(1)], ['Hồi MP/giây', st.mpRegen.toFixed(1)],
      ['Hút máu', st.lifesteal.toFixed(1) + '%'], ['Giảm hồi chiêu', st.cdr.toFixed(0) + '%'], ['Né tránh', st.dodge.toFixed(0) + '%'], ['Chặn đòn', st.block.toFixed(0) + '%'],
      ['Vàng rơi', '+' + Math.round(st.goldFind) + '%'], ['Tỉ lệ đồ hiếm', '+' + Math.round(st.magicFind) + '%'],
    ];
    const t = Math.floor(ch.playTime / 60);
    return `<div class="charcols"><div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px"><canvas id="charcv" width="64" height="64" style="width:96px;height:96px;image-rendering:pixelated"></canvas>
      <div><div style="font-size:30px">${esc(ch.name)}</div><div style="color:${c.color};font-weight:700">${c.name}</div><div class="hint" style="text-align:left">Cấp ${ch.lvl} · XP ${fmt(ch.xp)} / ${fmt(xpNeed(ch.lvl))}</div></div></div>
      <div class="sec-title">Thuộc tính (còn ${ch.freeAttr} điểm)</div>
      <div style="display:flex;flex-direction:column;gap:6px">${attrs.map(a => `<div class="attrrow"><div><div class="an">${ATTR_INFO[a].name}${c.main === a ? ' <span style="color:var(--gold);font-size:10px">· CHÍNH</span>' : ''}</div><div class="ad">${ATTR_INFO[a].desc}</div></div>
        <div class="av">${st.attrs[a]}</div><button class="btn small ${ch.freeAttr ? 'gold' : ''}" data-attr="${a}" ${ch.freeAttr ? '' : 'disabled'} aria-label="Cộng ${ATTR_INFO[a].name}">+</button></div>`).join('')}</div>
      ${ch.freeAttr >= 5 ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${attrs.map(a => `<button class="btn small" data-attr5="${a}">+5 ${ATTR_INFO[a].short}</button>`).join('')}</div>` : ''}
      </div><div>
      <div class="sec-title">Chỉ số chi tiết</div>
      <div class="statlist">${rows.map(r => `<span>${r[0]}</span><span>${r[1]}</span>`).join('')}</div>
      ${Look.ok ? '<div style="margin-top:12px"><button class="btn small" id="btn-look">Đổi ngoại hình (trong thị trấn)</button></div>' : ''}
      <div class="sec-title">Hành trình</div>
      <div class="statlist"><span>Tầng sâu nhất</span><span>${ch.maxFloor}</span><span>Quái đã hạ</span><span>${fmt(ch.kills)}</span><span>Boss đã hạ</span><span>${ch.bossKills}</span><span>Số lần gục</span><span>${ch.deaths}</span><span>Thời gian chơi</span><span>${Math.floor(t / 60)}g ${t % 60}p</span></div>
    </div></div>`;
  },
  b_char() {
    drawHeroThumb($('charcv'), P.ch, 0);
    const lb = $('btn-look'); if (lb) lb.onclick = () => { if (!G.world.town) { this.toast('Chỉ đổi ngoại hình được trong thị trấn'); return; } this.closePanel(); this.openLook({ mode: 'edit', ch: P.ch }); };
    const add = (a, n) => { n = Math.min(n, P.ch.freeAttr); if (n <= 0) return; P.ch.attrs[a] += n; P.ch.freeAttr -= n; const r = P.hp / P.st.maxHp; recalc(false); P.hp = r * P.st.maxHp; sfx('ui'); this.renderPanel(); };
    $('pbody').querySelectorAll('[data-attr]').forEach(b => b.onclick = () => add(b.dataset.attr, 1));
    $('pbody').querySelectorAll('[data-attr5]').forEach(b => b.onclick = () => add(b.dataset.attr5, 5));
  },

  // ----- Cửa hàng -----
  p_shop() {
    const ch = P.ch;
    let left = '';
    if (this.tab === 'buy') {
      const pot = k => `<div class="sitem" style="cursor:default"><img src="${iconURL('hpot', k === 'hp' ? '#e0413c' : '#3c7ae0', 3)}" alt="">
        <div><b>${k === 'hp' ? 'Bình Máu' : 'Bình Mana'}</b><div class="hint" style="text-align:left">${k === 'hp' ? 'Hồi 40% HP' : 'Hồi 50% MP'} · đang có ${ch.potions[k]}</div></div>
        <div style="display:flex;gap:4px;align-items:center"><span class="pr">${potionPrice(ch, k)}</span><button class="btn small" data-pot="${k}" data-n="1">x1</button><button class="btn small" data-pot="${k}" data-n="5">x5</button></div></div>`;
      left = `<div class="sec-title" style="margin-top:0">Dược phẩm</div><div class="slist">${pot('hp')}${pot('mp')}</div>
        <div class="sec-title">Trang bị (đổi hàng mỗi lần về thành)</div>
        <div class="slist">${G.shopStock.map((it, i) => it ? `<div class="sitem ${this.sel && this.sel.shop === i ? 'sel' : ''}" data-shop="${i}"><img src="${iconURL(itemIcon(it), RARITY[it.rarity].color, 3)}" alt="">
          <div><b style="color:${RARITY[it.rarity].color}">${it.name}</b><div class="hint" style="text-align:left">${RARITY[it.rarity].name} · ${it.slot === 'weapon' ? WEAPON_TYPES[it.wtype].name : SLOT_NAME[it.slot]} · cấp đồ ${it.ilvl}${canEquip(ch, it) ? '' : ' · <span class="down">khác class</span>'}</div></div>
          <span class="pr">${fmt(buyValue(it))}</span></div>` : '').join('')}</div>`;
    } else {
      left = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><button class="btn small" id="sellcommon">Bán hết đồ Thường & Tốt</button></div>
        <div class="slist">${ch.bag.map((it, i) => `<div class="sitem ${this.sel && this.sel.bag === i ? 'sel' : ''}" data-sell="${i}"><img src="${iconURL(itemIcon(it), RARITY[it.rarity].color, 3)}" alt="">
          <div><b style="color:${RARITY[it.rarity].color}">${itemDisplayName(it)}</b><div class="hint" style="text-align:left">${RARITY[it.rarity].name} · cấp đồ ${it.ilvl}</div></div><span class="pr">${fmt(sellValue(it))}</span></div>`).join('') || '<div class="empty">Túi trống</div>'}</div>`;
    }
    const it = this.selItem();
    let right = `<div class="hint" style="text-align:left">Vàng hiện có: <b class="num" style="color:var(--gold)">${fmt(ch.gold)}</b></div>`;
    if (it) {
      right += itemCardHTML(it, P.ch.equip[it.slot]);
      if (this.sel.shop != null) right += `<div class="iactions"><button class="btn gold" id="buyit" ${ch.gold >= buyValue(it) ? '' : 'disabled'}>Mua ${fmt(buyValue(it))} vàng</button></div>`;
      else right += `<div class="iactions"><button class="btn gold" id="sellit">Bán ${fmt(sellValue(it))} vàng</button></div>`;
    } else right += `<div class="helpbox" style="margin-top:8px">“${G.world.npcs ? G.world.npcs[0].line : ''}”</div>`;
    return `<div class="shopgrid"><div>${left}</div><div>${right}</div></div>`;
  },
  b_shop() {
    const ch = P.ch, root = $('overlay');
    root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { this.tab = b.dataset.tab; this.sel = null; this.renderPanel(); });
    root.querySelectorAll('[data-pot]').forEach(b => b.onclick = () => {
      const k = b.dataset.pot, n = +b.dataset.n, cost = potionPrice(ch, k) * n;
      if (ch.gold < cost) { this.toast('Không đủ vàng'); sfx('fail'); return; }
      ch.gold -= cost; ch.potions[k] += n; sfx('coin'); this.refreshSkillbar(); this.renderPanel();
    });
    root.querySelectorAll('[data-shop]').forEach(b => b.onclick = () => { this.sel = { shop: +b.dataset.shop }; this.renderPanel(); });
    root.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { this.sel = { bag: +b.dataset.sell }; this.renderPanel(); });
    const buy = $('buyit');
    if (buy) buy.onclick = () => {
      const it = this.selItem(); if (!it) return;
      if (ch.bag.length >= BAG_SIZE) { this.toast('Túi đầy!'); return; }
      const c = buyValue(it); if (ch.gold < c) return;
      ch.gold -= c; ch.bag.push(it); G.shopStock[this.sel.shop] = null; this.sel = null; sfx('coin'); this.renderPanel();
    };
    const sell = $('sellit');
    if (sell) sell.onclick = () => { const it = this.selItem(); if (!it) return; ch.gold += sellValue(it); ch.bag.splice(this.sel.bag, 1); this.sel = null; sfx('coin'); this.renderPanel(); };
    const sc = $('sellcommon');
    if (sc) sc.onclick = () => { let g = 0; ch.bag = ch.bag.filter(it => { if (it.rarity <= 1) { g += sellValue(it); return false; } return true; }); ch.gold += g; this.sel = null; this.toast(`Đã bán được ${fmt(g)} vàng`); sfx('coin'); this.renderPanel(); };
  },

  // ----- Lò rèn -----
  p_forge() {
    const ch = P.ch;
    const items = [];
    for (const s of SLOTS) if (ch.equip[s]) items.push({ it: ch.equip[s], eq: s });
    ch.bag.forEach((it, i) => items.push({ it, bag: i }));
    const isSel = o => this.sel && ((o.eq && this.sel.eq === o.eq) || (o.bag != null && this.sel.bag === o.bag));
    const left = `<div class="slist">${items.map(o => `<div class="sitem ${isSel(o) ? 'sel' : ''}" ${o.eq ? `data-feq="${o.eq}"` : `data-fbag="${o.bag}"`}><img src="${iconURL(itemIcon(o.it), RARITY[o.it.rarity].color, 3)}" alt="">
      <div><b style="color:${RARITY[o.it.rarity].color}">${itemDisplayName(o.it)}</b><div class="hint" style="text-align:left">${o.eq ? 'Đang mặc' : 'Trong túi'} · ${RARITY[o.it.rarity].name}</div></div><span class="pr">${o.it.plus}/${MAX_PLUS}</span></div>`).join('')}</div>`;
    const it = this.selItem();
    let right = `<div class="hint" style="text-align:left">Vàng <b class="num" style="color:var(--gold)">${fmt(ch.gold)}</b> · Đá cường hóa <b class="num" style="color:#9fe6ff">${ch.stones}</b></div>
      <div style="margin:8px 0"><button class="btn small" id="bulksalv">Phân giải hết đồ Thường & Tốt trong túi</button></div>`;
    if (it) {
      right += itemCardHTML(it, null);
      if (it.plus < MAX_PLUS) {
        const c = upgradeCost(it), rate = UPGRADE_RATE[it.plus];
        const ok = ch.gold >= c.gold && ch.stones >= c.stones;
        right += `<div class="icard" style="margin-top:8px"><div><b>Cường hóa lên +${it.plus + 1}</b></div>
          <div class="statlist"><span>Tỉ lệ thành công</span><span>${rate}%</span><span>Chi phí</span><span>${fmt(c.gold)} vàng</span><span>Đá cường hóa</span><span>${c.stones}</span></div>
          <div class="hint" style="text-align:left">Mỗi cấp +10% chỉ số gốc.${it.plus >= 6 ? ' <span class="down">Thất bại từ +7 trở lên sẽ tụt 1 cấp.</span>' : ' Thất bại chỉ mất nguyên liệu.'}</div>
          <button class="btn gold" id="doup" ${ok ? '' : 'disabled'}>Cường hóa</button></div>`;
      } else right += `<div class="hint">Đã cường hóa tối đa!</div>`;
      if (this.sel.bag != null) right += `<div class="iactions"><button class="btn small" id="dosalv">Phân giải (+${salvageValue(it).stones} đá)</button></div>`;
    } else right += `<div class="helpbox">Chọn trang bị bên trái. Đá cường hóa có từ quái tinh anh, boss, rương và phân giải đồ.</div>`;
    return `<div class="shopgrid"><div>${left || '<div class="empty">Không có trang bị</div>'}</div><div>${right}</div></div>`;
  },
  b_forge() {
    const ch = P.ch, root = $('pbody');
    root.querySelectorAll('[data-feq]').forEach(b => b.onclick = () => { this.sel = { eq: b.dataset.feq }; this.renderPanel(); });
    root.querySelectorAll('[data-fbag]').forEach(b => b.onclick = () => { this.sel = { bag: +b.dataset.fbag }; this.renderPanel(); });
    const up = $('doup');
    if (up) up.onclick = () => {
      const it = this.selItem(); if (!it) return;
      const c = upgradeCost(it);
      if (ch.gold < c.gold || ch.stones < c.stones) return;
      ch.gold -= c.gold; ch.stones -= c.stones;
      if (Math.random() * 100 < UPGRADE_RATE[it.plus]) { it.plus++; this.toast(`Thành công! ${it.name} +${it.plus}`); sfx('level'); }
      else { if (it.plus >= 7) it.plus--; this.toast('Thất bại...' + (it.plus >= 6 ? ' đồ bị tụt cấp' : '')); sfx('fail'); }
      recalc(false); this.renderPanel(); saveGame();
    };
    const sv = $('dosalv');
    if (sv) sv.onclick = () => this.salvage(this.sel.bag);
    const bs = $('bulksalv');
    if (bs) bs.onclick = () => {
      let s = 0, g = 0;
      ch.bag = ch.bag.filter(it => { if (it.rarity <= 1) { const v = salvageValue(it); s += v.stones; g += v.gold; return false; } return true; });
      ch.stones += s; ch.gold += g; this.sel = null;
      this.toast(`Phân giải xong: +${s} đá, +${g} vàng`); sfx('coin'); this.renderPanel();
    };
  },

  // ----- Cổng -----
  p_gate() {
    const ch = P.ch;
    const cps = [];
    for (let f = 1; f <= ch.maxFloor; f += 5) cps.push(f);
    return `<div class="hint" style="text-align:left;margin-bottom:12px">Cứ mỗi 5 tầng có một Boss canh giữ. Hạ Boss để mở điểm xuất phát mới. Trong hầm ngục, nhấn <kbd>T</kbd> để mở cổng về thành bất cứ lúc nào.</div>
      <div class="gatelist">${cps.map(f => { const b = biomeOf(f); return `<button class="btn gbtn" data-floor="${f}"><span class="gf">Tầng ${f}</span><span class="gb">${b.name}</span></button>`; }).join('')}</div>
      <div class="sec-title">Bản đồ hầm ngục</div>
      <div class="statlist">${BIOMES.map((b, i) => `<span>Tầng ${i * 5 + 1}–${i * 5 + 5} · ${b.name}</span><span>${BOSSES[BOSS_CYCLE[i % 4]].name}</span>`).join('')}<span>Tầng 26+ · Vực Vô Tận</span><span>Boss Ma Hóa</span></div>`;
  },
  b_gate() {
    $('pbody').querySelectorAll('[data-floor]').forEach(b => b.onclick = () => { const f = +b.dataset.floor; this.closePanel(); enterFloor(f); });
  },

  // ----- Menu -----
  p_menu() {
    return `<div style="display:flex;flex-direction:column;gap:10px;max-width:340px;margin:0 auto">
      <button class="btn gold" data-m="resume">Tiếp tục chơi</button>
      <button class="btn" data-m="help">Hướng dẫn</button>
      <div class="vol"><label for="vol-music">Nhạc nền</label><input type="range" id="vol-music" min="0" max="100" value="${Math.round(Settings.music * 100)}"><span class="num" id="vm-t">${Math.round(Settings.music * 100)}</span></div>
      <div class="vol"><label for="vol-sfx">Hiệu ứng</label><input type="range" id="vol-sfx" min="0" max="100" value="${Math.round(Settings.sfx * 100)}"><span class="num" id="vs-t">${Math.round(Settings.sfx * 100)}</span></div>
      <button class="btn" data-m="save">Lưu game</button>
      <button class="btn danger" data-m="quit">Lưu & về màn hình chính</button></div>`;
  },
  b_menu() {
    const vm = $('vol-music'), vs = $('vol-sfx');
    vm.oninput = () => { Settings.music = vm.value / 100; $('vm-t').textContent = vm.value; G.muted = false; Music.apply(); if (Settings.music > 0) Music.start(); saveSettings(); };
    vs.oninput = () => { Settings.sfx = vs.value / 100; $('vs-t').textContent = vs.value; G.muted = false; saveSettings(); };
    vs.onchange = () => sfx('coin');
    $('pbody').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
      const m = b.dataset.m;
      if (m === 'resume') this.closePanel();
      if (m === 'help') this.openPanel('help');
      if (m === 'sound') { G.muted = !G.muted; this.renderPanel(); }
      if (m === 'save') { saveGame(); this.toast('Đã lưu'); }
      if (m === 'quit') { saveGame(); Cloud.push(true); this.closePanel(); G.running = false; this.showHUD(false); $('touch').classList.add('hidden'); this.showScreen('title'); this.renderTitle(); }
    });
  },
  p_help() {
    return `<div class="helpbox" style="color:var(--text)">
      <div class="sec-title" style="margin-top:0">Điều khiển máy tính</div>
      <div><kbd>WASD</kbd>/<kbd>←↑↓→</kbd> di chuyển · <kbd>Chuột trái</kbd>, <kbd>J</kbd> hoặc <kbd>Space</kbd> giữ để đánh (tự nhắm quái gần nhất, hoặc nhắm theo chuột)</div>
      <div><kbd>1</kbd>–<kbd>4</kbd> kỹ năng · <kbd>Q</kbd> bình máu · <kbd>R</kbd> bình mana · <kbd>E</kbd> nói chuyện / xuống tầng · <kbd>T</kbd> về thành</div>
      <div><kbd>I</kbd> túi đồ · <kbd>K</kbd> kỹ năng · <kbd>C</kbd> nhân vật · <kbd>M</kbd> tắt tiếng · <kbd>Esc</kbd> menu</div>
      <div class="sec-title">Điện thoại</div>
      <div>Kéo nửa trái màn hình để di chuyển. Nút tròn lớn bên phải để đánh, 4 nút nhỏ là kỹ năng.</div>
      <div class="sec-title">Lối chơi</div>
      <div>• Vào hầm ngục qua Vệ Binh ở cổng lâu đài. Tìm <b>cánh cửa tím</b> trong mỗi tầng để xuống sâu hơn. Mỗi 5 tầng có Boss.</div>
      <div>• Lên cấp nhận <b>3 điểm thuộc tính</b> và <b>1 điểm kỹ năng</b>. Tự xây build: dồn thuộc tính chính để mạnh công, VIT để trâu.</div>
      <div>• Đồ rơi có 5 độ hiếm: <span style="color:${RARITY[0].color}">Thường</span>, <span style="color:${RARITY[1].color}">Tốt</span>, <span style="color:${RARITY[2].color}">Hiếm</span>, <span style="color:${RARITY[3].color}">Sử Thi</span>, <span style="color:${RARITY[4].color}">Huyền Thoại</span>. Quái <b style="color:#ffcf5a">Tinh Anh</b> (hào quang vàng) luôn rơi đồ.</div>
      <div>• Phân giải đồ thừa lấy đá, mang tới Thợ Rèn để cường hóa đến +10.</div>
      <div>• <b style="color:#ff8aa0">Class ẩn</b>: đánh bại Quỷ Vương ở tầng 10 để mở khóa Ảnh Sát Thủ.</div>
      <div>• Gục ngã mất 10% vàng, giữ nguyên đồ và kinh nghiệm.</div></div>`;
  },

  // ---------- Tooltip ----------
  showTip(anchor, html) {
    const t = $('tooltip');
    t.innerHTML = html; t.classList.remove('hidden');
    const r = anchor.getBoundingClientRect();
    const w = 270, h = t.offsetHeight;
    let x = r.right + 8, y = r.top;
    if (x + w > innerWidth - 8) x = r.left - w - 8;
    if (x < 8) x = 8;
    if (y + h > innerHeight - 8) y = innerHeight - h - 8;
    t.style.left = x + 'px'; t.style.top = Math.max(8, y) + 'px';
  },
  hideTip() { $('tooltip').classList.add('hidden'); },

  // ---------- Cảm ứng ----------
  initTouch() {
    const enable = () => {
      if (G.touch) return;
      G.touch = true; document.body.classList.add('touch');
      if (G.running) { $('touch').classList.remove('hidden'); this.buildTouchButtons(); }
    };
    addEventListener('touchstart', enable, { passive: true });
    const zone = $('joyzone'), base = $('joybase'), knob = $('joyknob');
    let id = null, ox = 0, oy = 0;
    zone.addEventListener('touchstart', e => {
      const t = e.changedTouches[0]; id = t.identifier; ox = t.clientX; oy = t.clientY;
      base.style.display = 'block'; base.style.left = ox + 'px'; base.style.top = oy + 'px';
      knob.style.transform = 'translate(-50%,-50%)';
      G.joy.active = true; G.joy.x = 0; G.joy.y = 0; e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) if (t.identifier === id) {
        let dx = t.clientX - ox, dy = t.clientY - oy; const d = Math.hypot(dx, dy), R = 50;
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        G.joy.x = dx / R; G.joy.y = dy / R;
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => { for (const t of e.changedTouches) if (t.identifier === id) { id = null; G.joy.active = false; G.joy.x = G.joy.y = 0; base.style.display = 'none'; } };
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
  },
  buildTouchButtons() {
    const box = $('tbtns');
    if (!G.touch || !P) { box.innerHTML = ''; return; }
    const acts = activeSkills();
    const pos = [[96, 0], [90, 66], [44, 108], [-6, 104]];
    box.innerHTML = `<button class="tb atk" id="tb-atk" aria-label="Tấn công">⚔</button>` + acts.map((sk, i) => `<button class="tb s sk-glyph" data-sk="${sk}" data-i="${i}" style="right:${pos[i][0]}px;bottom:${pos[i][1]}px;color:${CLASSES[P.ch.cls].color}">${SKILL_GLYPH[SKILLS[sk].icon]}<span class="cdt"></span></button>`).join('');
    const atk = $('tb-atk');
    atk.addEventListener('touchstart', e => { G.attackHeld = true; e.preventDefault(); }, { passive: false });
    atk.addEventListener('touchend', () => { G.attackHeld = false; });
    atk.addEventListener('touchcancel', () => { G.attackHeld = false; });
    box.querySelectorAll('[data-i]').forEach(b => b.addEventListener('touchstart', e => { useSkill(+b.dataset.i); e.preventDefault(); }, { passive: false }));
  },
};

function pips(L) { let s = ''; for (let i = 0; i < SKILL_MAX; i++) s += `<i class="${i < L ? 'on' : ''}"></i>`; return s; }
function itemCardHTML(it, cmp) {
  const R = RARITY[it.rarity];
  const st = itemStats(it);
  const typ = it.slot === 'weapon' ? `${WEAPON_TYPES[it.wtype].name} (${WEAPON_TYPES[it.wtype].classes.map(c => CLASSES[c].short).join(', ')})` : SLOT_NAME[it.slot];
  const baseLines = Object.keys(it.base).map(k => `<div class="ibase">${fmtStat(k, st[k] - it.affixes.filter(a => a.k === k).reduce((s, a) => s + a.v, 0))} ${STAT_LABEL[k]}</div>`).join('');
  const affLines = it.affixes.map(a => `<div class="iaff">${fmtStat(a.k, a.v)} ${STAT_LABEL[a.k]}</div>`).join('');
  let cmpHTML = '';
  if (cmp && cmp !== it) {
    const cs = itemStats(cmp);
    const keys = new Set([...Object.keys(st), ...Object.keys(cs)]);
    const diffs = [];
    for (const k of keys) {
      const d = (st[k] || 0) - (cs[k] || 0);
      if (Math.abs(d) < 0.05) continue;
      diffs.push(`<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${STAT_LABEL[k]} ${d > 0 ? '+' : ''}${PCT_STATS.has(k) || k.endsWith('Regen') ? Math.round(d * 10) / 10 : Math.round(d)}</span>`);
    }
    cmpHTML = `<div class="cmp">So với đang mặc (${esc(itemDisplayName(cmp))}):<br>${diffs.join(' · ') || 'Tương đương'}</div>`;
  } else if (!cmp && it.slot && P && !P.ch.equip[it.slot] && !Object.values(P.ch.equip).includes(it)) cmpHTML = `<div class="cmp up">Ô ${SLOT_NAME[it.slot]} đang trống</div>`;
  return `<div class="icard" style="border-color:${R.color}55">
    <div class="iname" style="color:${R.color}">${esc(itemDisplayName(it))}</div>
    <div class="itype">${R.name} · ${typ} · Cấp đồ ${it.ilvl}</div>
    ${baseLines}${affLines}
    ${it.legend ? '<div style="color:#ff9c2a;font-size:20px;font-style:italic">Huyền thoại kể rằng món đồ này từng thuộc về một vị anh hùng đã khuất.</div>' : ''}
    ${P && !canEquip(P.ch, it) ? '<div class="down" style="font-size:20px">Class của bạn không dùng được</div>' : ''}
    ${cmpHTML}
    <div class="hint" style="text-align:left">Giá bán ${fmt(sellValue(it))} vàng</div></div>`;
}
function drawHeroThumb(cv, who, t, walk) {
  if (!cv) return;
  const cx = cv.getContext('2d');
  cx.imageSmoothingEnabled = false;
  const ch = typeof who === 'string' ? null : who;
  const src = ch ? heroSrc(ch) : { img: IMG['hero_' + who] };
  if (ch && ch.look && Look.ok && !Look.atlas[ch.id] && !cv._wait) { cv._wait = true; Look.ensure(ch).then(() => { cv._wait = false; drawHeroThumb(cv, ch, t, walk); }); }
  cx.clearRect(0, 0, cv.width, cv.height);
  const A = walk ? HERO_ANIM.walk : HERO_ANIM.idle;
  const f = A.frames[Math.floor(t * (walk ? 8 : 2.5)) % A.frames.length];
  const img = src.img;
  if (img && (!(img instanceof HTMLImageElement) || img.complete)) cx.drawImage(img, f * 64, (A.row + DIR.DOWN) * 64, 64, 64, 0, 0, cv.width, cv.height);
}
// vẽ nhân vật lên canvas preview 192x192 (hỗ trợ khung vũ khí lớn)
function drawHeroPreview(cv, src, dir, animName, t) {
  const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
  cx.clearRect(0, 0, cv.width, cv.height);
  if (!src || !src.img) return;
  const A = HERO_ANIM[animName] || HERO_ANIM.idle;
  let idx;
  if (animName === 'walk') idx = Math.floor(t * 9) % A.frames.length;
  else if (animName === 'idle') idx = Math.floor(t * 2.5) % A.frames.length;
  else { const cyc = (t % 1.1) / 0.75; idx = Math.min(A.frames.length - 1, Math.floor(Math.min(1, cyc) * A.frames.length)); }
  const col = A.frames[idx];
  cx.fillStyle = 'rgba(0,0,0,0.35)'; cx.beginPath(); cx.ellipse(96, 123, 16, 6, 0, 0, 6.283); cx.fill();
  if (src.big && src.bigHas && src.bigHas[animName]) { cx.drawImage(src.big, col * 192, ((animName === 'slash' ? 0 : 4) + dir) * 192, 192, 192, 0, 0, 192, 192); return; }
  cx.drawImage(src.img, col * 64, (A.row + (A.noDir ? 0 : dir)) * 64, 64, 64, 64, 64, 64, 64);
}
// HUD vẽ từ Hud.png (khung rỗng + khung đầy, cắt theo tỉ lệ)
const HUDC = { x: 28, yE: 172, yF: 13, w: 307, h: 150, bars: { hp: { x0: 128, x1: 290, y: 15, h: 20 }, xp: { x0: 143, x1: 306, y: 60, h: 20 }, mp: { x0: 128, x1: 290, y: 105, h: 20 } } };
function drawHudFrame() {
  const cv = $('hudcv'), cx = cv.getContext('2d'), img = IMG.hud;
  if (!img || !img.complete) return;
  cx.imageSmoothingEnabled = false;
  cx.clearRect(0, 0, cv.width, cv.height);
  cx.drawImage(img, HUDC.x, HUDC.yE, HUDC.w, HUDC.h, 0, 0, HUDC.w, HUDC.h);
  const ch = P.ch, st = P.st;
  const ratios = { hp: P.hp / st.maxHp, xp: ch.lvl >= MAX_LEVEL ? 1 : ch.xp / xpNeed(ch.lvl), mp: P.mp / st.maxMp };
  for (const k of ['hp', 'xp', 'mp']) {
    const b = HUDC.bars[k], r = clamp(ratios[k], 0, 1);
    const w = (b.x1 - b.x0) * r;
    if (w > 0) cx.drawImage(img, HUDC.x + b.x0, HUDC.yF + b.y, w, b.h, b.x0, b.y, w, b.h);
  }
  // chân dung
  cx.save();
  cx.beginPath(); cx.arc(81, 75, 50, 0, Math.PI * 2); cx.clip();
  const g = cx.createRadialGradient(81, 60, 5, 81, 75, 55);
  g.addColorStop(0, CLASSES[ch.cls].color + '66'); g.addColorStop(1, '#100c14');
  cx.fillStyle = g; cx.fillRect(20, 20, 130, 130);
  const hi = heroSrc(ch).img;
  if (hi && (!(hi instanceof HTMLImageElement) || hi.complete)) cx.drawImage(hi, 0, (HERO_ANIM.idle.row + DIR.DOWN) * 64 + 8, 64, 34, 81 - 64, 32, 128, 68);
  cx.restore();
  const sc = cv.clientWidth / HUDC.w;
  const set = (id, k, txt) => { const b = HUDC.bars[k], el = $(id); el.style.left = b.x0 * sc + 'px'; el.style.width = (b.x1 - b.x0) * sc + 'px'; el.style.top = (b.y + 3) * sc + 'px'; el.textContent = txt; };
  set('bt-hp', 'hp', `${Math.ceil(P.hp)} / ${st.maxHp}`);
  set('bt-xp', 'xp', ch.lvl >= MAX_LEVEL ? 'MAX' : `${Math.floor(ratios.xp * 100)}%`);
  set('bt-mp', 'mp', `${Math.floor(P.mp)} / ${st.maxMp}`);
}
function migrateChar(ch) {
  ch.potions = ch.potions || { hp: 0, mp: 0 };
  ch.skills = ch.skills || {}; ch.equip = ch.equip || {}; ch.bag = ch.bag || [];
  ch.stones = ch.stones || 0; ch.playTime = ch.playTime || 0; ch.bossKills = ch.bossKills || 0; ch.deaths = ch.deaths || 0;
}

// ---------- Khởi động ----------
(async function boot() {
  Save.load();
  Music.init();
  try { Cloud.init(); } catch (e) { console.warn(e); }
  initCanvas();
  initInput();
  UI.init();
  requestAnimationFrame(loop);
  await Promise.all([loadAssets(p => { $('loadfill').style.width = Math.round(p * 100) + '%'; }), Look.init(), document.fonts ? document.fonts.load('10px "MW Pixel"').catch(() => { }) : null]);
  // animate hero trên màn hình tạo nhân vật
  setInterval(() => {
    UI.lookFrame();
    if (!$('screen-create').classList.contains('hidden')) UI.heroCanvases.forEach(cv => drawHeroThumb(cv, cv.dataset.cls, performance.now() / 1000, true));
  }, 66);
  UI.showScreen('title');
  UI.renderTitle();
})();
