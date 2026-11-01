// 无头诊断：为什么"播放没有声音"——追踪 Audio 事件 / play() 结果 / TTS 回退
const path = require('path');
const fs = require('fs');
let pw;
try { pw = require(path.join('C:/Users/范特西/.workbuddy/binaries/node/workspace/node_modules', 'playwright-core')); }
catch (e) { console.error('playwright-core 加载失败:', e.message); process.exit(1); }

const TARGETS = process.argv[2] && process.argv[2].startsWith('http')
  ? [{ name: 'LIVE', url: process.argv[2] }]
  : [{ name: 'KIDSBOX', url: 'http://127.0.0.1:8131/' }, { name: 'POWERUP', url: 'http://127.0.0.1:8132/' }];

(async () => {
  const exe = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  for (const t of TARGETS) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const course = t.name === 'POWERUP' ? 'PowerUp' : 'KidsBox';
    const logs = [];
    page.on('console', m => logs.push('[console] ' + m.text()));
    page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
    page.on('requestfailed', r => logs.push('[reqfail] ' + r.url().slice(-70) + ' ' + (r.failure()?.errorText || '')));
    page.on('response', r => { if (r.status() >= 400) logs.push('[http' + r.status() + '] ' + r.url().slice(-70)); });

    await page.addInitScript(course => {
      try { localStorage.setItem(course === 'PowerUp' ? 'edge_gate_powerup_v1' : 'edge_gate_kidsbox_v1', '1'); } catch {}
      window.__audioLog = [];
      const OrigAudio = window.Audio;
      window.Audio = function (src) {
        const a = new OrigAudio(src);
        const rec = { src: String(src || ''), events: [], playResult: null, currentTimeAdvances: null };
        window.__audioLog.push(rec);
        ['loadstart', 'canplay', 'playing', 'error', 'stalled', 'suspend', 'abort'].forEach(ev =>
          a.addEventListener(ev, () => rec.events.push(ev + '@' + Math.round(a.currentTime * 100) / 100)));
        const origPlay = a.play.bind(a);
        a.play = () => origPlay().then(
          r => { rec.playResult = 'resolved'; return r; },
          e => { rec.playResult = 'REJECTED: ' + (e && e.name) + ' ' + (e && e.message); throw e; });
        return a;
      };
      // 追踪 TTS 回退
      const origSpeak = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = u => { window.__audioLog.push({ tts: true, text: u.text, lang: u.lang }); return origSpeak(u); };
    }, course);

    try {
      await page.goto(t.url, { waitUntil: 'networkidle', timeout: 45000 });
      // 等密码门/直接进
      await page.waitForTimeout(1500);
      // 点第一个级别
      await page.waitForSelector('.level', { timeout: 20000 });
      await page.locator('.level').first().click();
      await page.waitForSelector('.lesson-link', { timeout: 30000 });
      await page.locator('.lesson-link').first().click();
      await page.waitForSelector('#playAll', { timeout: 15000 });
      const nItems = await page.locator('.study-card').count();
      // 点顺序播放，观察 8 秒
      await page.locator('#playAll').click();
      await page.waitForTimeout(8000);
      const st = await page.evaluate(() => ({
        status: document.getElementById('status')?.textContent,
        audioLog: window.__audioLog,
        playingClass: document.querySelectorAll('.playing').length,
      }));
      console.log(`\n===== ${t.name} (${t.url}) =====`);
      console.log('本课 items:', nItems, '| 状态栏:', JSON.stringify(st.status));
      console.log('Audio 记录:', JSON.stringify(st.audioLog, null, 1).slice(0, 2500));
      if (logs.length) console.log('页面日志:', logs.slice(0, 15).join('\n'));
      else console.log('页面日志: (无 404/失败/异常)');
    } catch (e) {
      console.log(`\n===== ${t.name} 失败 =====\n` + e.message.split('\n')[0]);
      if (logs.length) console.log('页面日志:', logs.slice(0, 10).join('\n'));
    }
    await ctx.close();
  }
  await browser.close();
})();
