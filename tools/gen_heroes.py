"""Generate class hero atlases from the LPC universal base body ("Nhan vat mac dinh").
Atlas layout (64px frames, 13 cols): walk rows0-3, slash 4-7, spell 8-11, shoot 12-15,
thrust 16-19, idle 20-23, hurt 24. Direction order per anim: up,left,down,right."""
import sys, os
from PIL import Image

SRC = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)

SKIN = {(250, 236, 231): 0, (249, 213, 186): 1, (228, 164, 124): 2, (204, 134, 101): 3, (153, 66, 60): 4}
OUTLINE = (39, 25, 32)

def ramp(*c):
    return [tuple(x) for x in c]

PAL = {
    'knight': dict(
        body=ramp((236, 241, 247), (192, 202, 216), (142, 155, 175), (96, 108, 130), (62, 68, 90)),
        legs=ramp((170, 180, 196), (128, 140, 160), (96, 106, 126), (70, 78, 98), (48, 52, 70)),
        head=ramp((236, 241, 247), (192, 202, 216), (142, 155, 175), (96, 108, 130), (62, 68, 90)),
        accent=ramp((255, 120, 110), (220, 60, 60), (170, 35, 40), (120, 20, 30), (80, 12, 20)),
        style='helmet'),
    'holy': dict(
        body=ramp((255, 250, 222), (252, 228, 150), (232, 182, 72), (182, 128, 40), (116, 78, 26)),
        legs=ramp((240, 246, 255), (206, 218, 236), (160, 176, 204), (114, 130, 162), (74, 86, 116)),
        head=ramp((255, 246, 170), (250, 220, 90), (222, 176, 50), (170, 120, 30), (110, 74, 20)),
        accent=ramp((180, 230, 255), (110, 190, 250), (60, 140, 220), (40, 95, 170), (25, 60, 120)),
        style='hair'),
    'mage': dict(
        body=ramp((206, 176, 255), (156, 116, 234), (110, 74, 190), (74, 48, 140), (46, 28, 92)),
        legs=ramp((176, 140, 244), (130, 92, 210), (92, 60, 166), (62, 40, 120), (40, 24, 80)),
        head=ramp((250, 250, 255), (220, 224, 240), (184, 190, 214), (140, 146, 176), (96, 100, 130)),
        accent=ramp((255, 230, 140), (250, 200, 70), (210, 150, 40), (160, 100, 25), (100, 60, 15)),
        style='hat'),
    'archer': dict(
        body=ramp((194, 232, 144), (124, 184, 84), (78, 138, 58), (52, 98, 42), (32, 62, 30)),
        legs=ramp((204, 164, 114), (154, 114, 74), (114, 78, 48), (82, 54, 34), (52, 34, 24)),
        head=ramp((170, 220, 120), (110, 170, 74), (70, 126, 52), (46, 90, 38), (28, 58, 26)),
        accent=ramp((240, 210, 160), (200, 160, 100), (160, 115, 65), (115, 80, 45), (75, 50, 30)),
        style='hood'),
    'assassin': dict(
        body=ramp((112, 102, 128), (78, 70, 94), (54, 48, 66), (38, 33, 48), (24, 20, 32)),
        legs=ramp((96, 88, 110), (66, 60, 80), (46, 41, 58), (32, 28, 42), (20, 17, 27)),
        head=ramp((104, 96, 120), (72, 66, 88), (50, 45, 62), (36, 31, 46), (22, 18, 30)),
        accent=ramp((255, 110, 120), (220, 40, 60), (165, 20, 40), (115, 12, 28), (70, 6, 18)),
        style='hood_mask'),
}

ANIMS = [('walk.png', 4), ('slash.png', 4), ('spellcast.png', 4), ('shoot.png', 4), ('thrust.png', 4), ('idle.png', 4), ('hurt.png', 1)]
DIRS4 = ['up', 'left', 'down', 'right']


def head_info(fr):
    """Return (headTop, cx) using central columns only."""
    W, H = fr.size
    px = fr.load()
    ht = None
    for y in range(H):
        if any(px[x, y][3] > 0 for x in range(26, 39)):
            ht = y
            break
    if ht is None:
        return None
    xs = [x for x in range(18, 46) if px[x, min(ht + 4, 63)][3] > 0]
    cx = (sum(xs) / len(xs)) if xs else 32
    return ht, cx


def recolor(fr, pal, facing):
    fr = fr.copy()
    bb = fr.getbbox()
    if not bb:
        return fr
    lying = (bb[2] - bb[0]) > (bb[3] - bb[1]) + 4
    info = head_info(fr)
    if not info:
        return fr
    ht, cx = info
    px = fr.load()
    neck = ht + 17
    legs = ht + 36
    style = pal['style']
    for y in range(64):
        for x in range(64):
            p = px[x, y]
            if p[3] == 0:
                continue
            key = p[:3]
            if key not in SKIN:
                continue
            s = SKIN[key]
            dx = x - cx
            inhead = ht <= y < neck and abs(dx) <= 11
            target = None
            if lying:
                # simple: everything except a head-ish blob becomes body color
                target = pal['body'] if y > bb[1] + 6 else None
            elif inhead:
                hy = y - ht
                if style in ('helmet', 'hood', 'hood_mask'):
                    if facing == 'up':
                        cover = hy < 16
                    elif facing == 'down':
                        cover = hy < 7 or (hy < 15 and abs(dx) >= 7)
                        if style == 'hood_mask' and hy >= 13:
                            cover = True
                    elif facing == 'left':
                        cover = hy < 7 or (hy < 15 and dx > -2)
                        if style == 'hood_mask' and hy >= 13 and dx < 0:
                            cover = True
                    else:
                        cover = hy < 7 or (hy < 15 and dx < 2)
                        if style == 'hood_mask' and hy >= 13 and dx > 0:
                            cover = True
                    if cover:
                        target = pal['head']
                        if style == 'hood_mask' and facing != 'up' and hy >= 13:
                            target = pal['accent']
                else:  # hair / hat (hat adds geometry later; hair underneath)
                    if facing == 'up':
                        cover = hy < 14
                    elif facing == 'down':
                        cover = hy < 5 or (hy < 10 and abs(dx) >= 8)
                    elif facing == 'left':
                        cover = hy < 5 or (hy < 12 and dx > 0)
                    else:
                        cover = hy < 5 or (hy < 12 and dx < 0)
                    if cover:
                        target = pal['head']
            elif y >= neck:
                if y >= legs:
                    target = pal['legs']
                    if y >= legs + 7:  # boots
                        target = [tuple(int(c * 0.55) for c in col) for col in pal['legs']]
                else:
                    target = pal['body']
                    # belt
                    if y in (legs - 3, legs - 2):
                        target = pal['accent']
                    # neck scarf for assassin
                    if style == 'hood_mask' and y < neck + 3 and abs(dx) <= 9:
                        target = pal['accent']
            if target:
                px[x, y] = target[s] + (255,)
    if style == 'hat' and not lying:
        draw_hat(fr, ht, cx, pal, facing)
    if style == 'helmet' and not lying:
        draw_plume(fr, ht, cx, pal, facing)
    return fr


def put(px, x, y, c):
    if 0 <= x < 64 and 0 <= y < 64:
        px[x, y] = c + (255,)


def draw_hat(fr, ht, cx, pal, facing):
    px = fr.load()
    H = pal['body']
    cx = int(round(cx))
    tilt = {'left': 3, 'right': -3}.get(facing, 1)
    apex_y = ht - 13
    base_y = ht + 3
    for y in range(apex_y, base_y + 1):
        t = (y - apex_y) / (base_y - apex_y)
        half = int(1 + t * 9)
        ox = int(round(tilt * (1 - t)))
        for x in range(cx - half + ox, cx + half + ox + 1):
            edge = x in (cx - half + ox, cx + half + ox) or y == apex_y
            shade = 1 if x < cx + ox else 2
            put(px, x, y, OUTLINE if edge else H[shade])
    # brim
    for y in (base_y, base_y + 1, base_y + 2):
        half = 14 if y == base_y + 1 else 13
        for x in range(cx - half, cx + half + 1):
            edge = x in (cx - half, cx + half) or y == base_y + 2
            put(px, x, y, OUTLINE if edge else H[3])
    # band
    for x in range(cx - 8, cx + 9):
        put(px, x, base_y - 2, pal['accent'][1])
        put(px, x, base_y - 1, pal['accent'][2])


def draw_plume(fr, ht, cx, pal, facing):
    px = fr.load()
    A = pal['accent']
    cx = int(round(cx))
    if facing in ('up', 'down'):
        for i in range(6):
            for w in (-1, 0, 1):
                put(px, cx + w, ht - 1 - i, A[1 if w <= 0 else 2])
            put(px, cx - 2, ht - 1 - i, OUTLINE)
            put(px, cx + 2, ht - 1 - i, OUTLINE)
        for w in range(-2, 3):
            put(px, cx + w, ht - 7, OUTLINE)
    else:
        d = 1 if facing == 'left' else -1
        for i in range(9):
            yy = ht - 2 - (i // 3)
            xx = cx + d * i
            put(px, xx, yy, A[1])
            put(px, xx, yy - 1, A[2])
            put(px, xx, yy - 2, OUTLINE)
            put(px, xx, yy + 1, OUTLINE)


def build(cls):
    pal = PAL[cls]
    atlas = Image.new('RGBA', (832, 64 * 25), (0, 0, 0, 0))
    row = 0
    for fname, nrows in ANIMS:
        sheet = Image.open(os.path.join(SRC, fname)).convert('RGBA')
        for r in range(nrows):
            facing = DIRS4[r] if nrows == 4 else 'down'
            for c in range(13):
                fr = sheet.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64))
                if not fr.getbbox():
                    continue
                atlas.paste(recolor(fr, pal, facing), (c * 64, row * 64))
            row += 1
    atlas.save(os.path.join(OUT, f'hero_{cls}.png'), optimize=True)


for k in PAL:
    build(k)
print('ok')
