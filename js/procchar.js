/* 離線程序生成角色（可從描述文字解析關鍵字） */
(function () {
  const SG = window.SG;
  const COLORS = {
    '紅': 'c8323c', '赤': 'c8323c', red: 'c8323c', '藍': '3b5dc9', blue: '3b5dc9', '青': '2a9d8f', cyan: '2ce8f5',
    '綠': '3e8948', green: '3e8948', '黃': 'f2c14e', yellow: 'f2c14e', '金': 'e8b13a', gold: 'e8b13a',
    '紫': '7b3fa0', purple: '7b3fa0', '黑': '2b2b3a', black: '2b2b3a', '白': 'e8e8f0', white: 'e8e8f0',
    '粉': 'f08fb8', pink: 'f08fb8', '橘': 'f07a2a', '橙': 'f07a2a', orange: 'f07a2a', '棕': '7a4a2a', '褐': '7a4a2a', brown: '7a4a2a',
    '灰': '8b9bb4', gray: '8b9bb4', grey: '8b9bb4', '銀': 'c0cbdc', silver: 'c0cbdc',
  };
  const SKINS = ['f5c9a0', 'e8b796', 'c28569', '8a5a3c', 'ffd9b8'];

  SG.parseDesc = function (desc, seed) {
    const s = (desc || '').toLowerCase(); const r = SG.rng(seed);
    const has = (...k) => k.some((w) => s.includes(w));
    const cfg = {
      kind: 'human', hair: 'short', hat: 'none', weapon: 'none', shield: false, cape: false, robe: false,
      skin: SG.hex(r.pick(SKINS)), hairC: SG.hex(r.pick(['5a3a22', '2b2b3a', 'e8b13a', 'c8323c', '8b9bb4', 'f08fb8'])),
      outfit: SG.hex(r.pick(['3b5dc9', '3e8948', 'c8323c', '7b3fa0', '7a4a2a'])), pants: SG.hex(r.pick(['3a4466', '5a3a22', '262b44'])),
      metal: SG.hex('c0cbdc'), accent: SG.hex(r.pick(['feae34', '2ce8f5', 'f6757a'])), eyes: SG.hex('181425'),
    };
    if (has('史萊姆', 'slime', '果凍')) cfg.kind = 'slime';
    else if (has('怪物', 'monster', '惡魔', 'demon', '生物', 'creature', '外星', 'alien')) cfg.kind = 'monster';
    else if (has('骷髏', 'skeleton', '不死', 'undead')) { cfg.kind = 'human'; cfg.skin = SG.hex('e8e8f0'); cfg.eyes = SG.hex('181425'); cfg.skeleton = true; }
    if (has('騎士', '戰士', 'knight', 'warrior', '士兵', 'soldier', '聖騎')) { cfg.hat = 'helmet'; cfg.weapon = 'sword'; cfg.shield = true; }
    if (has('法師', '巫師', '魔法', 'mage', 'wizard', 'witch', '女巫', '術士')) { cfg.hat = 'wizard'; cfg.weapon = 'staff'; cfg.robe = true; }
    if (has('盜賊', '刺客', 'rogue', 'thief', 'assassin', '忍者', 'ninja')) { cfg.hat = 'hood'; cfg.weapon = 'dagger'; cfg.cape = true; }
    if (has('弓', 'archer', 'ranger', '獵人', 'hunter')) { cfg.hat = 'hood'; cfg.weapon = 'bow'; }
    if (has('牧師', '祭司', 'priest', 'cleric', '僧侶')) { cfg.robe = true; cfg.weapon = 'staff'; }
    if (has('劍', 'sword')) cfg.weapon = 'sword';
    if (has('斧', 'axe')) cfg.weapon = 'axe';
    if (has('杖', 'staff')) cfg.weapon = 'staff';
    if (has('盾', 'shield')) cfg.shield = true;
    if (has('斗篷', '披風', 'cape', 'cloak')) cfg.cape = true;
    if (has('長髮', 'long hair')) cfg.hair = 'long';
    if (has('刺蝟', '刺刺', 'spiky')) cfg.hair = 'spiky';
    if (has('光頭', 'bald')) cfg.hair = 'none';
    if (has('帽', 'hat') && cfg.hat === 'none') cfg.hat = 'wizard';
    if (has('頭盔', 'helmet')) cfg.hat = 'helmet';
    if (has('兜帽', 'hood')) cfg.hat = 'hood';
    // 顏色 + 部位
    const parts = { '髮': 'hairC', hair: 'hairC', '頭髮': 'hairC', '衣': 'outfit', '袍': 'outfit', '甲': 'outfit', '裝': 'outfit', shirt: 'outfit', armor: 'outfit', robe: 'outfit', '褲': 'pants', pants: 'pants', '眼': 'accent', eye: 'accent', '皮膚': 'skin', skin: 'skin' };
    let first = true;
    const re = /(紅|赤|藍|青|綠|黃|金|紫|黑|白|粉|橘|橙|棕|褐|灰|銀|red|blue|cyan|green|yellow|gold|purple|black|white|pink|orange|brown|gr[ae]y|silver)\s*(?:色)?\s*(的)?\s*([^\s,，、。]{0,3})/g;
    let m;
    while ((m = re.exec(s))) {
      const col = SG.hex(COLORS[m[1]]); let target = null;
      for (const k in parts) if (m[3] && m[3].startsWith(k)) { target = parts[k]; break; }
      if (!target) { for (const k in parts) if (m[3] && m[3].includes(k)) { target = parts[k]; break; } }
      if (!target) target = first ? 'outfit' : 'accent';
      cfg[target] = col; first = false;
    }
    return cfg;
  };

  function canvas(w, h) {
    const im = SG.img(w, h);
    im.rect = (x, y, rw, rh, c) => { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) im.px(i, j, c); };
    im.px = (x, y, c) => { if (x < 0 || y < 0 || x >= w || y >= h || !c) return; const k = (y * w + x) * 4; im.d[k] = c[0]; im.d[k + 1] = c[1]; im.d[k + 2] = c[2]; im.d[k + 3] = 255; };
    im.clear = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; im.d[(y * w + x) * 4 + 3] = 0; };
    return im;
  }

  // 自動打光：左上亮、右下暗
  function autoShade(im) {
    const o = SG.clone(im); const { w, h, d } = im;
    const same = (a, b) => d[a] === d[b] && d[a + 1] === d[b + 1] && d[a + 2] === d[b + 2] && d[b + 3];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (!d[i + 3]) continue; const c = [d[i], d[i + 1], d[i + 2]];
      const R = x < w - 1 ? i + 4 : -1, D = y < h - 1 ? i + w * 4 : -1, L = x > 0 ? i - 4 : -1, U = y > 0 ? i - w * 4 : -1;
      let nc = c;
      if (R < 0 || !same(i, R) || D < 0 || !same(i, D)) nc = SG.shade(c, -0.28);
      else if (L < 0 || !same(i, L) || U < 0 || !same(i, U)) nc = SG.shade(c, 0.22);
      o.d[i] = nc[0]; o.d[i + 1] = nc[1]; o.d[i + 2] = nc[2];
    }
    return o;
  }

  function human(c, r) {
    const W = 20, H = 28; const im = canvas(W, H);
    const X = 4; // 左側預留給盾牌
    const boots = SG.shade(c.pants, -0.35), belt = SG.shade(c.outfit, -0.45);
    // 披風（在身體後面）
    if (c.cape) { const cc = SG.shade(c.outfit, -0.25); im.rect(X + 0, 13, 12, 10, cc); }
    // 腿
    im.rect(X + 3, 21, 2, 5, c.pants); im.rect(X + 7, 21, 2, 5, c.pants);
    im.rect(X + 3, 25, 2, 2, boots); im.rect(X + 7, 25, 2, 2, boots); im.px(X + 2, 26, boots); im.px(X + 9, 26, boots);
    // 身體
    if (c.robe) { im.rect(X + 2, 14, 8, 11, c.outfit); im.rect(X + 1, 21, 10, 4, c.outfit); }
    else im.rect(X + 2, 14, 8, 7, c.outfit);
    im.rect(X + 2, 19, 8, 1, belt); im.px(X + 6, 19, c.accent);
    // 手臂
    im.rect(X + 1, 14, 1, 5, SG.shade(c.outfit, -0.15)); im.rect(X + 10, 14, 1, 5, SG.shade(c.outfit, -0.15));
    im.px(X + 1, 19, c.skin); im.px(X + 10, 19, c.skin);
    // 頭
    im.rect(X + 2, 5, 8, 8, c.skin); im.rect(X + 3, 13, 6, 1, c.skin);
    im.clear(X + 2, 5); im.clear(X + 9, 5);
    im.px(X + 4, 9, c.eyes); im.px(X + 4, 10, c.eyes); im.px(X + 7, 9, c.eyes); im.px(X + 7, 10, c.eyes);
    if (c.skeleton) { im.px(X + 5, 12, c.eyes); im.px(X + 6, 12, c.eyes); }
    else { im.px(X + 3, 11, SG.mix(c.skin, [240, 120, 120], 0.35)); im.px(X + 8, 11, SG.mix(c.skin, [240, 120, 120], 0.35)); }
    // 頭髮
    const hc = c.hairC;
    if (c.hair !== 'none' && c.hat !== 'helmet' && c.hat !== 'hood') {
      im.rect(X + 2, 4, 8, 3, hc); im.rect(X + 1, 5, 1, 4, hc); im.rect(X + 10, 5, 1, 4, hc); im.px(X + 3, 7, hc); im.px(X + 8, 7, hc);
      if (c.hair === 'long') { im.rect(X + 1, 9, 1, 7, hc); im.rect(X + 10, 9, 1, 7, hc); }
      if (c.hair === 'spiky') { im.px(X + 3, 3, hc); im.px(X + 5, 2, hc); im.px(X + 5, 3, hc); im.px(X + 8, 3, hc); im.px(X + 7, 2, hc); im.px(X + 1, 4, hc); im.px(X + 10, 4, hc); }
    }
    if (c.hat === 'helmet') {
      const m = c.metal; im.rect(X + 1, 3, 10, 4, m); im.rect(X + 1, 7, 1, 5, m); im.rect(X + 10, 7, 1, 5, m); im.rect(X + 2, 7, 8, 1, SG.shade(m, -0.3));
      im.rect(X + 5, 1, 2, 2, c.accent);
    } else if (c.hat === 'wizard') {
      const hc2 = SG.shade(c.outfit, -0.1); im.rect(X + 0, 6, 12, 1, hc2); im.rect(X + 2, 4, 8, 2, hc2); im.rect(X + 3, 2, 6, 2, hc2); im.rect(X + 5, 0, 3, 2, hc2); im.px(X + 8, 0, hc2);
      im.rect(X + 2, 5, 8, 1, c.accent);
    } else if (c.hat === 'hood') {
      const hd = SG.shade(c.outfit, -0.2); im.rect(X + 2, 3, 8, 3, hd); im.rect(X + 1, 4, 1, 10, hd); im.rect(X + 10, 4, 1, 10, hd); im.rect(X + 2, 6, 1, 2, hd); im.rect(X + 9, 6, 1, 2, hd);
      im.rect(X + 3, 2, 6, 1, hd);
    }
    // 武器
    const wx = X + 11;
    if (c.weapon === 'sword') { im.rect(wx, 8, 1, 10, c.metal); im.px(wx, 7, SG.shade(c.metal, 0.4)); im.rect(wx - 1, 18, 3, 1, c.accent); im.px(wx, 19, SG.hex('7a4a2a')); }
    if (c.weapon === 'dagger') { im.rect(wx, 15, 1, 4, c.metal); im.rect(wx - 1, 19, 3, 1, c.accent); }
    if (c.weapon === 'axe') { im.rect(wx, 9, 1, 12, SG.hex('7a4a2a')); im.rect(wx + 1, 9, 2, 4, c.metal); im.px(wx + 3, 10, c.metal); im.px(wx + 3, 11, c.metal); }
    if (c.weapon === 'staff') { im.rect(wx, 6, 1, 20, SG.hex('7a4a2a')); im.rect(wx - 1, 3, 3, 3, c.accent); im.px(wx, 2, SG.shade(c.accent, 0.5)); }
    if (c.weapon === 'bow') { const b = SG.hex('a0642a'); for (let j = 0; j < 12; j++) { const dx = Math.round(Math.sin((j / 11) * Math.PI) * 2); im.px(wx + dx, 9 + j, b); } im.rect(wx, 9, 1, 12, SG.hex('e8e8f0')); }
    if (c.shield) { const sc = c.metal; im.rect(X - 3, 14, 4, 6, sc); im.rect(X - 2, 20, 2, 1, sc); im.rect(X - 2, 15, 2, 4, c.accent); }
    return autoShade(im);
  }

  function slime(c, r) {
    const W = 18, H = 14; const im = canvas(W, H); const col = c.outfit;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - W / 2) / (W / 2), ny = (y + 0.5 - H) / H;
      if (nx * nx + ny * ny * (ny < -0.5 ? 1.15 : 1) <= 1 && y > 1) im.px(x, y, col);
    }
    const out = autoShade(im);
    const p = (x, y, cc) => { const k = (y * W + x) * 4; out.d[k] = cc[0]; out.d[k + 1] = cc[1]; out.d[k + 2] = cc[2]; out.d[k + 3] = 255; };
    p(5, 5, [255, 255, 255]); p(6, 5, [255, 255, 255]); p(5, 6, [255, 255, 255]);
    p(7, 8, c.eyes); p(7, 9, c.eyes); p(11, 8, c.eyes); p(11, 9, c.eyes);
    return out;
  }

  // 對稱隨機怪物（Bollinger 風格遮罩）
  function monster(c, r) {
    const hw = 7, H = 16; const W = hw * 2; const im = canvas(W, H);
    const pal = [c.outfit, SG.shade(c.outfit, 0.25), c.accent];
    const mask = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < hw; x++) {
      const edge = x === 0 || y === 0 || y === H - 1 ? 0.15 : 0.6;
      const body = y > 3 && y < H - 3 && x > 2 ? 0.95 : edge;
      mask.push(r() < body ? 1 : 0);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < hw; x++) if (mask[y * hw + x]) {
      const cc = r() < 0.15 ? pal[1] : pal[0];
      im.px(hw + x, y, cc); im.px(hw - 1 - x, y, cc);
    }
    const out = autoShade(SG.keepMainBlobs(im, 0.3));
    const ey = r.int(4, 7), ex = r.int(1, 3);
    for (const x of [hw + ex, hw - 1 - ex]) { const k = (ey * W + x) * 4; out.d[k] = 255; out.d[k + 1] = 255; out.d[k + 2] = 255; out.d[k + 3] = 255; const k2 = ((ey + 1) * W + x) * 4; out.d[k2] = c.eyes[0]; out.d[k2 + 1] = c.eyes[1]; out.d[k2 + 2] = c.eyes[2]; out.d[k2 + 3] = 255; }
    return out;
  }

  SG.proceduralCharacter = function (desc, seed) {
    const cfg = SG.parseDesc(desc, seed); const r = SG.rng(seed * 13 + 5);
    const im = cfg.kind === 'slime' ? slime(cfg, r) : cfg.kind === 'monster' ? monster(cfg, r) : human(cfg, r);
    const b = SG.bbox(im, 0); return { img: b ? SG.crop(im, b) : im, cfg };
  };
})();
