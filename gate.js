/*
 * EDGE Tutor · Kids Box 课前预习 前端访问密码门（软门）
 * 静态站无后端，此为前端软门——仅用于过滤 casual 访客。密码哈希存于本文件，明文不出现。
 * 换密码：用 make_pass.py 生成新哈希，替换下面的 GATE_HASH 即可。
 */
(function () {
  var GATE_HASH = '8aaae501';                 // 当前密码 666 的 FNV-1a 哈希
  var STORE_KEY = 'edge_gate_kidsbox_v1';     // localStorage 键（本站独立）
  var WRONG_MSG = '密码错误，请找课程老师获取密码';
  function fnv1a(str) {
    var h = 0x811c9dc5;
    var bytes = new TextEncoder().encode(str);
    for (var i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  var root = document.documentElement;
  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.textContent =
    'html.edge-gate-locked body{display:none!important;}' +
    '#edge-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
    'background:linear-gradient(135deg,#0B1340 0%,#1A237E 60%,#10205c 100%);' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;}' +
    '#edge-gate .card{background:rgba(255,255,255,.97);border-radius:20px;padding:42px 36px;width:340px;max-width:88vw;' +
    'box-shadow:0 24px 60px rgba(0,0,0,.35);text-align:center;}' +
    '#edge-gate .logo{font-size:23px;font-weight:800;color:#1A237E;letter-spacing:.5px;margin-bottom:6px;}' +
    '#edge-gate .logo span{color:#FFB800;}' +
    '#edge-gate .tip{font-size:13px;color:#6b7280;margin-bottom:24px;line-height:1.5;}' +
    '#edge-gate input{width:100%;box-sizing:border-box;padding:13px 14px;font-size:16px;border:1.5px solid #d8dce8;' +
    'border-radius:12px;outline:none;margin-bottom:16px;text-align:center;letter-spacing:3px;}' +
    '#edge-gate input:focus{border-color:#1A237E;}' +
    '#edge-gate button{width:100%;padding:13px;border:none;border-radius:12px;background:#1A237E;color:#fff;' +
    'font-size:16px;font-weight:700;cursor:pointer;transition:.15s;}' +
    '#edge-gate button:hover{background:#283593;}' +
    '#edge-gate .err{color:#e53935;font-size:13px;margin-top:14px;min-height:18px;}';
  head.appendChild(style);
  function unlock() {
    try { localStorage.setItem(STORE_KEY, '1'); } catch (e) {}
    root.classList.remove('edge-gate-locked');
    var g = document.getElementById('edge-gate');
    if (g && g.parentNode) g.parentNode.removeChild(g);
  }
  try { if (localStorage.getItem(STORE_KEY) === '1') { return; } } catch (e) {}
  root.classList.add('edge-gate-locked');
  var gate = document.createElement('div');
  gate.id = 'edge-gate';
  gate.innerHTML =
    '<div class="card">' +
    '<div class="logo">Kids Box<span> 课前预习</span></div>' +
    '<div class="tip">Kids Box 英语 · 课前预习<br/>请输入访问密码</div>' +
    '<input id="edge-pw" type="password" placeholder="访问密码" autocomplete="off" />' +
    '<button id="edge-go">进入</button>' +
    '<div class="err" id="edge-err"></div>' +
    '</div>';
  root.appendChild(gate);
  var input = document.getElementById('edge-pw');
  var err = document.getElementById('edge-err');
  var card = gate.querySelector('.card');
  function tryUnlock() {
    var v = input.value;
    if (!v) { err.textContent = WRONG_MSG; return; }
    if (fnv1a(v) === GATE_HASH) { unlock(); }
    else {
      err.textContent = WRONG_MSG; input.value = ''; input.focus();
      if (card.animate) card.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
        { duration: 300 });
    }
  }
  document.getElementById('edge-go').addEventListener('click', tryUnlock);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { tryUnlock(); } });
  input.focus();
})();
