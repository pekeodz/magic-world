"""Tạo font pixel 'MW Pixel' (TTF + WOFF2 nếu có brotli) từ bộ chữ 3x5 + dấu tiếng Việt tự vẽ.
python3 build_pixel_font.py glyphs_base.json out_dir"""
import json, sys, os, unicodedata
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

BASE = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
U = 100            # 1 pixel = 100 đơn vị
CAP = 5            # chữ cao 5 pixel

# ---- glyph tự thiết kế: (rows từ trên xuống, hàng dưới cùng của chữ ở baseline=0); 'below': số hàng nằm dưới baseline
EXTRA = {
    '.': (['.', '.', '.', '.', '#'], 0), ',': (['.', '.', '.', '.', '#', '#'], 1), ':': (['.', '#', '.', '#', '.'], 0),
    ';': (['.', '#', '.', '#', '#'], 0), '-': (['...', '...', '###', '...', '...'], 0), '+': (['...', '.#.', '###', '.#.', '...'], 0),
    '=': (['...', '###', '...', '###', '...'], 0), '/': (['..#', '..#', '.#.', '#..', '#..'], 0), '%': (['#.#', '..#', '.#.', '#..', '#.#'], 0),
    '(': (['.#', '#.', '#.', '#.', '.#'], 0), ')': (['#.', '.#', '.#', '.#', '#.'], 0), '[': (['##', '#.', '#.', '#.', '##'], 0), ']': (['##', '.#', '.#', '.#', '##'], 0),
    "'": (['#', '#', '.', '.', '.'], 0), '"': (['#.#', '#.#', '...', '...', '...'], 0), '_': (['...', '...', '...', '...', '###'], 0),
    '*': (['...', '#.#', '.#.', '#.#', '...'], 0), '<': (['..#', '.#.', '#..', '.#.', '..#'], 0), '>': (['#..', '.#.', '..#', '.#.', '#..'], 0),
    '#': (['#.#', '###', '#.#', '###', '#.#'], 0), '&': (['.#.', '#.#', '.#.', '#.#', '.##'], 0), '@': (['###', '#.#', '#.#', '#..', '###'], 0),
    '·': (['.', '.', '#', '.', '.'], 0), '•': (['..', '..', '##', '##', '..'], 0), '…': (['.....', '.....', '.....', '.....', '#.#.#'], 0),
    '’': (['#', '#', '.', '.', '.'], 0), '‘': (['#', '#', '.', '.', '.'], 0), '“': (['#.#', '#.#', '...', '...', '...'], 0), '”': (['#.#', '#.#', '...', '...', '...'], 0),
    '–': (['...', '...', '###', '...', '...'], 0), '—': (['.....', '.....', '#####', '.....', '.....'], 0),
    '▲': (['.....', '..#..', '.###.', '#####', '.....'], 0), '▼': (['.....', '#####', '.###.', '..#..', '.....'], 0),
    '›': (['#.', '.#', '#.', '..', '..'], 0), '‹': (['.#', '#.', '.#', '..', '..'], 0), '×': (['...', '#.#', '.#.', '#.#', '...'], 0),
    'Đ': (['.##.', '.#.#', '####', '.#.#', '.##.'], 0),
}
# dấu phụ (rows từ trên xuống), đặt phía trên chữ
HAT = ['.#.', '#.#']          # mũ  ^  (Â Ê Ô)
BREVE = ['#.#', '.#.']        # trăng (Ă)
TONES = {'acute': ['.#', '#.'], 'grave': ['#.', '.#'], 'hook': ['##', '.#'], 'tilde': ['.##', '##.'], 'dot': None}
HORN = True

glyphs = {}  # name -> (pixels set of (x,y)), width
def from_rows(rows, below=0):
    px = set(); h = len(rows)
    for r, line in enumerate(rows):
        y = (h - 1 - r) - below
        for x, c in enumerate(line):
            if c == '#': px.add((x, y))
    return px, max(len(l) for l in rows)
for ch, rows in BASE.items(): glyphs[ch] = from_rows(rows)
for ch, (rows, below) in EXTRA.items(): glyphs[ch] = from_rows(rows, below)

def stamp(px, rows, x0, ytop):
    for r, line in enumerate(rows):
        for x, c in enumerate(line):
            if c == '#': px.add((x0 + x, ytop - r))

def compose(base_ch, mark=None, tone=None, horn=False, stroke=False):
    px, w = set(glyphs[base_ch][0]), glyphs[base_ch][1]
    if horn:  # Ơ Ư: móc phải trên
        px.add((w, CAP)); px.add((w, CAP - 1)); w += 1
    cx = max(0, (glyphs[base_ch][1] - 3) // 2)  # căn giữa theo chữ
    if mark:
        stamp(px, mark, cx, CAP + 2)       # hàng y=7,6 (cách 1 hàng)
        if tone and tone != 'dot':
            t = TONES[tone]; stamp(px, t, cx + 3 - len(t[0]), CAP + 4)  # chồng lên mũ, lệch phải
    elif tone and tone != 'dot':
        t = TONES[tone]; tw = len(t[0]); stamp(px, t, cx + (3 - tw + 1) // 2, CAP + 2)
    if tone == 'dot':
        px.add((cx + 1, -2))
    return px, w

# bảng dựng chữ tiếng Việt
VIET_BASE = {'A': ('A', None), 'Ă': ('A', BREVE), 'Â': ('A', HAT), 'E': ('E', None), 'Ê': ('E', HAT), 'I': ('I', None),
             'O': ('O', None), 'Ô': ('O', HAT), 'Ơ': ('O', 'horn'), 'U': ('U', None), 'Ư': ('U', 'horn'), 'Y': ('Y', None)}
TONE_OF = {'́': 'acute', '̀': 'grave', '̉': 'hook', '̃': 'tilde', '̣': 'dot'}
cmap = {}
def add(ch, name, g):
    glyphs[name] = g; cmap[ord(ch)] = name
for vb, (b, m) in VIET_BASE.items():
    for tone_c, tone in [(None, None)] + list(TONE_OF.items()):
        s = vb + (tone_c or '')
        ch = unicodedata.normalize('NFC', s)
        if len(ch) != 1: continue
        horn = m == 'horn'
        g = compose(b, None if horn else m, tone, horn)
        name = 'uni%04X' % ord(ch)
        add(ch, name, g)
        low = ch.lower()
        if low != ch and len(low) == 1: cmap[ord(low)] = name
# chữ thường & ký tự cơ bản
for ch in list(BASE.keys()) + list(EXTRA.keys()):
    name = 'g%04X' % ord(ch)
    glyphs[name] = glyphs[ch]
    cmap.setdefault(ord(ch), name)
    if ch.isalpha() and ch.lower() != ch: cmap.setdefault(ord(ch.lower()), name)
cmap[ord('đ')] = 'g%04X' % ord('Đ')
glyphs['space'] = (set(), 2); cmap[32] = 'space'; cmap[0xA0] = 'space'

order = ['.notdef'] + sorted(n for n in set(cmap.values()))
fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
tt = {}; metrics = {}
def draw(px):
    pen = TTGlyphPen(None)
    for (x, y) in sorted(px):
        pen.moveTo((x * U, y * U)); pen.lineTo((x * U, (y + 1) * U)); pen.lineTo(((x + 1) * U, (y + 1) * U)); pen.lineTo(((x + 1) * U, y * U)); pen.closePath()
    return pen.glyph()
nd = draw({(0, 0), (0, 1), (0, 2), (0, 3), (0, 4), (1, 0), (2, 0), (2, 1), (2, 2), (2, 3), (2, 4), (1, 4)})
tt['.notdef'] = nd; metrics['.notdef'] = (400, 0)
for n in order[1:]:
    px, w = glyphs[n]
    tt[n] = draw(px)
    metrics[n] = ((w + 1) * U, 0)
fb.setupGlyf(tt)
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=1000, descent=-300)
fb.setupNameTable({'familyName': 'MW Pixel', 'styleName': 'Regular', 'uniqueFontIdentifier': 'MWPixel-Regular', 'fullName': 'MW Pixel', 'psName': 'MWPixel-Regular', 'version': '1.0'})
fb.setupOS2(sTypoAscender=1000, sTypoDescender=-300, sTypoLineGap=0, usWinAscent=1000, usWinDescent=300, sCapHeight=500, sxHeight=500)
fb.setupPost()
os.makedirs(OUT, exist_ok=True)
fb.save(os.path.join(OUT, 'mwpixel.ttf'))
try:
    from fontTools.ttLib import TTFont
    f = TTFont(os.path.join(OUT, 'mwpixel.ttf')); f.flavor = 'woff2'; f.save(os.path.join(OUT, 'mwpixel.woff2')); print('woff2 ok')
except Exception as e: print('no woff2', e)
print('glyphs', len(order), 'cmap', len(cmap))
