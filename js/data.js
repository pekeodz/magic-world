// ============================================================
//  MAGIC WORLD — dữ liệu game (class, kỹ năng, quái, item)
// ============================================================
'use strict';

const TILE = 32;
const DIR = { UP: 0, LEFT: 1, DOWN: 2, RIGHT: 3 };

// ---------- Hero atlas layout (do tools/gen_heroes.py tạo ra) ----------
const HERO_ANIM = {
  walk:   { row: 0,  frames: [1, 2, 3, 4, 5, 6, 7, 8] },
  stand:  { row: 0,  frames: [0] },
  slash:  { row: 4,  frames: [0, 1, 2, 3, 4, 5] },
  spell:  { row: 8,  frames: [0, 1, 2, 3, 4, 5, 6] },
  shoot:  { row: 12, frames: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  thrust: { row: 16, frames: [0, 1, 2, 3, 4, 5, 6, 7] },
  idle:   { row: 20, frames: [0, 0, 1, 1] },
  hurt:   { row: 24, frames: [0, 1, 2, 3, 4, 5], noDir: true },
};

// ---------- Thuộc tính ----------
const ATTR_INFO = {
  str: { name: 'Sức Mạnh', short: 'STR', desc: '+2 Tấn công (Hiệp Sĩ, Thánh Kiếm Sĩ), +0.5 Phòng thủ' },
  int: { name: 'Trí Tuệ', short: 'INT', desc: '+2 Tấn công (Pháp Sư), +6 MP, +0.6% sát thương kỹ năng' },
  agi: { name: 'Nhanh Nhẹn', short: 'AGI', desc: '+2 Tấn công (Cung Thủ, Sát Thủ), +0.3% chí mạng, +0.5% tốc đánh' },
  vit: { name: 'Thể Lực', short: 'VIT', desc: '+12 HP, +0.6 Phòng thủ, +0.05 hồi HP/giây' },
};

// ---------- Class ----------
const CLASSES = {
  knight: {
    name: 'Hiệp Sĩ Trọng Giáp', short: 'Hiệp Sĩ', main: 'str', color: '#9fb4d6',
    desc: 'Tường thành thép. Máu và giáp dày nhất, chém cận chiến diện rộng, choáng quái.',
    role: 'Cận chiến · Đỡ đòn', basic: { type: 'melee', anim: 'slash', range: 54, arc: 2.1, mult: 1.0 },
    base: { hp: 150, mp: 40, atk: 12, def: 9, crit: 5, critDmg: 50, aspd: 0.70, move: 92 },
    grow: { hp: 16, mp: 3, atk: 2.2, def: 1.3 },
    attrs: { str: 5, int: 1, agi: 2, vit: 5 },
    skills: ['k_whirl', 'k_wall', 'k_charge', 'k_quake', 'k_body', 'k_will'],
  },
  mage: {
    name: 'Pháp Sư', short: 'Pháp Sư', main: 'int', color: '#b08cff',
    desc: 'Bậc thầy nguyên tố. Máu mỏng nhưng phép diện rộng hủy diệt: lửa, băng, sét, thiên thạch.',
    role: 'Tầm xa · Phép thuật', basic: { type: 'proj', anim: 'spell', proj: 'arcane', speed: 330, mult: 1.0, range: 300 },
    base: { hp: 85, mp: 130, atk: 14, def: 3, crit: 6, critDmg: 50, aspd: 0.62, move: 90 },
    grow: { hp: 9, mp: 9, atk: 2.6, def: 0.6 },
    attrs: { str: 1, int: 7, agi: 2, vit: 3 },
    skills: ['m_fire', 'm_frost', 'm_chain', 'm_meteor', 'm_wisdom', 'm_flow'],
  },
  archer: {
    name: 'Cung Thủ', short: 'Cung Thủ', main: 'agi', color: '#7fcf6a',
    desc: 'Xạ thủ rừng sâu. Bắn nhanh, chí mạng cao, giữ khoảng cách và thả mưa tên.',
    role: 'Tầm xa · Chí mạng', basic: { type: 'proj', anim: 'shoot', proj: 'arrow', speed: 460, mult: 1.0, range: 340 },
    base: { hp: 100, mp: 70, atk: 13, def: 5, crit: 12, critDmg: 60, aspd: 0.55, move: 100 },
    grow: { hp: 11, mp: 5, atk: 2.4, def: 0.8 },
    attrs: { str: 2, int: 2, agi: 7, vit: 2 },
    skills: ['a_multi', 'a_pierce', 'a_roll', 'a_rain', 'a_eagle', 'a_swift'],
  },
  holy: {
    name: 'Thánh Kiếm Sĩ', short: 'Thánh Kiếm', main: 'str', color: '#ffd76a',
    desc: 'Hiệp sĩ ánh sáng. Cân bằng công thủ, tự hồi máu, cột sáng phán quyết, khắc chế u hồn.',
    role: 'Cận chiến · Hồi phục', basic: { type: 'melee', anim: 'slash', range: 56, arc: 1.9, mult: 1.05, holy: true },
    base: { hp: 125, mp: 80, atk: 12, def: 7, crit: 7, critDmg: 50, aspd: 0.66, move: 94 },
    grow: { hp: 13, mp: 5, atk: 2.3, def: 1.0 },
    attrs: { str: 5, int: 3, agi: 2, vit: 4 },
    skills: ['h_smite', 'h_heal', 'h_judge', 'h_angel', 'h_faith', 'h_aura'],
  },
  assassin: {
    name: 'Ảnh Sát Thủ', short: 'Sát Thủ', main: 'agi', color: '#ff5470', hidden: true,
    unlockHint: 'CLASS ẨN — Đánh bại Quỷ Vương ở Tầng 10 (với bất kỳ nhân vật nào) để mở khóa.',
    desc: 'Class ẩn. Kẻ đi trong bóng tối: tốc đánh cực nhanh, chí mạng khủng, độc dược và tàng hình.',
    role: 'Cận chiến · Sát thương bộc phá', basic: { type: 'melee', anim: 'thrust', range: 46, arc: 1.4, mult: 0.8 },
    base: { hp: 95, mp: 70, atk: 14, def: 4, crit: 22, critDmg: 80, aspd: 0.38, move: 108 },
    grow: { hp: 10, mp: 4, atk: 2.5, def: 0.7 },
    attrs: { str: 2, int: 1, agi: 8, vit: 3 },
    skills: ['s_step', 's_poison', 's_stealth', 's_dance', 's_kill', 's_leech'],
  },
};
const CLASS_ORDER = ['knight', 'mage', 'archer', 'holy', 'assassin'];

// ---------- Kỹ năng ----------
// type: nova | cone | proj | chain | dash | buff | heal | ground
// lv(L) => giá trị theo cấp kỹ năng L (1..5)
const SKILLS = {
  // ==== Hiệp sĩ ====
  k_whirl: { name: 'Chém Xoáy', icon: 'whirl', req: 1, mp: 12, cd: 4, anim: 'slash', type: 'nova',
    radius: 78, mult: L => 1.5 + 0.3 * L, knock: 40, fx: 'whirl', color: '#cfe0ff',
    desc: L => `Xoay kiếm 360°, gây ${pct(1.5 + 0.3 * L)} sát thương cho mọi quái xung quanh và đẩy lùi.` },
  k_wall: { name: 'Khiên Thép', icon: 'shield', req: 3, mp: 20, cd: 16, anim: 'spell', type: 'buff',
    dur: L => 6 + L, buff: L => ({ defPct: 40 + 15 * L, thorns: 10 + 5 * L }), color: '#9fc1ff',
    desc: L => `Trong ${6 + L}s: +${40 + 15 * L}% Phòng thủ, phản ${10 + 5 * L}% sát thương cận chiến.` },
  k_charge: { name: 'Xung Phong', icon: 'charge', req: 6, mp: 15, cd: 7, anim: 'thrust', type: 'dash',
    dist: L => 150 + 10 * L, mult: L => 1.4 + 0.25 * L, stun: 1.0, color: '#ffffff',
    desc: L => `Lao về phía trước ${150 + 10 * L}px, gây ${pct(1.4 + 0.25 * L)} sát thương và choáng 1s.` },
  k_quake: { name: 'Địa Chấn', icon: 'quake', req: 10, mp: 35, cd: 12, anim: 'slash', type: 'nova',
    radius: 125, mult: L => 2.2 + 0.45 * L, stun: L => 1 + 0.2 * L, fx: 'quake', color: '#d9b27a',
    desc: L => `Đập đất gây ${pct(2.2 + 0.45 * L)} sát thương phạm vi lớn, choáng ${(1 + 0.2 * L).toFixed(1)}s.` },
  k_body: { name: 'Thể Chất Thép', icon: 'heart', req: 2, passive: true,
    pass: L => ({ hpPct: 8 * L, hpRegen: 0.6 * L }),
    desc: L => `Bị động: +${8 * L}% HP tối đa, +${(0.6 * L).toFixed(1)} hồi HP/giây.` },
  k_will: { name: 'Ý Chí Bất Khuất', icon: 'armor', req: 8, passive: true,
    pass: L => ({ defPct: 6 * L, block: 3 * L }),
    desc: L => `Bị động: +${6 * L}% Phòng thủ, ${3 * L}% cơ hội chặn hoàn toàn đòn đánh.` },

  // ==== Pháp sư ====
  m_fire: { name: 'Cầu Lửa', icon: 'fire', req: 1, mp: 9, cd: 1.6, anim: 'spell', type: 'proj',
    proj: 'fire', speed: 340, mult: L => 1.6 + 0.35 * L, explode: 48, burn: L => 3 + L, color: '#ff8a3a',
    desc: L => `Phóng cầu lửa nổ ${pct(1.6 + 0.35 * L)} sát thương phạm vi, thiêu đốt ${3 + L}s.` },
  m_frost: { name: 'Băng Hoàn', icon: 'ice', req: 3, mp: 18, cd: 6, anim: 'spell', type: 'nova',
    radius: 105, mult: L => 1.2 + 0.25 * L, slow: L => 2 + 0.4 * L, fx: 'frost', color: '#9be8ff',
    desc: L => `Vòng băng gây ${pct(1.2 + 0.25 * L)} sát thương, làm chậm 50% trong ${(2 + 0.4 * L).toFixed(1)}s.` },
  m_chain: { name: 'Lôi Xích', icon: 'bolt', req: 6, mp: 20, cd: 4, anim: 'spell', type: 'chain',
    jumps: L => 3 + L, mult: L => 1.5 + 0.3 * L, range: 320, color: '#bfe3ff',
    desc: L => `Tia sét nảy qua ${3 + L} mục tiêu, mỗi lần ${pct(1.5 + 0.3 * L)} sát thương.` },
  m_meteor: { name: 'Mưa Thiên Thạch', icon: 'meteor', req: 10, mp: 45, cd: 14, anim: 'spell', type: 'ground',
    radius: 110, count: L => 5 + L, mult: L => 1.6 + 0.3 * L, color: '#ff6a2a', zone: 'meteor',
    desc: L => `Gọi ${5 + L} thiên thạch rơi vào vùng địch, mỗi viên ${pct(1.6 + 0.3 * L)} sát thương.` },
  m_wisdom: { name: 'Thông Thái', icon: 'book', req: 2, passive: true,
    pass: L => ({ dmgPct: 8 * L, mpPct: 6 * L }),
    desc: L => `Bị động: +${8 * L}% sát thương kỹ năng, +${6 * L}% MP tối đa.` },
  m_flow: { name: 'Dòng Chảy Mana', icon: 'mana', req: 8, passive: true,
    pass: L => ({ mpRegen: 1.2 * L, cdr: 4 * L }),
    desc: L => `Bị động: +${(1.2 * L).toFixed(1)} hồi MP/giây, giảm ${4 * L}% hồi chiêu.` },

  // ==== Cung thủ ====
  a_multi: { name: 'Tán Xạ', icon: 'multi', req: 1, mp: 10, cd: 3, anim: 'shoot', type: 'proj',
    proj: 'arrow', speed: 470, count: L => 3 + Math.floor(L / 2) * 2, spread: 0.5, mult: L => 0.9 + 0.2 * L, color: '#e8d3a0',
    desc: L => `Bắn ${3 + Math.floor(L / 2) * 2} mũi tên hình quạt, mỗi mũi ${pct(0.9 + 0.2 * L)} sát thương.` },
  a_pierce: { name: 'Xuyên Tâm Tiễn', icon: 'pierce', req: 3, mp: 16, cd: 5, anim: 'shoot', type: 'proj',
    proj: 'bigarrow', speed: 620, pierce: 99, mult: L => 2.4 + 0.5 * L, color: '#fff3b0',
    desc: L => `Mũi tên xuyên thấu mọi kẻ địch trên đường bay, ${pct(2.4 + 0.5 * L)} sát thương.` },
  a_roll: { name: 'Gió Lướt', icon: 'wind', req: 6, mp: 12, cd: 6, anim: 'walk', type: 'dash', back: false,
    dist: L => 130, mult: L => 0, buff: L => ({ aspdPct: 20 + 8 * L, movePct: 30 }), dur: L => 4, color: '#c9ffd0',
    desc: L => `Lướt nhanh và nhận +${20 + 8 * L}% tốc đánh, +30% tốc chạy trong 4s.` },
  a_rain: { name: 'Mưa Tên', icon: 'rain', req: 10, mp: 35, cd: 12, anim: 'shoot', type: 'ground',
    radius: 115, ticks: L => 8 + L, mult: L => 0.7 + 0.15 * L, color: '#e8d3a0', zone: 'arrowrain',
    desc: L => `Mưa tên trút xuống vùng địch ${8 + L} đợt, mỗi đợt ${pct(0.7 + 0.15 * L)} sát thương.` },
  a_eagle: { name: 'Mắt Ưng', icon: 'eye', req: 2, passive: true,
    pass: L => ({ crit: 3 * L, critDmg: 10 * L }),
    desc: L => `Bị động: +${3 * L}% chí mạng, +${10 * L}% sát thương chí mạng.` },
  a_swift: { name: 'Thân Pháp', icon: 'boot', req: 8, passive: true,
    pass: L => ({ aspdPct: 5 * L, movePct: 3 * L, dodge: 2 * L }),
    desc: L => `Bị động: +${5 * L}% tốc đánh, +${3 * L}% tốc chạy, ${2 * L}% né tránh.` },

  // ==== Thánh kiếm sĩ ====
  h_smite: { name: 'Thánh Trảm', icon: 'holy', req: 1, mp: 10, cd: 3, anim: 'slash', type: 'cone',
    range: 95, arc: 2.4, mult: L => 1.8 + 0.35 * L, holy: true, fx: 'holyslash', color: '#ffe680',
    desc: L => `Nhát chém ánh sáng hình quạt ${pct(1.8 + 0.35 * L)} sát thương. x1.5 lên u hồn & quỷ.` },
  h_heal: { name: 'Thánh Quang', icon: 'heal', req: 3, mp: 25, cd: 12, anim: 'spell', type: 'heal',
    heal: L => 18 + 6 * L, color: '#fff6b0',
    desc: L => `Hồi ngay ${18 + 6 * L}% HP tối đa và giải trừ hiệu ứng xấu.` },
  h_judge: { name: 'Phán Quyết', icon: 'pillar', req: 6, mp: 22, cd: 8, anim: 'spell', type: 'ground',
    radius: 80, count: L => 1, mult: L => 2.6 + 0.5 * L, stun: 1.2, holy: true, color: '#fff2a0', zone: 'pillar',
    desc: L => `Cột sáng giáng xuống mục tiêu: ${pct(2.6 + 0.5 * L)} sát thương phạm vi, choáng 1.2s.` },
  h_angel: { name: 'Thiên Thần Giáng Thế', icon: 'wing', req: 10, mp: 40, cd: 25, anim: 'spell', type: 'buff',
    dur: L => 8 + L, buff: L => ({ atkPct: 25 + 8 * L, defPct: 25 + 8 * L, hpRegenFlat: 4 + 2 * L }), color: '#fff0a0',
    desc: L => `Trong ${8 + L}s: +${25 + 8 * L}% Tấn công & Phòng thủ, hồi ${4 + 2 * L} HP/giây.` },
  h_faith: { name: 'Đức Tin', icon: 'heart', req: 2, passive: true,
    pass: L => ({ hpPct: 5 * L, lifesteal: 1 * L }),
    desc: L => `Bị động: +${5 * L}% HP tối đa, hút ${L}% sát thương thành máu.` },
  h_aura: { name: 'Hào Quang', icon: 'sun', req: 8, passive: true,
    pass: L => ({ atkPct: 5 * L, defPct: 4 * L }),
    desc: L => `Bị động: +${5 * L}% Tấn công, +${4 * L}% Phòng thủ.` },

  // ==== Sát thủ (class ẩn) ====
  s_step: { name: 'Ảnh Bộ', icon: 'shadow', req: 1, mp: 10, cd: 4, anim: 'thrust', type: 'dash', through: true,
    dist: L => 160, mult: L => 1.6 + 0.35 * L, color: '#b04cff',
    desc: L => `Hóa bóng xuyên qua kẻ địch, chém mọi mục tiêu trên đường ${pct(1.6 + 0.35 * L)} sát thương.` },
  s_poison: { name: 'Độc Nhận', icon: 'dagger', req: 3, mp: 14, cd: 4, anim: 'slash', type: 'proj',
    proj: 'dagger', speed: 480, count: L => 5, spread: 0.8, mult: L => 0.8 + 0.2 * L, poison: L => 4 + L, color: '#8dff6a',
    desc: L => `Phóng 5 phi đao tẩm độc, mỗi phi đao ${pct(0.8 + 0.2 * L)} sát thương + độc ${4 + L}s.` },
  s_stealth: { name: 'Tàng Hình', icon: 'mask', req: 6, mp: 20, cd: 15, anim: 'spell', type: 'buff',
    dur: L => 4 + L, buff: L => ({ stealth: 1, movePct: 25, ambush: 150 + 50 * L }), color: '#7a6aa0',
    desc: L => `Tàng hình ${4 + L}s, quái mất dấu. Đòn đầu tiên khi xuất hiện +${150 + 50 * L}% sát thương & chắc chắn chí mạng.` },
  s_dance: { name: 'Vũ Điệu Tử Thần', icon: 'whirl', req: 10, mp: 35, cd: 12, anim: 'slash', type: 'nova',
    radius: 90, hits: 5, mult: L => 0.8 + 0.15 * L, fx: 'blades', color: '#ff4060',
    desc: L => `Múa đao 5 nhịp quanh thân, mỗi nhịp ${pct(0.8 + 0.15 * L)} sát thương.` },
  s_kill: { name: 'Sát Ý', icon: 'skull', req: 2, passive: true,
    pass: L => ({ critDmg: 15 * L, crit: 1 * L }),
    desc: L => `Bị động: +${15 * L}% sát thương chí mạng, +${L}% chí mạng.` },
  s_leech: { name: 'Huyết Ảnh', icon: 'blood', req: 8, passive: true,
    pass: L => ({ lifesteal: 2 * L, dodge: 2 * L }),
    desc: L => `Bị động: hút ${2 * L}% sát thương thành máu, +${2 * L}% né tránh.` },
};
function pct(x) { return Math.round(x * 100) + '%'; }
const SKILL_MAX = 5;

// ---------- Sprite quái ----------
const SPR = {
  slime:   { img: 'm_slime', fw: 32, fh: 32, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 28 },
  rat:     { img: 'm_rat', fw: 32, fh: 32, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 28 },
  bat:     { img: 'm_bat', fw: 32, fh: 32, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 34, fly: true },
  bee:     { img: 'm_bee', fw: 32, fh: 32, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 34, fly: true },
  snake:   { img: 'm_snake', fw: 32, fh: 32, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 28 },
  worm:    { img: 'm_worm', fw: 32, fh: 32, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 28 },
  eyeball: { img: 'm_eyeball', fw: 32, fh: 38, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 40, fly: true },
  ghost:   { img: 'm_ghost', fw: 40, fh: 46, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 50, fly: true },
  pumpking:{ img: 'm_pumpking', fw: 46, fh: 46, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 44 },
  bigworm: { img: 'm_bigworm', fw: 35, fh: 50, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 47 },
  flower:  { img: 'm_flower', fw: 60, fh: 76, rows: [0, 1, 2, 3], walk: [0, 1, 2, 1], foot: 72 },
  goblin:  { img: 'm_goblin', fw: 64, fh: 64, rows: [2, 1, 0, 3], walk: [0, 1, 2, 3, 4, 5, 6, 7], atk: [8, 9, 10, 10], death: { row: 4, frames: [0, 1, 2, 3, 4] }, foot: 60 },
  goblinsword: { img: 'm_goblinsword', fw: 64, fh: 64, rows: [2, 1, 0, 3], walk: [0, 1, 2, 3, 4, 5, 6, 7], atk: [8, 9, 10, 10], death: { row: 4, frames: [0, 1, 2, 3, 4] }, foot: 60 },
  spider_g:{ img: 'm_spider_g', fw: 64, fh: 64, rows: [0, 1, 2, 3], walk: [4, 5, 6, 7, 8, 9], atk: [0, 1, 2, 3], death: { row: 4, frames: [0, 1, 2, 3] }, foot: 50 },
  spider_r:{ img: 'm_spider_r', fw: 64, fh: 64, rows: [0, 1, 2, 3], walk: [4, 5, 6, 7, 8, 9], atk: [0, 1, 2, 3], death: { row: 4, frames: [0, 1, 2, 3] }, foot: 50 },
  spider_b:{ img: 'm_spider_b', fw: 64, fh: 64, rows: [0, 1, 2, 3], walk: [4, 5, 6, 7, 8, 9], atk: [0, 1, 2, 3], death: { row: 4, frames: [0, 1, 2, 3] }, foot: 50 },
  spider_y:{ img: 'm_spider_y', fw: 64, fh: 64, rows: [0, 1, 2, 3], walk: [4, 5, 6, 7, 8, 9], atk: [0, 1, 2, 3], death: { row: 4, frames: [0, 1, 2, 3] }, foot: 50 },
  imp_r:   { img: 'm_imp_r_walk', atkImg: 'm_imp_r_atk', deathImg: 'm_imp_r_die', fw: 64, fh: 64, rows: [0, 1, 2, 3], walk: [0, 1, 2, 3], atk: [0, 1, 2, 3], death: { row: 0, frames: [0, 1, 2, 3, 4, 5, 6] }, foot: 58 },
  imp_b:   { img: 'm_imp_b_walk', atkImg: 'm_imp_b_atk', deathImg: 'm_imp_b_die', fw: 64, fh: 64, rows: [0, 1, 2, 3], walk: [0, 1, 2, 3], atk: [0, 1, 2, 3], death: { row: 0, frames: [0, 1, 2, 3, 4, 5, 6] }, foot: 58 },
  imp_g:   { img: 'm_imp_g_walk', atkImg: 'm_imp_g_atk', deathImg: 'm_imp_g_die', fw: 64, fh: 64, rows: [0, 1, 2, 3], walk: [0, 1, 2, 3], atk: [0, 1, 2, 3], death: { row: 0, frames: [0, 1, 2, 3, 4, 5, 6] }, foot: 58 },
  golem:   { img: 'b_golem_walk', atkImg: 'b_golem_atk', deathImg: 'b_golem_die', fw: 64, fh: 64, afh: 96, rows: [0, 1, 2, 3], walk: [0, 1, 2, 3, 4, 5, 6], atk: [0, 1, 2, 3, 4, 5, 6], death: { row: 0, frames: [0, 1, 2, 3, 4, 5, 6] }, foot: 60 },
  dragon:  { img: 'b_dragon', fw: 205, fh: 161, side: true, walk: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15], foot: 140 },
  // NPC (bộ LPC cũ 9 cột × 4 hàng)
  npc_merchant: { img: 'npc_merchant', fw: 64, fh: 64, rows: [0, 1, 2, 3], walk: [0], foot: 60 },
  npc_smith:    { img: 'npc_smith', fw: 64, fh: 64, rows: [0, 1, 2, 3], walk: [0], foot: 60 },
  npc_guard:    { img: 'npc_guard', fw: 64, fh: 64, rows: [0, 1, 2, 3], walk: [0], foot: 60 },
};

// ---------- Quái ----------
// ai: melee | ranged | fly | turret | charger
const MONSTERS = {
  slime:   { name: 'Slime Xanh', spr: 'slime', hp: 32, atk: 6, def: 1, spd: 42, xp: 8, r: 11, ai: 'melee', range: 22 },
  rat:     { name: 'Chuột Cống', spr: 'rat', hp: 22, atk: 5, def: 0, spd: 78, xp: 6, r: 10, ai: 'melee', range: 20 },
  bat:     { name: 'Dơi Hang', spr: 'bat', hp: 20, atk: 6, def: 0, spd: 92, xp: 7, r: 10, ai: 'fly', range: 22 },
  snake:   { name: 'Rắn Lục', spr: 'snake', hp: 30, atk: 7, def: 1, spd: 56, xp: 9, r: 10, ai: 'melee', range: 22, onHit: 'poison' },
  worm:    { name: 'Giun Hang', spr: 'worm', hp: 28, atk: 6, def: 2, spd: 40, xp: 7, r: 10, ai: 'melee', range: 22 },
  eyeball: { name: 'Nhãn Ma', spr: 'eyeball', hp: 26, atk: 8, def: 1, spd: 50, xp: 11, r: 11, ai: 'ranged', range: 230, proj: 'orb', undead: true },
  goblin:  { name: 'Goblin', spr: 'goblin', hp: 60, atk: 10, def: 3, spd: 62, xp: 15, r: 13, ai: 'melee', range: 30 },
  goblinsword: { name: 'Goblin Kiếm Sĩ', spr: 'goblinsword', hp: 75, atk: 13, def: 5, spd: 64, xp: 20, r: 13, ai: 'melee', range: 34 },
  spider_g:{ name: 'Nhện Độc', spr: 'spider_g', hp: 48, atk: 9, def: 2, spd: 78, xp: 14, r: 14, ai: 'melee', range: 30, onHit: 'poison', scale: 0.8 },
  spider_r:{ name: 'Nhện Lửa', spr: 'spider_r', hp: 60, atk: 12, def: 3, spd: 80, xp: 18, r: 14, ai: 'melee', range: 30, onHit: 'burn', scale: 0.8 },
  spider_b:{ name: 'Nhện Băng', spr: 'spider_b', hp: 58, atk: 10, def: 4, spd: 76, xp: 17, r: 14, ai: 'melee', range: 30, onHit: 'slow', scale: 0.8 },
  spider_y:{ name: 'Nhện Hoàng Kim', spr: 'spider_y', hp: 66, atk: 12, def: 5, spd: 84, xp: 20, r: 14, ai: 'melee', range: 30, scale: 0.85 },
  ghost:   { name: 'U Hồn', spr: 'ghost', hp: 45, atk: 11, def: 2, spd: 58, xp: 16, r: 13, ai: 'fly', range: 26, undead: true, ghostly: true },
  imp_g:   { name: 'Tiểu Quỷ Khiên', spr: 'imp_g', hp: 90, atk: 11, def: 9, spd: 56, xp: 22, r: 13, ai: 'melee', range: 32, demon: true },
  imp_b:   { name: 'Quỷ Băng', spr: 'imp_b', hp: 65, atk: 11, def: 4, spd: 58, xp: 21, r: 13, ai: 'ranged', range: 220, proj: 'ice', demon: true },
  imp_r:   { name: 'Hỏa Quỷ', spr: 'imp_r', hp: 78, atk: 15, def: 5, spd: 66, xp: 24, r: 13, ai: 'melee', range: 34, demon: true },
  bigworm: { name: 'Sâu Khổng Lồ', spr: 'bigworm', hp: 120, atk: 14, def: 6, spd: 36, xp: 26, r: 15, ai: 'melee', range: 30 },
  flower:  { name: 'Hoa Ăn Thịt', spr: 'flower', hp: 95, atk: 12, def: 4, spd: 0, xp: 22, r: 16, ai: 'turret', range: 260, proj: 'spit' },
  pumpking:{ name: 'Bí Ngô Ma', spr: 'pumpking', hp: 115, atk: 15, def: 6, spd: 52, xp: 28, r: 16, ai: 'charger', range: 30 },
  bee:     { name: 'Ong Sát Thủ', spr: 'bee', hp: 30, atk: 9, def: 1, spd: 110, xp: 12, r: 10, ai: 'fly', range: 22, onHit: 'poison' },
};

const BOSSES = {
  golem:  { name: 'Golem Đá Cổ Đại', spr: 'golem', hp: 3200, atk: 40, def: 10, spd: 46, xp: 400, r: 26, scale: 1.7, pattern: 'golem' },
  impking:{ name: 'Quỷ Vương Hỏa Ngục', spr: 'imp_r', hp: 6500, atk: 55, def: 12, spd: 70, xp: 900, r: 24, scale: 1.9, pattern: 'impking', demon: true },
  spiderq:{ name: 'Nhện Chúa Huyết Sắc', spr: 'spider_r', hp: 11000, atk: 72, def: 15, spd: 86, xp: 1700, r: 30, scale: 2.0, pattern: 'spiderq' },
  dragon: { name: 'Hồng Long Diệt Thế', spr: 'dragon', hp: 19000, atk: 96, def: 20, spd: 70, xp: 3200, r: 40, scale: 1.0, pattern: 'dragon', flying: true },
};
const BOSS_CYCLE = ['golem', 'impking', 'spiderq', 'dragon'];

// ---------- Vùng đất (biome) ----------
const BIOMES = [
  { key: 'cave',   name: 'Hang Động Ẩm Ướt',  dark: 0.55, mobs: ['slime', 'rat', 'bat', 'snake', 'worm'], ambient: '#1b130c' },
  { key: 'crypt',  name: 'Hầm Mộ Cổ',          dark: 0.62, mobs: ['goblin', 'spider_g', 'ghost', 'eyeball', 'goblinsword', 'imp_g'], ambient: '#101318' },
  { key: 'ruin',   name: 'Đền Băng Hoang Phế', dark: 0.5,  mobs: ['spider_b', 'imp_b', 'ghost', 'eyeball', 'bigworm', 'flower'], ambient: '#0c1420' },
  { key: 'lava',   name: 'Lò Luyện Dung Nham', dark: 0.45, mobs: ['imp_r', 'spider_r', 'pumpking', 'bee', 'bigworm', 'flower'], ambient: '#200a05' },
  { key: 'desert', name: 'Sa Mạc Lăng Mộ',     dark: 0.35, mobs: ['snake', 'spider_y', 'bigworm', 'goblinsword', 'imp_r', 'bee', 'pumpking'], ambient: '#1e170b' },
];
function biomeOf(floor) { return BIOMES[Math.floor((floor - 1) / 5) % BIOMES.length]; }
function isBossFloor(floor) { return floor % 5 === 0; }
function bossOf(floor) { return BOSS_CYCLE[(floor / 5 - 1) % BOSS_CYCLE.length]; }
function floorScale(f) {
  const n = f - 1;
  return { hp: 1 + 0.34 * n + 0.02 * n * n, atk: 1 + 0.22 * n + 0.009 * n * n, def: 1 + 0.12 * n, xp: 1 + 0.32 * n, gold: 1 + 0.25 * n };
}

// ---------- Item ----------
const RARITY = [
  { name: 'Thường', color: '#d6d6d6', affix: 1, mult: 1.0 },
  { name: 'Tốt', color: '#5fd35f', affix: 2, mult: 1.1 },
  { name: 'Hiếm', color: '#4fa3ff', affix: 3, mult: 1.25 },
  { name: 'Sử Thi', color: '#c46bff', affix: 4, mult: 1.45 },
  { name: 'Huyền Thoại', color: '#ff9c2a', affix: 5, mult: 1.8 },
];
const SLOTS = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'];
const SLOT_NAME = { weapon: 'Vũ khí', helm: 'Mũ', armor: 'Áo giáp', gloves: 'Găng tay', boots: 'Giày', ring: 'Nhẫn', amulet: 'Dây chuyền' };
const WEAPON_TYPES = {
  sword:  { name: 'Kiếm', classes: ['knight', 'holy'], icon: 'sword', implicit: { hp: 1 } },
  staff:  { name: 'Trượng', classes: ['mage'], icon: 'staff', implicit: { mp: 1 } },
  bow:    { name: 'Cung', classes: ['archer'], icon: 'bow', implicit: { crit: 1 } },
  dagger: { name: 'Song Đao', classes: ['assassin'], icon: 'dagger', implicit: { aspdPct: 1 } },
};
const CLASS_WEAPON = { knight: 'sword', holy: 'sword', mage: 'staff', archer: 'bow', assassin: 'dagger' };
const TIER_NAMES = {
  sword:  ['Kiếm Gỗ', 'Kiếm Sắt', 'Kiếm Thép', 'Kiếm Bạc', 'Kiếm Mithril', 'Long Lân Kiếm'],
  staff:  ['Gậy Gỗ', 'Trượng Đồng', 'Trượng Pha Lê', 'Trượng Ngọc Bích', 'Trượng Tinh Tú', 'Thần Long Trượng'],
  bow:    ['Cung Gỗ', 'Cung Sừng', 'Cung Thép', 'Cung Tiên Tộc', 'Cung Bão Táp', 'Phượng Hoàng Cung'],
  dagger: ['Dao Găm', 'Song Đao Sắt', 'Song Đao Thép', 'Song Nguyệt Đao', 'Song Ảnh Đao', 'Hư Vô Song Đao'],
  helm:   ['Mũ Vải', 'Mũ Da', 'Mũ Sắt', 'Mũ Giáp Bạc', 'Mũ Mithril', 'Mũ Long Lân'],
  armor:  ['Áo Vải', 'Áo Da', 'Giáp Xích', 'Giáp Bạc', 'Giáp Mithril', 'Giáp Long Lân'],
  gloves: ['Găng Vải', 'Găng Da', 'Găng Sắt', 'Găng Bạc', 'Găng Mithril', 'Găng Long Lân'],
  boots:  ['Giày Vải', 'Ủng Da', 'Ủng Sắt', 'Ủng Bạc', 'Ủng Mithril', 'Ủng Long Lân'],
  ring:   ['Nhẫn Đồng', 'Nhẫn Bạc', 'Nhẫn Vàng', 'Nhẫn Lục Bảo', 'Nhẫn Hồng Ngọc', 'Nhẫn Kim Cương'],
  amulet: ['Bùa Đồng', 'Bùa Bạc', 'Bùa Vàng', 'Bùa Ngọc Bích', 'Bùa Hồng Ngọc', 'Bùa Thần Long'],
};
const LEGEND_NAMES = {
  sword: ['Thánh Kiếm Bình Minh', 'Huyết Nguyệt Kiếm', 'Long Hồn Đại Kiếm'],
  staff: ['Trượng Hỗn Mang', 'Quyền Trượng Tinh Vân', 'Trượng Lửa Vĩnh Cửu'],
  bow: ['Cung Xạ Nhật', 'Cung Gió Bắc', 'Thiên Lang Cung'],
  dagger: ['Song Đao Huyết Ảnh', 'Nanh Rắn Độc Vương', 'Song Đao Tịch Diệt'],
  helm: ['Vương Miện Bất Tử', 'Mũ Giáp Chiến Thần'], armor: ['Giáp Rồng Đỏ', 'Thánh Giáp Thiên Sứ'],
  gloves: ['Găng Tay Titan', 'Găng Tay Bóng Đêm'], boots: ['Ủng Gió Lốc', 'Ủng Thần Tốc'],
  ring: ['Nhẫn Chúa Tể', 'Nhẫn Vô Cực'], amulet: ['Trái Tim Rồng', 'Bùa Hộ Mệnh Cổ Thần'],
};
// Bảng affix: k: khóa chỉ số, fn(ilvl) => [min,max], fmt
const AFFIXES = [
  { k: 'atk', name: 'Tấn công', r: l => [1 + l * 0.35, 3 + l * 0.8], w: 10 },
  { k: 'hp', name: 'HP', r: l => [6 + l * 3, 14 + l * 7], w: 10 },
  { k: 'def', name: 'Phòng thủ', r: l => [1 + l * 0.3, 2 + l * 0.7], w: 9 },
  { k: 'mp', name: 'MP', r: l => [5 + l * 1.5, 10 + l * 3], w: 6 },
  { k: 'crit', name: '% Chí mạng', r: l => [1, 3 + l / 12], w: 6, pct: true },
  { k: 'critDmg', name: '% ST chí mạng', r: l => [5, 12 + l / 3], w: 5, pct: true },
  { k: 'aspdPct', name: '% Tốc đánh', r: l => [2, 6 + l / 8], w: 5, pct: true },
  { k: 'movePct', name: '% Tốc chạy', r: l => [2, 6 + l / 10], w: 4, pct: true },
  { k: 'dmgPct', name: '% Sát thương', r: l => [2, 7 + l / 5], w: 6, pct: true },
  { k: 'hpRegen', name: 'Hồi HP/giây', r: l => [0.3 + l * 0.05, 0.8 + l * 0.15], w: 5, dec: 1 },
  { k: 'mpRegen', name: 'Hồi MP/giây', r: l => [0.2 + l * 0.03, 0.6 + l * 0.08], w: 4, dec: 1 },
  { k: 'lifesteal', name: '% Hút máu', r: l => [1, 2 + l / 15], w: 3, pct: true, dec: 1 },
  { k: 'str', name: 'STR', r: l => [1, 2 + l / 4], w: 5 },
  { k: 'int', name: 'INT', r: l => [1, 2 + l / 4], w: 5 },
  { k: 'agi', name: 'AGI', r: l => [1, 2 + l / 4], w: 5 },
  { k: 'vit', name: 'VIT', r: l => [1, 2 + l / 4], w: 5 },
  { k: 'cdr', name: '% Giảm hồi chiêu', r: l => [2, 5 + l / 15], w: 3, pct: true },
  { k: 'goldFind', name: '% Vàng rơi', r: l => [5, 15 + l / 2], w: 3, pct: true },
  { k: 'magicFind', name: '% Tỉ lệ đồ hiếm', r: l => [4, 10 + l / 3], w: 3, pct: true },
];
const STAT_LABEL = {
  atk: 'Tấn công', def: 'Phòng thủ', hp: 'HP', mp: 'MP', crit: 'Chí mạng', critDmg: 'ST chí mạng',
  aspdPct: 'Tốc đánh', movePct: 'Tốc chạy', dmgPct: 'Sát thương', hpRegen: 'Hồi HP/giây', mpRegen: 'Hồi MP/giây',
  lifesteal: 'Hút máu', str: 'STR', int: 'INT', agi: 'AGI', vit: 'VIT', cdr: 'Giảm hồi chiêu',
  goldFind: 'Vàng rơi', magicFind: 'Tỉ lệ đồ hiếm',
};
const PCT_STATS = new Set(['crit', 'critDmg', 'aspdPct', 'movePct', 'dmgPct', 'lifesteal', 'cdr', 'goldFind', 'magicFind']);

const UPGRADE_RATE = [100, 95, 90, 80, 70, 60, 50, 40, 30, 20];
const MAX_PLUS = 10;
const BAG_SIZE = 30;
function xpNeed(lv) { return Math.floor(30 * Math.pow(lv, 1.7) + 20 * lv); }
const MAX_LEVEL = 70;

// ---------- Icon pixel 12x12 ----------
// ký tự: . trong suốt, 1 viền tối, 2 màu chính, 3 sáng, 4 nhấn (vàng), 5 gỗ, 6 tối hơn
const ICONS = {
  sword: ['..........11', '.........133', '........1331', '.......1331.', '......1331..', '.....1331...', '.1..1331....', '.141331.....', '..1431......', '.15414......', '155.11......', '11..........'],
  staff: ['.........11.', '........1331', '........1441', '.........11.', '........15..', '.......15...', '......15....', '.....15.....', '....15......', '...15.......', '..15........', '.11.........'],
  bow:   ['.....1111...', '....122..1..', '...12.....1.', '..123.....1.', '..12.......1', '.124........', '.124.......1', '..12.......1', '..123.....1.', '...12.....1.', '....122..1..', '.....1111...'],
  dagger:['........1...', '.......131..', '......131...', '.....131....', '....131.....', '..1431......', '..141.......', '.15.1.......', '15..........', '1...........', '....1.......', '............'],
  helm:  ['............', '....1111....', '...122221...', '..12233221..', '..12322221..', '.1222222221.', '.1211111121.', '.121....121.', '.121....121.', '.111....111.', '............', '............'],
  armor: ['............', '.111....111.', '122111111221', '122233332221', '.1223333221.', '..12222221..', '..12244221..', '..12222221..', '..12222221..', '..11111111..', '............', '............'],
  gloves:['............', '...1.1.1....', '..1213131...', '..12323231..', '..12222221..', '..12222221..', '..12222221..', '..12222221..', '...122221...', '...144441...', '...111111...', '............'],
  boots: ['............', '...11111....', '...12221....', '...12221....', '...12221....', '...12221....', '...122211...', '...1222221..', '..122222221.', '..144444441.', '..111111111.', '............'],
  ring:  ['............', '.....11.....', '....1331....', '.....11.....', '....1441....', '...14..41...', '..14....41..', '..14....41..', '...14..41...', '....1441....', '............', '............'],
  amulet:['.1........1.', '..1......1..', '...1....1...', '....1..1....', '.....11.....', '....1331....', '...133321...', '...132221...', '....1221....', '.....11.....', '............', '............'],
  hpot:  ['....1111....', '.....55.....', '.....11.....', '....1..1....', '...1....1...', '..12222221..', '..12322221..', '..12222221..', '..12222221..', '...122221...', '....1111....', '............'],
  stone: ['............', '....111.....', '...13331....', '..1332221...', '.13322221...', '.122222221..', '.122222221..', '..1222221...', '...12221....', '....111.....', '............', '............'],
};
