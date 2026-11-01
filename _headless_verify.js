const { chromium } = require('playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function testSite(browser, url, course) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.addInitScript((course) => {
    const k = course === 'KidsBox' ? 'edge_gate_kidsbox_v1' : 'edge_gate_powerup_v1';
    localStorage.setItem(k, '1');
  }, course);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('button.level', { timeout: 15000 });
  const levelCount = await page.$$eval('button.level', els => els.length);

  await page.click('button.level');
  await page.waitForSelector('#unit', { timeout: 15000 });
  const unitCount = await page.$$eval('#unit option', els => els.length);
  const lessonCount = await page.$$eval('.lesson-link', els => els.length);

  await page.click('.lesson-link');
  await page.waitForSelector('#study .study-card, #study .empty', { timeout: 15000 });
  const wordsCards = await page.$$eval('#study .study-card', els => els.length);

  await page.click('#sentences');
  await page.waitForTimeout(400);
  const sentCards = await page.$$eval('#study .study-card', els => els.length);

  await page.click('#reference');
  await page.waitForTimeout(400);
  const refPages = await page.$$eval('#study .page', els => els.length);

  // 音频可达性：从 data 里取第一个带 a 的 chip，HEAD 其音频
  const audioCheck = await page.evaluate(async () => {
    const r = await fetch('data/index.json'); const idx = await r.json();
    const lvl = idx[0].level;
    const d = await (await fetch(`data/${lvl}.json`)).json();
    let apath = null;
    for (const u of d.units) for (const le of u.lessons) for (const s of le.slides || [])
      for (const c of s.chips || []) if (c.a) { apath = c.a; break; }
    if (!apath) return 'no-audio-in-data';
    const res = await fetch(apath, { method: 'HEAD' });
    return res.ok ? ('OK ' + res.status + ' ' + apath) : ('FAIL ' + res.status + ' ' + apath);
  });

  await ctx.close();
  return { course, levelCount, unitCount, lessonCount, wordsCards, sentCards, refPages, audioCheck, errors };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const kb = await testSite(browser, 'http://127.0.0.1:8131/', 'KidsBox');
  const pu = await testSite(browser, 'http://127.0.0.1:8132/', 'PowerUp');
  console.log(JSON.stringify({ kb, pu }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
