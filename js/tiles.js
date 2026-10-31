/* 程序生成地圖圖塊：無縫材質 + 角落自動拼接（Godot Terrain：Match Corners）+ 2.5D 等角 */
(function () {
  const SG = window.SG;
  const P = (s) => s.split(' ').map(SG.hex);

  // 每種地形：調色 + 材質函式 (x,y,T,ctx) -> 顏色
  SG.TERRAINS = {
    grass: { name: '草地', c: P('265c42 3e8948 63c74d 8fd65a'), edge: SG.hex('193c3e'), side: P('733e39 3e2731') },
    darkgrass: { name: '深林地面', c: P('193c3e 265c42 3e8948 4f7a3a'), edge: SG.hex('181425'), side: P('3e2731 262b44') },
    dirt: { name: '泥土', c: P('3e2731 733e39 8f563b b86f50'), edge: SG.hex('3e2731'), side: P('733e39 3e2731') },
    sand: { name: '沙地', c: P('c28569 e4a672 ead4aa f0e2bc'), edge: SG.hex('b86f50'), side: P('c28569 8f563b') },
    water: { name: '水', c: P('124e89 1f6fb0 0099db 73eff7'), edge: SG.hex('ffffff'), side: P('124e89 262b44') },
    deepwater: { name: '深水', c: P('193c3e 1a3a6c 124e89 3b5dc9'), edge: SG.hex('0099db'), side: P('193c3e 181425') },
    stone: { name: '石板路', c: P('3a4466 5a6988 8b9bb4 c0cbdc'), edge: SG.hex('262b44'), side: P('5a6988 3a4466') },
    snow: { name: '雪地', c: P('8b9bb4 c0cbdc e8eef8 ffffff'), edge: SG.hex('8b9bb4'), side: P('c0cbdc 8b9bb4') },
    lava: { name: '岩漿', c: P('3e2731 a22633 e43b44 f77622 feae34'), edge: SG.hex('fee761'), side: P('3e2731 181425') },
    brick: { name: '磚牆地板', c: P('3e2731 733e39 a22633 be4a2f'), edge: SG.hex('181425'), side: P('733e39 3e2731') },
    wood: { name: '木地板', c: P('3e2731 733e39 8f563b b86f50'), edge: SG.hex('3e2731'), side: P('733e39 3e2731') },
    cave: { name: '洞穴地面', c: P('181425 262b44 3a4466 4f4a5a'), edge: SG.hex('181425'), side: P('262b44 181425') },
  };

  // 週期性 Voronoi（石板）
  function voronoi(seed, T, cells) {
    const r = SG.rng(seed); const pts = []; for (let i = 0; i < cells; i++) pts.push([r() * T, r() * T, r()]);
    return (x, y) => {
      let d1 = 1e9, d2 = 1e9, id = 0;
      for (const p of pts) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const dx = x - (p[0] + ox * T), dy = y - (p[1] + oy * T); const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d2 = d1; d1 = d; id = p[2]; } else if (d < d2) d2 = d;
      }
      return { edge: d2 - d1, id };
    };
  }

  function makeTexture(key, T, seed) {
    const t = SG.TERRAINS[key]; const c = t.c; const N = SG.periodicNoise(seed, Math.max(4, T / 4)); const n2 = SG.periodicNoise(seed + 7, Math.max(2, T / 2));
    const s = T / 4; // 噪聲週期縮放
    const r = SG.rng(seed + 3); const tex = new Array(T * T);
    const vo = key === 'stone' || key === 'cave' ? voronoi(seed, T, key === 'stone' ? Math.max(3, Math.round(T * T / 40)) : 3) : null;
    const nz = (x, y) => N(x / 4, y / 4) * 0.65 + n2(x / 2, y / 2) * 0.35;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const v = nz(x, y); let col;
      switch (key) {
        case 'grass': case 'darkgrass': col = v < 0.32 ? c[0] : v < 0.62 ? c[1] : v < 0.8 ? c[2] : c[3]; break;
        case 'dirt': case 'sand': col = v < 0.25 ? c[0] : v < 0.55 ? c[1] : v < 0.85 ? c[2] : c[3]; if (key === 'dirt') col = v < 0.2 ? c[1] : v < 0.7 ? c[2] : c[3]; break;
        case 'water': case 'deepwater': { const w = Math.sin(((x + y * 0.5) / T) * Math.PI * 4 + v * 5); col = v < 0.35 ? c[0] : v < 0.7 ? c[1] : c[2]; if (w > 0.93 && v > 0.45) col = c[3]; break; }
        case 'stone': { const q = vo(x + 0.5, y + 0.5); col = q.edge < 1.1 ? c[0] : q.id < 0.33 ? c[1] : q.id < 0.8 ? c[2] : c[3]; if (q.edge >= 1.1 && q.edge < 2 && col !== c[0]) col = SG.shade(col, 0.12); break; }
        case 'cave': { const q = vo(x + 0.5, y + 0.5); col = v < 0.4 ? c[1] : v < 0.75 ? c[2] : c[3]; if (q.edge < 0.8) col = c[0]; break; }
        case 'snow': col = v < 0.3 ? c[1] : v < 0.75 ? c[2] : c[3]; break;
        case 'lava': { const cr = Math.abs(n2(x / 2, y / 2) - 0.5); col = cr < 0.05 ? c[4] : v < 0.35 ? c[0] : v < 0.6 ? c[1] : v < 0.85 ? c[2] : c[3]; break; }
        case 'brick': { const bh = Math.max(3, T / 4), bw = Math.max(6, T / 2); const row = Math.floor(y / bh); const off = row % 2 ? bw / 2 : 0;
          const mortar = y % bh === bh - 1 || (x + off) % bw === 0; col = mortar ? c[0] : v < 0.4 ? c[1] : v < 0.8 ? c[2] : c[3]; break; }
        case 'wood': { const ph = Math.max(3, T / 4); const row = Math.floor(y / ph); const seam = y % ph === ph - 1; const gx = (x + row * 7) % T;
          col = seam || (gx === 0 && row % 2) ? c[0] : (Math.sin(x * 0.9 + v * 6 + row) > 0.6 ? c[1] : v < 0.65 ? c[2] : c[3]); break; }
        default: col = c[1];
      }
      tex[y * T + x] = col;
    }
    // 散佈小細節
    const details = { grass: [c[3], 0.05], darkgrass: [c[3], 0.03], dirt: [c[0], 0.06], sand: [c[3], 0.04], snow: [c[3], 0.03], stone: null, water: null };
    const dt = details[key];
    if (dt) for (let i = 0; i < T * T * dt[1]; i++) { const x = r.int(0, T - 1), y = r.int(0, T - 1); tex[y * T + x] = dt[0]; if ((key === 'grass' || key === 'darkgrass') && y > 0) tex[(y - 1) * T + x] = c[2]; }
    return tex;
  }

  // 用 AI / 上傳的圖片當材質：縮成 T×T 並做無縫處理
  SG.textureFromImage = function (im, T, pal) {
    const b = Math.min(im.w, im.h); const sq = SG.crop(im, { x: Math.floor((im.w - b) / 2), y: Math.floor((im.h - b) / 2), w: b, h: b });
    let s = SG.downscale(sq, T, T, 0);
    for (let i = 3; i < s.d.length; i += 4) s.d[i] = 255;
    // 無縫：與平移半格的版本以十字遮罩混合
    const o = SG.clone(s);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const ex = Math.min(x, T - 1 - x) / (T / 2), ey = Math.min(y, T - 1 - y) / (T / 2); const wgt = Math.min(1, Math.min(ex, ey) * 2.2);
      const i = (y * T + x) * 4, j = (((y + T / 2) % T) * T + ((x + T / 2) % T)) * 4;
      for (let k = 0; k < 3; k++) o.d[i + k] = s.d[i + k] * wgt + s.d[j + k] * (1 - wgt);
    }
    // 先平移半格使混合縫落在中心以外
    const sh = SG.img(T, T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = (y * T + x) * 4, j = (((y + T / 2) % T) * T + ((x + T / 2) % T)) * 4; for (let k = 0; k < 4; k++) sh.d[i + k] = o.d[j + k]; }
    const q = pal ? SG.quantize(sh, pal, false) : sh; const tex = [];
    for (let i = 0; i < T * T; i++) tex.push([q.d[i * 4], q.d[i * 4 + 1], q.d[i * 4 + 2]]);
    return tex;
  };

  // corners: [TL, TR, BL, BR]，1 = 上層地形
  function cornerTile(T, corners, A, Bt, edgeN, opt, deco) {
    const im = SG.img(T, T); const m = new Uint8Array(T * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const u = (x + 0.5) / T, v = (y + 0.5) / T;
      const val = corners[0] * (1 - u) * (1 - v) + corners[1] * u * (1 - v) + corners[2] * (1 - u) * v + corners[3] * u * v;
      const nz = (edgeN(x, y) - 0.5) * opt.rough;
      m[y * T + x] = val + nz > 0.5 ? 1 : 0;
    }
    const at = (x, y) => (x < 0 || y < 0 || x >= T || y >= T ? null : m[y * T + x]);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const up = m[y * T + x]; let c = up ? A.tex[y * T + x] : Bt.tex[y * T + x];
      if (opt.border) {
        if (up) { // 上層邊緣
          const nb = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
          if (nb.some((q) => q === 0)) c = A.edge;
        } else if (opt.shadow && at(x, y - 1) === 1) c = SG.shade(c, -0.35); // 下層陰影
      }
      const i = (y * T + x) * 4; im.d[i] = c[0]; im.d[i + 1] = c[1]; im.d[i + 2] = c[2]; im.d[i + 3] = 255;
    }
    if (deco) deco(im, m);
    return im;
  }

  function decorate(im, T, kind, seed, terr) {
    const r = SG.rng(seed); const put = (x, y, c) => { if (x < 1 || y < 1 || x > T - 2 || y > T - 2) return; const i = (y * T + x) * 4; im.d[i] = c[0]; im.d[i + 1] = c[1]; im.d[i + 2] = c[2]; };
    const n = Math.max(1, Math.round(T / 8));
    for (let k = 0; k < n; k++) {
      const x = r.int(2, T - 3), y = r.int(2, T - 3);
      if (kind === 'grass' || kind === 'darkgrass') { const fc = r.pick([[246, 117, 122], [254, 231, 97], [255, 255, 255], [44, 232, 245]]); put(x, y, fc); put(x - 1, y, SG.shade(fc, -0.3)); put(x + 1, y, SG.shade(fc, -0.3)); put(x, y - 1, SG.shade(fc, -0.3)); put(x, y + 1, terr.c[0]); }
      else if (kind === 'water' || kind === 'deepwater') { put(x, y, terr.c[3]); put(x + 1, y, terr.c[3]); put(x - 1, y + 1, terr.c[2]); }
      else { const pc = terr.c[Math.min(terr.c.length - 1, 2)]; put(x, y, SG.shade(pc, 0.3)); put(x + 1, y, pc); put(x, y + 1, terr.c[0]); put(x + 1, y + 1, terr.c[0]); }
    }
  }

  // 正方形 -> 等角菱形 (+ 側面厚度)
  function toIso(sq, T, depth, sideA, sideB, topEdge) {
    const W = T * 2, H = T; const im = SG.img(W, H + depth);
    for (let y = 0; y < H + depth; y++) for (let x = 0; x < W; x++) {
      const a = (x + 0.5 - W / 2) / (W / 2);
      const b = (y + 0.5) / (H / 2);
      const u = (a + b) / 2, v = (b - a) / 2; let c = null;
      if (u >= 0 && u < 1 && v >= 0 && v < 1) {
        const sx = Math.min(T - 1, Math.floor(u * T)), sy = Math.min(T - 1, Math.floor(v * T)); const i = (sy * T + sx) * 4; c = [sq.d[i], sq.d[i + 1], sq.d[i + 2]];
      } else if (depth > 0) {
        // 菱形下緣之下 depth 範圍內為側面
        const edgeY = x < W / 2 ? H / 2 + (x + 0.5) / (W / 2) * (H / 2) : H / 2 + (W - x - 0.5) / (W / 2) * (H / 2);
        const yy = y + 0.5 - edgeY;
        if (yy > 0 && yy <= depth) {
          const left = x < W / 2; const base = yy < 2 ? topEdge : sideA;
          c = left ? base : SG.shade(base, -0.25); if (yy > depth * 0.6 && yy >= 3) c = left ? sideB : SG.shade(sideB, -0.25);
        }
      }
      if (!c) continue; const i = (y * W + x) * 4; im.d[i] = c[0]; im.d[i + 1] = c[1]; im.d[i + 2] = c[2]; im.d[i + 3] = 255;
    }
    return im;
  }

  SG.buildTileset = function (cfg) {
    const T = cfg.size; const seed = cfg.seed;
    const mk = (key, s, img) => ({ key, tex: img ? SG.textureFromImage(img, T, cfg.palette) : makeTexture(key, T, s), edge: SG.TERRAINS[key].edge, terr: SG.TERRAINS[key] });
    const A = mk(cfg.upper, seed, cfg.upperImg), Bt = mk(cfg.lower, seed + 101, cfg.lowerImg);
    if (cfg.palette) { for (const t of [A, Bt]) { t.tex = t.tex.map((c) => quant1(c, cfg.palette)); t.edge = quant1(t.edge, cfg.palette); } }
    const edgeN = SG.periodicNoise(seed + 55, Math.max(4, T / 2));
    const en = (x, y) => edgeN(x / 2, y / 2);
    const tiles = [];
    // 16 種角落組合：依常見排列（4x4）
    for (let idx = 0; idx < 16; idx++) {
      const c = [(idx >> 3) & 1, (idx >> 2) & 1, (idx >> 1) & 1, idx & 1];
      tiles.push({ corners: c, img: cornerTile(T, c, A, Bt, en, cfg) });
    }
    // 變化款（全上層 / 全下層，含裝飾）
    for (let v = 0; v < cfg.variants; v++) {
      tiles.push({ corners: [1, 1, 1, 1], variant: true, img: cornerTile(T, [1, 1, 1, 1], A, Bt, en, cfg, (im) => decorate(im, T, A.key, seed + v * 17, A.terr)) });
    }
    for (let v = 0; v < cfg.variants; v++) {
      tiles.push({ corners: [0, 0, 0, 0], variant: true, img: cornerTile(T, [0, 0, 0, 0], A, Bt, en, cfg, (im) => decorate(im, T, Bt.key, seed + 900 + v * 17, Bt.terr)) });
    }
    let tw = T, th = T, depth = 0;
    if (cfg.iso) {
      depth = cfg.depth; tw = T * 2; th = T + depth;
      const sA = cfg.palette ? Bt.terr.side.map((c) => quant1(c, cfg.palette)) : Bt.terr.side;
      for (const t of tiles) {
        const lowerTop = t.corners.reduce((a, b) => a + b, 0) >= 2 ? A.tex[0] : Bt.tex[0];
        t.img = toIso(t.img, T, depth, sA[0], sA[1], lowerTop);
      }
    }
    const cols = cfg.columns || 4; const rowsN = Math.ceil(tiles.length / cols);
    const sheet = SG.img(cols * tw, rowsN * th);
    tiles.forEach((t, i) => { t.x = i % cols; t.y = Math.floor(i / cols); SG.blit(sheet, t.img, t.x * tw, t.y * th); });
    return { sheet, tiles, tw, th, T, depth, iso: cfg.iso, upper: SG.TERRAINS[cfg.upper].name, lower: SG.TERRAINS[cfg.lower].name, upperColor: A.tex[0], lowerColor: Bt.tex[0] };
  };
  function quant1(c, pal) { const L = SG.oklab(c[0], c[1], c[2]); let best = pal[0], bd = 1e9; for (const p of pal) { const q = SG.oklab(p[0], p[1], p[2]); const d = (L[0] - q[0]) ** 2 + (L[1] - q[1]) ** 2 + (L[2] - q[2]) ** 2; if (d < bd) { bd = d; best = p; } } return best; }

  // 預覽用：以隨機地圖套用角落規則，驗證拼接
  SG.previewMap = function (ts, W, H, seed) {
    const r = SG.rng(seed); const n = SG.periodicNoise(seed + 9, 8);
    const grid = []; for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) grid.push(n(x / 2.2, y / 2.2) > 0.5 ? 1 : 0);
    const byKey = {}; ts.tiles.forEach((t) => { const k = t.corners.join(''); (byKey[k] = byKey[k] || []).push(t); });
    const tw = ts.tw, th = ts.th; let out;
    if (!ts.iso) {
      out = SG.img(W * tw, H * th);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = [grid[y * (W + 1) + x], grid[y * (W + 1) + x + 1], grid[(y + 1) * (W + 1) + x], grid[(y + 1) * (W + 1) + x + 1]];
        const list = byKey[c.join('')]; const t = list.length > 1 && r() < 0.35 ? r.pick(list) : list[0]; SG.blit(out, t.img, x * tw, y * th);
      }
    } else {
      const hw = tw / 2, hh = ts.T / 2; out = SG.img((W + H) * hw, (W + H) * hh + ts.depth + 2);
      for (let s = 0; s < W + H; s++) for (let x = 0; x < W; x++) { const y = s - x; if (y < 0 || y >= H) continue;
        const c = [grid[y * (W + 1) + x], grid[y * (W + 1) + x + 1], grid[(y + 1) * (W + 1) + x], grid[(y + 1) * (W + 1) + x + 1]];
        const list = byKey[c.join('')]; const t = list.length > 1 && r() < 0.35 ? r.pick(list) : list[0];
        SG.blit(out, t.img, (x - y) * hw + (H - 1) * hw, (x + y) * hh);
      }
    }
    return out;
  };
})();
