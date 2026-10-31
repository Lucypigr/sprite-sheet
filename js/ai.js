/* 免費 AI 圖片生成（Pollinations.ai，無需 API Key） */
(function () {
  const SG = window.SG;
  SG.STYLES = {
    snes: { name: '16-bit SNES RPG', p: '16-bit SNES era JRPG pixel art' },
    nes: { name: '8-bit NES 復古', p: '8-bit NES retro pixel art, very limited palette' },
    gba: { name: 'GBA 掌機風', p: 'Game Boy Advance style pixel art, bright colors' },
    modern: { name: '現代精緻像素', p: 'modern high quality indie game pixel art, detailed shading' },
    chibi: { name: 'Q 版可愛', p: 'cute chibi pixel art, big head small body' },
    dark: { name: '黑暗奇幻', p: 'dark fantasy gothic pixel art, moody colors' },
    cyber: { name: '賽博龐克', p: 'cyberpunk neon pixel art' },
    hd2d: { name: 'HD-2D / 2.5D', p: 'HD-2D octopath style pixel art sprite' },
  };
  SG.VIEWS = {
    side: { name: '側面（橫向卷軸）', p: 'side view, facing right, full body' },
    front: { name: '正面', p: 'front view, facing the viewer, full body' },
    topdown: { name: '俯視 3/4（RPG / 2.5D）', p: 'top-down 3/4 view RPG character, full body' },
    iso: { name: '等角 Isometric', p: 'isometric view, full body' },
  };

  SG.AiLimitError = class extends Error { constructor(m) { super(m); this.limit = true; } };

  // 偵測「Free limit reached」之類的提示卡片：大面積單一飽和色 + 少量文字
  function looksLikeNotice(img) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data; const cnt = new Map();
    for (let i = 0; i < d.length; i += 4) { const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4); cnt.set(k, (cnt.get(k) || 0) + 1); }
    let bk = 0, bv = 0; for (const [k, v] of cnt) if (v > bv) { bv = v; bk = k; }
    const r = (bk >> 8) * 16 + 8, g = ((bk >> 4) & 15) * 16 + 8, b = (bk & 15) * 16 + 8;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    return bv / 4096 > 0.55 && sat > 60;
  }

  SG.aiPrompt = function (kind, desc, style, view) {
    const st = (SG.STYLES[style] || SG.STYLES.snes).p;
    if (kind === 'character') {
      return `pixel art game sprite of ${desc}, single character, ${(SG.VIEWS[view] || SG.VIEWS.side).p}, ${st}, crisp clean pixels, bold dark outline, flat cel shading, centered, isolated on plain solid white background, no shadow, no text, no frame`;
    }
    if (kind === 'texture') {
      return `seamless tileable ${desc} ground texture, top-down view, ${st}, game tile, flat even lighting, fills entire image, no border, no text`;
    }
    return `${desc}, ${st}`;
  };

  SG.aiGenerate = async function (prompt, seed, size) {
    size = size || 512;
    let key = ''; try { key = localStorage.getItem('pf-pollinations-key') || ''; } catch (e) {}
    const q = `width=${size}&height=${size}&seed=${seed}&nologo=true&model=flux&enhance=false`;
    // 有免費 API Key（enter.pollinations.ai 申請）時走新版端點：較少限流、無浮水印
    const url = key
      ? `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${q}&key=${encodeURIComponent(key)}`
      : `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${q}`;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 120000);
    let res;
    try { res = await fetch(url, { signal: ctrl.signal }); }
    catch (e) { clearTimeout(timer); throw new Error(e.name === 'AbortError' ? '逾時：AI 伺服器忙碌中，請稍後再試' : 'AI 連線失敗，請檢查網路後再試'); }
    clearTimeout(timer);
    const ct = res.headers.get('content-type') || '';
    if (res.status === 401 || res.status === 403) throw new SG.AiLimitError('API Key 無效，請確認後重新貼上（或清空改用免費匿名模式）');
    if (res.status === 402 || res.status === 429 || res.headers.get('payment-required') || res.headers.get('retry-after')) throw new SG.AiLimitError('Pollinations 免費匿名額度已用完');
    if (!res.ok || !ct.startsWith('image/')) throw new Error(`AI 生成失敗（HTTP ${res.status}），請稍後再試`);
    const blob = await res.blob(); const src = URL.createObjectURL(blob);
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('AI 回傳的圖片無法讀取')); i.src = src; });
    if (looksLikeNotice(img)) throw new SG.AiLimitError('Pollinations 免費匿名額度已用完（伺服器回傳了提示卡片而不是圖片）');
    return img;
  };
})();
