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

  SG.aiGenerate = function (prompt, seed, size) {
    size = size || 512;
    let key = ''; try { key = localStorage.getItem('pf-pollinations-key') || ''; } catch (e) {}
    const q = `width=${size}&height=${size}&seed=${seed}&nologo=true&model=flux&enhance=false`;
    // 有免費 API Key（enter.pollinations.ai 申請）時走新版端點：較少限流、無浮水印
    const url = key
      ? `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${q}&key=${encodeURIComponent(key)}`
      : `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${q}`;
    return new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => reject(new Error('逾時，AI 伺服器忙碌中，請稍後再試')), 120000);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('AI 生成失敗（可能是網路或伺服器限流），請稍後再試或換一個種子')); };
      img.src = url;
    });
  };
})();
