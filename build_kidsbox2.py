# -*- coding: utf-8 -*-
"""Kids Box 重建：245 个逐课时课件 PPTX → 预习站数据
源：kidsbox-source2（飞书新文件夹，原生课件，每课件=一节课）
管线：复用 PowerUp 的 PPTX 段落级抽词 + is_vocab_chip 过滤 + 图片抽取压缩
输出：data/L0..L6.json（units→lessons(逐课时)→slides→chips/imgs）、kb_img/、audio_tasks.json
"""
import os, re, json, glob, hashlib, zipfile
from PIL import Image
import io

SRC = r'd:/好约课外教课会员管理/kidsbox-source2'
OUT = r'd:/好约课外教课会员管理/kidsbox-deploy'
IMG_DIR = os.path.join(OUT, 'kb_img')
DATA_DIR = os.path.join(OUT, 'data')
MAX_IMG_W = 480
JPEG_Q = 62
IMGS_PER_LESSON = 4

LEVELS = [
    ('01 starter 课件PPT KBS', 'L0', "Kid's Box Starter"),
    ('第一级别KB1 课件PPT', 'L1', "Kid's Box 1"),
    ('第二级别 PPT课件KB2', 'L2', "Kid's Box 2"),
    ('第三级别01 KB3 PPT课件', 'L3', "Kid's Box 3"),
    ('第四级别 KB4 课件PPT', 'L4', "Kid's Box 4"),
    ('第五级别 课件PPT', 'L5', "Kid's Box 5"),
    ('第六级别KB6 课件PPT', 'L6', "Kid's Box 6"),
]

CJK = re.compile(r'[\u4e00-\u9fff]')
SKIP_TEXT = re.compile(
    r'^(?:'
    r'https?:\S*|www\.\S*'            # URL
    r'|\d{1,2}[:：]\d{2}'             # 时间
    r'|\d{1,3}\s*[a-zA-Z]{0,3}'       # 纯数字/页码
    r'|CD\d+'
    r'|[\W\d_\s]+'                    # 纯符号
    r')$', re.I)
PREFIX_RE = re.compile(r'^(?:DO|GO|CD\d+)\s*', re.I)

def is_vocab_chip(t):
    """短英文词/词组/句型（允许末尾 . ! ? ...）→ 有发音；其余为文本卡"""
    if not t or CJK.search(t):
        return False
    if len(t) > 24:
        return False
    if len(t.split()) > 4:
        return False
    return bool(re.match(r"^[A-Za-z][A-Za-z'\- ]*[\.!\?]*$", t))

def norm_text(s):
    s = s.replace('\u2019', "'").replace('\u2018', "'")
    s = s.replace('\u201c', '"').replace('\u201d', '"')
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def parse_pptx(path):
    """返回 [(slide_idx, [chip_text...], [img_bytes...])]"""
    slides = []
    try:
        z = zipfile.ZipFile(path)
    except Exception:
        return slides
    # 幻灯片文件列表
    names = [n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)]
    names.sort(key=lambda n: int(re.search(r'\d+', n).group()))
    for sidx, n in enumerate(names, 1):
        xml = z.read(n).decode('utf-8', 'ignore')
        chips = []
        for pm in re.findall(r'<a:p>.*?</a:p>|<a:p/>', xml, re.S):
            ts = re.findall(r'<a:t>(.*?)</a:t>', pm, re.S)
            t = norm_text(''.join(ts))
            if t:
                chips.append(t)
        # 图片：rels 映射 + media 字节
        imgs = []
        if sidx <= IMGS_PER_LESSON:
            # rels 命名两种都可能：slideN.xml.rels（非标）或 slideN.rels
            rels = None
            for cand in (f'ppt/slides/_rels/slide{sidx}.xml.rels', f'ppt/slides/_rels/slide{sidx}.rels'):
                try:
                    rels = z.read(cand).decode('utf-8', 'ignore')
                    break
                except KeyError:
                    continue
            if rels:
                for m in re.findall(r'Target="\.\./media/([^"]+)"', rels):
                    media = 'ppt/media/' + os.path.basename(m)
                    try:
                        imgs.append(z.read(media))
                    except KeyError:
                        pass
        slides.append((sidx, chips, imgs))
    return slides

def save_jpg(b, out_path, max_w=MAX_IMG_W):
    try:
        im = Image.open(io.BytesIO(b))
        if im.mode != 'RGB':
            im = im.convert('RGB')
        w, h = im.size
        if w > max_w:
            im = im.resize((max_w, int(h * max_w / w)), Image.LANCZOS)
        im.save(out_path, 'JPEG', quality=JPEG_Q, optimize=True)
        return True
    except Exception:
        return False

def lesson_kind(name):
    """课件类型：normal=常规课 / review=复习 / values=价值观 / final=期末"""
    n = name.lower()
    if 'review' in n:
        return 'review'
    if 'value' in n or 'valuse' in n:  # valuse=源文件拼写错误
        return 'values'
    if '期末' in name:
        return 'final'
    return 'normal'

def unit_lesson(name):
    """从文件名提取 (单元号, 课次号)；兼容源文件拼写错误（unti4-3，t/i 颠倒）"""
    m = re.search(r'[Uu](?:nit|nti)\s*(\d+)\s*-\s*(\d+)', name)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None

def lesson_sort_key(name):
    """课件排序：单元号、课次号；review/values/期末 排同单元最后"""
    m = unit_lesson(name)
    kind = lesson_kind(name)
    if m:
        return (0, m[0], m[1], {'normal': 0, 'values': 1, 'review': 2, 'final': 3}[kind])
    return (1, 99, 99, 3)

def get_audio_path(text):
    norm = re.sub(r'\s+', ' ', text.strip().lower())
    return 'kb_audio/words/' + hashlib.sha1(norm.encode('utf-8')).hexdigest()[:10] + '.mp3'

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(IMG_DIR, exist_ok=True)
    index = []
    audio_tasks = []
    seen_audio = set()
    grand_lessons = grand_chips = 0
    for dir_name, key, disp in LEVELS:
        d = os.path.join(SRC, dir_name)
        files = sorted(glob.glob(os.path.join(d, '*.pptx')), key=lambda p: lesson_sort_key(os.path.basename(p)))
        files = [f for f in files if os.path.getsize(f) > 10 * 1024]  # 跳过损坏/空文件
        # 组织成 units → lessons
        units_map = {}
        for f in files:
            bname = os.path.basename(f)
            m = unit_lesson(bname)
            if m:
                un, ln = m
                units_map.setdefault(un, []).append((ln, f))
            else:
                units_map.setdefault('R', []).append((99, f))
        units = []
        for un in sorted(units_map, key=lambda x: (isinstance(x, str), x)):
            lessons = []
            KIND_ORDER = {'normal': 0, 'values': 1, 'review': 2, 'final': 3}
            # 常规课按课次号在前，Values/Review/期末 沉到最后
            for ln, f in sorted(units_map[un], key=lambda x: (0 if lesson_kind(os.path.basename(x[1])) == 'normal' else 1, x[0], KIND_ORDER[lesson_kind(os.path.basename(x[1]))])):
                slides = parse_pptx(f)
                out_slides = []
                lv_chips = 0
                for sidx, chips, imgs in slides:
                    out_chips = []
                    for t in chips:
                        if SKIP_TEXT.match(t) or len(t) > 120:
                            continue
                        t = PREFIX_RE.sub('', t).strip()
                        if not t:
                            continue
                        ch = {'t': t}
                        if is_vocab_chip(t):
                            a = get_audio_path(t)
                            ch['a'] = a
                            if a not in seen_audio:
                                seen_audio.add(a)
                                audio_tasks.append([t, os.path.join(OUT, a)])
                        out_chips.append(ch)
                    out_imgs = []
                    for i, imgb in enumerate(imgs[:IMGS_PER_LESSON]):
                        ud = os.path.join(IMG_DIR, key, f'u{un}')
                        os.makedirs(ud, exist_ok=True)
                        p = os.path.join(ud, f'L{ln}_p{sidx}_{i+1}.jpg')
                        if save_jpg(imgb, p):
                            out_imgs.append(f'kb_img/{key}/u{un}/L{ln}_p{sidx}_{i+1}.jpg')
                    out_slides.append({'idx': sidx, 'chips': out_chips, 'imgs': out_imgs})
                    lv_chips += len(out_chips)
                # 课次命名：Review/Values/期末 带源文件单元范围（避免重名）；导入起始课用原文件名；其余 Lesson N
                kind = lesson_kind(os.path.basename(f))
                if kind == 'review':
                    scope = re.sub(r'^\d+\s+', '', os.path.basename(f)[:-5]).strip()
                    scope = re.sub(r'^KB\d+\s*[-–]?\s*', '', scope)
                    scope = re.sub(r'^(?:review|Review)\s*[-–]?\s*', '', scope)
                    lname = ('Review 复习 ' + scope).strip()
                elif kind == 'values':
                    scope = re.sub(r'^\d+\s+', '', os.path.basename(f)[:-5]).strip()
                    scope = re.sub(r'^KB\d+\s*[-–]?\s*', '', scope)
                    scope = re.sub(r'^(?:value|values|valuse)\s*[-–]?\s*', '', scope, flags=re.I)
                    lname = ('Values 价值观 ' + scope).strip()
                elif kind == 'final':
                    lname = '期末复习'
                elif un == 'R':
                    # 起始导入课（Hello there / welcome 等）：用原文件名，去掉编号前缀
                    lname = re.sub(r'^\d+\s+', '', re.sub(r'\.pptx$', '', os.path.basename(f))).strip()
                else:
                    lname = f'Lesson {ln}'
                lessons.append({'name': lname, 'type': 'lesson', 'slides': out_slides})
                grand_lessons += 1
                grand_chips += lv_chips
            units.append({'num': un, 'name': (f'Unit {un}' if un != 'R' else '起始与复习'), 'lessons': lessons})
        d_out = {'level': key, 'name': disp, 'units': units}
        json.dump(d_out, open(os.path.join(DATA_DIR, f'{key}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        index.append({'level': key, 'name': disp, 'units': len(units),
                      'lessons': sum(len(u['lessons']) for u in units),
                      'chips': sum(len(s['chips']) for u in units for le in u['lessons'] for s in le['slides'])})
        print(f'{key}: {len(units)} 单元 / {index[-1]["lessons"]} 节课 / {index[-1]["chips"]} chips')
    json.dump(index, open(os.path.join(DATA_DIR, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(audio_tasks, open(os.path.join(OUT, 'audio_tasks.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('---')
    print(f'合计: {len(LEVELS)} 级 / {grand_lessons} 节课 / {grand_chips} chips / 音频任务 {len(audio_tasks)} 条')

if __name__ == '__main__':
    main()
