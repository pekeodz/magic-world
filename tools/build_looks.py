"""Trích xuất danh mục ngoại hình từ bộ sprite (thư mục 'sprite') cho Magic World.
python3 build_looks.py <sprite_dir> <out_assets_dir>
Tạo: <out>/look/catalog.json và <out>/look/t/<hash>.png (texture gốc dạng palette)."""
import json, re, glob, os, sys, hashlib, shutil

SRC, OUT = sys.argv[1], sys.argv[2]
LOOK = os.path.join(OUT, 'look'); TX = os.path.join(LOOK, 't')
shutil.rmtree(LOOK, ignore_errors=True); os.makedirs(TX)

def load(f):
    s = open(f, encoding='utf8').read()
    s = re.sub(r',\s*([\]}])', r'\1', s)
    return json.loads(s)

RACES = {  # id file -> tên tiếng Việt
    'human': 'Nhân Tộc', 'darkelf': 'Tinh Linh Bóng Đêm', 'orc': 'Orc', 'demon': 'Quỷ Tộc',
    'vampire': 'Ma Cà Rồng', 'lizard': 'Thằn Lằn', 'drake': 'Long Nhân', 'wolf': 'Lang Nhân',
    'minotaur': 'Ngưu Nhân', 'zombie': 'Xác Sống', 'skeleton': 'Bộ Xương', 'goblin': 'Yêu Tinh',
}
CFG_NAME = {'Regular': 'Thường', 'Muscular': 'Cơ bắp', 'Gaunt': 'Gầy gò', 'Musc. Gaunt': 'Gầy cơ bắp', 'Elderly': 'Lớn tuổi', 'Musc. Elderly': 'Lớn tuổi cơ bắp'}
SKIP_CFG = {'Child', 'Pregnant'}
BODY_TYPES = {'hm1', 'hm2', 'hf1'}
CHAR_SLOTS = ['body', 'head', 'ears', 'eyes', 'nose', 'hair', 'hairadd', 'facial', 'horns', 'tail', 'wings']
GEAR_SLOTS = ['shirt', 'jacket', 'pants', 'shoes', 'belt', 'gloves', 'back', 'hat', 'glasses', 'mask', 'mainhand', 'offhand']
WEAPONS = {  # vũ khí cho phép theo loại vũ khí game
    'sword': ['sword1', 'sword2', 'sword5', 'sword6', 'swordglow', 'waraxe', 'mace', 'flail'],
    'staff': ['staff1', 'staff2', 'staff3', 'staff4', 'wand1', 'wand2'],
    'bow': ['bow1', 'bow2', 'bow3', 'bow4'],
    'dagger': ['dagger1', 'sword5', 'sword6'],
}
SHIELDS = ['none', 'kite1', 'kite2', 'crusader', 'round', 'spartan']

# ---------- đọc item ----------
items = {}
for slot in CHAR_SLOTS:
    for f in glob.glob(f'{SRC}/data/character/{slot}/*') + glob.glob(f'{SRC}/data/character/{slot}/*/*'):
        if os.path.isdir(f): continue
        d = load(f); items.setdefault(slot, {})[d['id']] = d
for slot in GEAR_SLOTS:
    for f in glob.glob(f'{SRC}/data/gear/{slot}/*'):
        d = load(f); items.setdefault(slot, {})[d['id']] = d

# ---------- chủng tộc ----------
races = []
heads = set()
for rid, vname in RACES.items():
    d = load(f'{SRC}/data/character/race/{rid}.race')
    cfgs = []
    for c in d['configs']:
        if c['name'] in SKIP_CFG or c['body-type'] not in BODY_TYPES: continue
        heads.add(c['head-type'])
        slots = {k: c[k] for k in CHAR_SLOTS if k in c and isinstance(c[k], list)}
        cfgs.append({'id': c['id'], 'name': ('Nam' if c['gender'] == 'male' else 'Nữ') + ' · ' + CFG_NAME.get(c['name'], c['name']),
                     'gender': c['gender'], 'body': c['body-type'], 'head': c['head-type'], 'slots': slots})
    if cfgs: races.append({'id': rid, 'name': vname, 'configs': cfgs})
TYPES = BODY_TYPES | heads

# ---------- texture ----------
texmap = {}
def tex(p):
    if not p or p == 'none': return None
    full = os.path.join(SRC, p)
    if not os.path.exists(full): return None
    if p not in texmap:
        h = hashlib.md5(p.encode()).hexdigest()[:10]
        shutil.copy(full, os.path.join(TX, h + '.png'))
        texmap[p] = h
    return texmap[p]

SHEET = {None: 'base', 'char_base': 'base', 'char_large_slash': 'slash', 'char_large_thrust': 'thrust'}
cat_items = {}
used_cm = set()
for slot, its in items.items():
    out = {}
    for iid, d in its.items():
        if slot == 'mainhand' and iid not in {w for v in WEAPONS.values() for w in v}: continue
        if slot == 'offhand' and iid not in SHIELDS: continue
        t = {}
        for e in d.get('textures', []):
            ty = e.get('body') or e.get('head')
            if ty not in TYPES: continue
            sh = SHEET.get(e.get('spritesheet'), None)
            if sh is None: continue
            b, f = tex(e.get('back')), tex(e.get('front'))
            if not b and not f: continue
            t.setdefault(ty, {})[sh] = [b, f]
        if not t and iid != 'none': continue
        it = {'n': d.get('name', iid), 'tx': t, 'key': 'head' if any(e.get('head') for e in d.get('textures', [])) else 'body'}
        for k, kk in (('primarycolors', 'p'), ('secondarycolors', 's'), ('fixedcolors', 'f')):
            if d.get(k): it[kk] = d[k]; used_cm.update(d[k])
        if d.get('slotshidden'): it['hide'] = d['slotshidden']
        if d.get('tags'): it['tags'] = d['tags']
        out[iid] = it
    cat_items[slot] = out

# ---------- bảng màu ----------
cm = load(f'{SRC}/data/colormaps/default.cm')
cms = {}
for c in cm['items']:
    if c['id'] not in used_cm: continue
    pairs = c['colors']
    m = {}
    for i in range(0, len(pairs), 2):
        v = pairs[i + 1] & 0xFFFFFFFF
        m[pairs[i]] = [(v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255]
    col = c.get('color', 0) & 0xFFFFFFFF
    cms[c['id']] = {'n': c['name'], 'c': '#%02x%02x%02x' % ((col >> 24) & 255, (col >> 16) & 255, (col >> 8) & 255), 'm': m}

# ---------- khung hình ----------
anim = load(f'{SRC}/data/character.anim')
A = {a['id']: [[f[0] // 64, f[1] // 64] for f in a['frames']] for a in anim['animations']}

catalog = {'races': races, 'items': cat_items, 'colormaps': cms, 'anims': A, 'weapons': WEAPONS, 'shields': SHIELDS}
json.dump(catalog, open(os.path.join(LOOK, 'catalog.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
tot = sum(os.path.getsize(os.path.join(TX, f)) for f in os.listdir(TX))
print('races', len(races), 'textures', len(texmap), 'size', tot // 1024, 'KB', 'catalog', os.path.getsize(os.path.join(LOOK, 'catalog.json')) // 1024, 'KB')
print({k: len(v) for k, v in cat_items.items()})
