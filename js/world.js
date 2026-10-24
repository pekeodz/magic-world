// ============================================================
//  MAGIC WORLD — sinh bản đồ hầm ngục & thị trấn
// ============================================================
'use strict';

const T_WALL = 0, T_FLOOR = 1, T_LAVA = 2, T_PATH = 3, T_SOLID_DECO = 4;

function makeGrid(w, h, fill = T_WALL) { return { w, h, t: new Uint8Array(w * h).fill(fill) }; }
function gget(g, x, y) { return (x < 0 || y < 0 || x >= g.w || y >= g.h) ? T_WALL : g.t[y * g.w + x]; }
function gset(g, x, y, v) { if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.t[y * g.w + x] = v; }
function walkable(v) { return v === T_FLOOR || v === T_LAVA || v === T_PATH; }

function carveRoom(g, r) { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) gset(g, x, y, T_FLOOR); }
function carveCorridor(g, a, b) {
  let x = a.cx, y = a.cy;
  const horizFirst = Math.random() < 0.5;
  const stepX = () => { while (x !== b.cx) { gset(g, x, y, T_FLOOR); gset(g, x, y + 1, T_FLOOR); x += Math.sign(b.cx - x); } };
  const stepY = () => { while (y !== b.cy) { gset(g, x, y, T_FLOOR); gset(g, x + 1, y, T_FLOOR); y += Math.sign(b.cy - y); } };
  if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
  gset(g, x, y, T_FLOOR); gset(g, x + 1, y, T_FLOOR); gset(g, x, y + 1, T_FLOOR);
}
function bfs(g, sx, sy) {
  const d = new Int32Array(g.w * g.h).fill(-1);
  const q = [sx + sy * g.w]; d[q[0]] = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i], x = p % g.w, y = (p / g.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!walkable(gget(g, nx, ny))) continue;
      const np = nx + ny * g.w;
      if (d[np] >= 0) continue;
      d[np] = d[p] + 1; q.push(np);
    }
  }
  return d;
}

function genDungeon(floor) {
  const biome = biomeOf(floor);
  if (isBossFloor(floor)) return genBossFloor(floor, biome);
  const W = 64, H = 48;
  const g = makeGrid(W, H);
  const rooms = [];
  const maxRooms = 9 + Math.min(5, Math.floor(floor / 4));
  for (let tries = 0; tries < 300 && rooms.length < maxRooms; tries++) {
    const w = randi(7, 13), h = randi(6, 10);
    const r = { x: randi(2, W - w - 2), y: randi(3, H - h - 2), w, h };
    if (rooms.some(o => r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 3 && r.y + r.h + 3 > o.y)) continue;
    r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1);
    rooms.push(r);
  }
  rooms.sort((a, b) => a.cx - b.cx);
  rooms.forEach(r => carveRoom(g, r));
  for (let i = 1; i < rooms.length; i++) {
    let best = 0, bd = 1e9;
    for (let j = 0; j < i; j++) { const d = Math.hypot(rooms[i].cx - rooms[j].cx, rooms[i].cy - rooms[j].cy); if (d < bd) { bd = d; best = j; } }
    carveCorridor(g, rooms[best], rooms[i]);
  }
  for (let k = 0; k < 2; k++) { const a = pick(rooms), b = pick(rooms); if (a !== b) carveCorridor(g, a, b); }
  const start = rooms[0];
  const d = bfs(g, start.cx, start.cy);
  let exit = rooms[rooms.length - 1], far = -1;
  for (const r of rooms) { const v = d[r.cx + r.cy * W]; if (v > far) { far = v; exit = r; } }
  // dung nham
  if (biome.key === 'lava') {
    for (const r of rooms) {
      if (r === start || r === exit) continue;
      const n = randi(1, 2);
      for (let i = 0; i < n; i++) {
        const px = randi(r.x + 1, r.x + r.w - 3), py = randi(r.y + 1, r.y + r.h - 3);
        const pw = randi(2, 3), ph = randi(2, 3);
        for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) if (Math.abs(x - r.cx) + Math.abs(y - r.cy) > 1) gset(g, x, y, T_LAVA);
      }
    }
  }
  return { grid: g, rooms, start, exit, biome, floor, boss: false };
}

function genBossFloor(floor, biome) {
  const W = 40, H = 36;
  const g = makeGrid(W, H);
  const arena = { x: 5, y: 4, w: 30, h: 19 };
  const start = { x: 16, y: 28, w: 8, h: 5 };
  [arena, start].forEach(r => { r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1); carveRoom(g, r); });
  for (let y = arena.y + arena.h; y < start.y; y++) for (let x = 19; x <= 21; x++) gset(g, x, y, T_FLOOR);
  // cột đá trong đấu trường
  for (const [px, py] of [[10, 8], [29, 8], [10, 18], [29, 18]]) { gset(g, px, py, T_WALL); gset(g, px + 1, py, T_WALL); }
  return { grid: g, rooms: [arena, start], start, exit: arena, arena, biome, floor, boss: true };
}

// ---------- Thị trấn ----------
function genTown() {
  const W = 34, H = 26;
  const g = makeGrid(W, H, T_FLOOR);
  // biên = cây
  for (let x = 0; x < W; x++) { gset(g, x, 0, T_SOLID_DECO); gset(g, x, 1, T_SOLID_DECO); gset(g, x, H - 1, T_SOLID_DECO); }
  for (let y = 0; y < H; y++) { gset(g, 0, y, T_SOLID_DECO); gset(g, W - 1, y, T_SOLID_DECO); }
  // đường đá
  for (let y = 5; y < H - 1; y++) for (let x = 16; x <= 17; x++) gset(g, x, y, T_PATH);
  for (let x = 5; x < W - 5; x++) for (let y = 14; y <= 15; y++) gset(g, x, y, T_PATH);
  // tường lâu đài phía trên (hàng 2..4) trừ cổng
  for (let x = 1; x < W - 1; x++) for (let y = 2; y <= 4; y++) gset(g, x, y, T_SOLID_DECO);
  for (let x = 15; x <= 18; x++) for (let y = 3; y <= 4; y++) gset(g, x, y, T_PATH);
  const deco = [];
  // cây trang trí
  const treeSpots = [[3, 7], [5, 20], [9, 22], [26, 21], [30, 19], [29, 7], [3, 12], [30, 12], [22, 23], [12, 7], [22, 7]];
  for (const [x, y] of treeSpots) {
    deco.push({ kind: Math.random() < 0.5 ? 'pine' : 'oak', x: x * TILE + 16, y: y * TILE + 28 });
    gset(g, x, y, T_SOLID_DECO);
  }
  deco.push({ kind: 'rocks', x: 25 * TILE, y: 18 * TILE });
  const npcs = [
    { id: 'merchant', name: 'Thương Nhân Lyra', spr: 'npc_merchant', x: 8 * TILE + 16, y: 13 * TILE + 8, dir: DIR.DOWN, panel: 'shop', line: 'Bình máu, bình mana, trang bị tốt — mua đi kẻo hết!' },
    { id: 'smith', name: 'Thợ Rèn Borin', spr: 'npc_smith', x: 25 * TILE + 16, y: 13 * TILE + 8, dir: DIR.DOWN, panel: 'forge', line: 'Mang đồ tới đây, ta cường hóa hoặc phân giải cho.' },
    { id: 'guard', name: 'Vệ Binh Cổng Hầm', spr: 'npc_guard', x: 19 * TILE + 24, y: 6 * TILE + 4, dir: DIR.DOWN, panel: 'gate', line: 'Cổng hầm ngục Magic World. Ngươi muốn xuống tầng nào?' },
  ];
  return { grid: g, town: true, deco, npcs, start: { cx: 16.5, cy: 18 }, gate: { x: 17 * TILE, y: 4 * TILE + 4 }, biome: { key: 'town', name: 'Thị Trấn Khởi Nguyên', dark: 0 } };
}

// ---------- Vẽ bản đồ ra canvas tĩnh ----------
function renderMapCanvas(world) {
  const g = world.grid;
  const cv = document.createElement('canvas');
  cv.width = g.w * TILE; cv.height = g.h * TILE;
  const cx = cv.getContext('2d');
  cx.imageSmoothingEnabled = false;
  const meta = TILEMETA[world.biome.key];
  const tileImg = IMG.tiles;
  const drawT = (idx, x, y) => cx.drawImage(tileImg, idx * 32, 0, 32, 32, x * TILE, y * TILE, TILE, TILE);
  cx.fillStyle = '#07060a'; cx.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const v = gget(g, x, y);
    const h = hash2(x, y);
    if (walkable(v) || (world.town && v === T_SOLID_DECO)) {
      if (v === T_PATH && meta.path) drawT(meta.path[h % meta.path.length], x, y);
      else { const fv = (h >> 3) % 100; drawT(meta.floor[fv < 72 ? 0 : 1 + (fv % (meta.floor.length - 1))], x, y); }
      if (v === T_LAVA && meta.hazard) drawT(meta.hazard[h % meta.hazard.length], x, y);
    }
  }
  if (!world.town) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (gget(g, x, y) !== T_WALL) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (walkable(gget(g, x + dx, y + dy))) { near = true; break; }
      if (!near) continue;
      const h = hash2(x, y);
      if (walkable(gget(g, x, y + 1))) {
        drawT(meta.face[h % meta.face.length], x, y);
        // viền trên mặt tường
        cx.fillStyle = 'rgba(0,0,0,0.35)'; cx.fillRect(x * TILE, y * TILE, TILE, 3);
      } else {
        drawT(meta.top[h % meta.top.length], x, y);
        cx.fillStyle = 'rgba(0,0,0,0.45)'; cx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    // bóng đổ dưới chân tường
    for (let y = 1; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!walkable(gget(g, x, y)) || walkable(gget(g, x, y - 1))) continue;
      const gr = cx.createLinearGradient(0, y * TILE, 0, y * TILE + 14);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = gr; cx.fillRect(x * TILE, y * TILE, TILE, 14);
    }
    for (let y = 0; y < g.h; y++) for (let x = 1; x < g.w; x++) {
      if (!walkable(gget(g, x, y)) || walkable(gget(g, x - 1, y))) continue;
      cx.fillStyle = 'rgba(0,0,0,0.3)'; cx.fillRect(x * TILE, y * TILE, 6, TILE);
    }
  } else {
    // thị trấn: tường lâu đài + cổng
    const wall = IMG.deco_wall;
    for (let x = 0; x < g.w * TILE; x += 96) cx.drawImage(wall, 0, 0, 96, 70, x, 2 * TILE - 6, 96, 70 + 30);
    cx.drawImage(IMG.deco_tower, 9 * TILE, 1 * TILE - 4, 96, 106);
    cx.drawImage(IMG.deco_tower, 22 * TILE - 8, 1 * TILE - 4, 96, 106);
    // cổng: nền tối + vòm
    const gx = 15 * TILE - 8, gy = 1 * TILE + 4;
    const rg = cx.createRadialGradient(gx + 72, gy + 80, 4, gx + 72, gy + 80, 60);
    rg.addColorStop(0, '#b56cff'); rg.addColorStop(0.5, '#3b1460'); rg.addColorStop(1, '#0b0414');
    cx.fillStyle = rg; cx.fillRect(gx + 24, gy + 30, 96, 80);
    cx.drawImage(IMG.deco_arch, 0, 0, 96, 96, gx, gy, 144, 120);
    cx.drawImage(IMG.deco_banner0, 13 * TILE, 2 * TILE + 8, 32, 64);
    cx.drawImage(IMG.deco_banner1, 20 * TILE, 2 * TILE + 8, 32, 64);
    cx.drawImage(IMG.deco_banner3, 5 * TILE, 2 * TILE + 8, 32, 64);
    cx.drawImage(IMG.deco_banner2, 28 * TILE, 2 * TILE + 8, 32, 64);
    // hàng cây biên
    for (let x = 0; x < g.w; x += 2) {
      cx.drawImage(IMG.deco_pine, x * TILE - 16, (g.h - 1) * TILE - 120, 64, 160);
    }
    for (let y = 4; y < g.h; y += 2) {
      cx.drawImage(IMG.deco_pine, -28, y * TILE - 120, 64, 160);
      cx.drawImage(IMG.deco_pine, (g.w - 1) * TILE - 4, y * TILE - 120, 64, 160);
    }
  }
  return cv;
}
