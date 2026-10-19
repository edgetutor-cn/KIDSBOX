// Kids Box 课前预习 · Service Worker
// 把已拉过的音频/图片/数据缓存到本地，隔天或再次打开直接秒出（跨会话持久）。
const CACHE = 'kidsbox-v1';
const ASSET_PREFIXES = ['kb_audio/', 'kb_img/', 'data/'];

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
  // 清理旧版本缓存
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const rel = url.pathname; // 形如 /KIDSBOX/kb_audio/...
  const isAsset = ASSET_PREFIXES.some(p => rel.includes('/' + p) || rel.endsWith(p));
  if (e.request.method !== 'GET' || !isAsset) return;
  // 同源或 jsDelivr 镜像的资产都走缓存优先
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request);
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res && res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      const cached = await cache.match(e.request);
      return cached || Response.error();
    }
  })());
});
