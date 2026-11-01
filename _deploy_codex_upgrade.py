# -*- coding: utf-8 -*-
"""把 Codex 升级版前端部署进现有 kidsbox-deploy / powerup-deploy。
只替换前端代码层（index.html / app.js / app.css / gate.js），
复用现网已部署的 data/ 与音频图片资产（已校验逐字节一致）。
路径修正：Codex 子目录版 ../app.js -> ./app.js；移除"学习中心"链接；
新增 SW 注销，防止回头客命中旧 service worker 缓存。
"""
import os, re, shutil

SRC = r"C:/Users/范特西/Documents/Codex/2026-11-01/zhe/outputs/课程预习升级版"
MAP = [
    ("KidsBox",  r"d:/好约课外教课会员管理/kidsbox-deploy"),
    ("PowerUp",  r"d:/好约课外教课会员管理/powerup-deploy"),
]

SW_UNREG = ('<script>if(\'serviceWorker\' in navigator){'
            'navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});});}'
            '</script>')

for course, dst in MAP:
    print(f"\n===== 部署 {course} -> {dst} =====")
    src_course = os.path.join(SRC, course)
    # 1) 共享前端 app.js / app.css（来自 Codex 根）
    for f in ("app.js", "app.css"):
        sp = os.path.join(SRC, f)
        dp = os.path.join(dst, f)
        shutil.copy2(sp, dp)
        print(f"  copy {f} ({os.path.getsize(dp)} bytes)")
    # 2) gate.js（来自 Codex 课程子目录）
    sg = os.path.join(src_course, "gate.js")
    dg = os.path.join(dst, "gate.js")
    shutil.copy2(sg, dg)
    print(f"  copy gate.js ({os.path.getsize(dg)} bytes)")
    # 3) index.html：读 Codex 课程子目录版，做路径修正 + 去落地页链接 + 加 SW 注销
    ih = os.path.join(src_course, "index.html")
    with open(ih, encoding="utf-8") as f:
        html = f.read()
    html = html.replace('../app.css', './app.css')
    html = html.replace('../app.js', './app.js')
    # 移除"学习中心 ↗"链接
    html = re.sub(r'<a href="\.\./index\.html">学习中心 ↗</a>', '', html)
    # 在 </head> 前插入 SW 注销 + 空 favicon（消除 /favicon.ico 404）
    html = html.replace('</head>', '<link rel="icon" href="data:,">\n' + SW_UNREG + '\n</head>', 1)
    # 断言：不应再出现 ../ 的相对引用
    assert '../app.' not in html, "路径修正失败：仍存在 ../app."
    out = os.path.join(dst, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  write index.html ({os.path.getsize(out)} bytes)")
    # 4) 删除旧的 sw.js（旧音频缓存 SW，新版不再注册；删除可让回头客自动失效）
    sw = os.path.join(dst, "sw.js")
    if os.path.exists(sw):
        os.remove(sw)
        print("  removed old sw.js")
    # 5) 确认 data/ 与音频图片资产仍存在（不应被改动）
    for sub in ("data", "kb_audio", "kb_img") if course == "KidsBox" else ("data", "pu_audio", "pu_img"):
        p = os.path.join(dst, sub)
        n = sum(1 for _ in os.scandir(p)) if os.path.isdir(p) else -1
        print(f"  保留 {sub}/ 目录存在: {os.path.isdir(p)} (条目 {n})")
print("\n部署文件就位完成。下一步：无头验收 + git 提交推送。")
