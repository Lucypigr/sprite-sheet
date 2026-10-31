/* 共用工具：亂數、顏色、調色盤、影像處理 */
(function () {
  const SG = (window.SG = window.SG || {});

  // ---------- 亂數 ----------
  SG.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    const r = function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + r() * (b - a);
    r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    return r;
  };
  SG.hashStr = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // ---------- 顏色 ----------
  SG.hex = function (h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  SG.toHex = (c) => '#' + c.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  SG.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  SG.shade = function (c, amt) {
    // amt<0 變暗（略偏冷色），amt>0 變亮（略偏暖色）—— 像素美術常用的色相偏移
    if (amt < 0) { const t = -amt; return SG.mix(c, [c[0] * 0.35, c[1] * 0.3, c[2] * 0.45 + 20], t); }
    return SG.mix(c, [255, 250, 225], amt);
  };
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  SG.oklab = function (r, g, b) {
    const lr = lin(r), lg = lin(g), lb = lin(b);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  SG.lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

  // ---------- 調色盤 ----------
  const P = (s) => s.split(' ').map(SG.hex);
  SG.PALETTES = {
    auto: { name: '自動（從圖片萃取）', colors: null },
    none: { name: '不限制（保留原色）', colors: null },
    endesga32: { name: 'Endesga 32', colors: P('be4a2f d77643 ead4aa e4a672 b86f50 733e39 3e2731 a22633 e43b44 f77622 feae34 fee761 63c74d 3e8948 265c42 193c3e 124e89 0099db 2ce8f5 ffffff c0cbdc 8b9bb4 5a6988 3a4466 262b44 181425 ff0044 68386c b55088 f6757a e8b796 c28569') },
    pico8: { name: 'PICO-8', colors: P('000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa') },
    sweetie16: { name: 'Sweetie 16', colors: P('1a1c2c 5d275d b13e53 ef7d57 ffcd75 a7f070 38b764 257179 29366f 3b5dc9 41a6f6 73eff7 f4f4f4 94b0c2 566c86 333c57') },
    db16: { name: 'DawnBringer 16', colors: P('140c1c 442434 30346d 4e4a4e 854c30 346524 d04648 757161 597dce d27d2c 8595a1 6daa2c d2aa99 6dc2ca dad45e deeed6') },
    nes: { name: 'NES 風格', colors: P('000000 fcfcfc bcbcbc 7c7c7c a4e4fc 3cbcfc 0078f8 0000fc b8b8f8 6888fc 0058f8 0000bc d8b8f8 9878f8 6844fc 4428bc f8b8f8 f878f8 d800cc 940084 f8a4c0 f85898 e40058 a80020 f0d0b0 f87858 f83800 a81000 fce0a8 fca044 e45c10 881400 f8d878 f8b800 ac7c00 503000 d8f878 b8f818 00b800 007800 b8f8b8 58d854 00a800 006800 b8f8d8 58f898 00a844 005800 00fcfc 00e8d8 008888 004058') },
    gameboy: { name: 'Game Boy', colors: P('0f380f 306230 8bac0f 9bbc0f') },
    onebit: { name: '1-bit 黑白', colors: P('181425 f4f4f4') },
  };

  // ---------- 影像（RGBA 緩衝）----------
  SG.img = function (w, h) { return { w, h, d: new Uint8ClampedArray(w * h * 4) }; };
  SG.clone = (a) => ({ w: a.w, h: a.h, d: new Uint8ClampedArray(a.d) });
  SG.fromCanvasSource = function (src, maxSide) {
    let w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    const k = maxSide && Math.max(w, h) > maxSide ? maxSide / Math.max(w, h) : 1;
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h);
    const id = x.getImageData(0, 0, w, h);
    return { w, h, d: id.data };
  };
  SG.toCanvas = function (im, scale, canvas) {
    scale = scale || 1;
    const c = canvas || document.createElement('canvas');
    c.width = im.w * scale; c.height = im.h * scale;
    const x = c.getContext('2d');
    const t = document.createElement('canvas'); t.width = im.w; t.height = im.h;
    t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(im.d), im.w, im.h), 0, 0);
    x.imageSmoothingEnabled = false; x.clearRect(0, 0, c.width, c.height);
    x.drawImage(t, 0, 0, c.width, c.height);
    return c;
  };
  SG.blit = function (dst, src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const dx = x + ox, dy = y + oy;
      if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
      const si = (y * src.w + x) * 4; if (src.d[si + 3] === 0) continue;
      const di = (dy * dst.w + dx) * 4;
      dst.d[di] = src.d[si]; dst.d[di + 1] = src.d[si + 1]; dst.d[di + 2] = src.d[si + 2]; dst.d[di + 3] = src.d[si + 3];
    }
  };
  SG.flipX = function (im) {
    const o = SG.img(im.w, im.h);
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      const s = (y * im.w + x) * 4, d = (y * im.w + (im.w - 1 - x)) * 4;
      for (let k = 0; k < 4; k++) o.d[d + k] = im.d[s + k];
    }
    return o;
  };

  // 去背：從邊界進行 flood fill，移除與邊角顏色相近的區域
  SG.removeBackground = function (im, tol) {
    const { w, h, d } = im; const out = SG.clone(im); const o = out.d;
    // 已有透明背景就略過
    const corners = [0, w - 1, (h - 1) * w, h * w - 1];
    if (corners.some((i) => d[i * 4 + 3] < 200)) return out;
    const refs = corners.map((i) => SG.oklab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]));
    const t = (tol / 100) * 0.35; const t2 = t * t;
    const near = (i) => {
      const L = SG.oklab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      for (const r of refs) { const a = L[0] - r[0], b = L[1] - r[1], c = L[2] - r[2]; if (a * a + b * b + c * c < t2) return true; }
      return false;
    };
    const seen = new Uint8Array(w * h); const stack = [];
    for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
    for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
    while (stack.length) {
      const i = stack.pop(); if (seen[i]) continue; seen[i] = 1;
      if (!near(i)) continue;
      o[i * 4 + 3] = 0;
      const x = i % w, y = (i / w) | 0;
      if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
    }
    return out;
  };

  // 只保留主要的連通區塊（去除 AI 圖的雜訊 / 小陰影）
  SG.keepMainBlobs = function (im, ratio) {
    const { w, h } = im; const d = im.d; const lab = new Int32Array(w * h).fill(-1); const sizes = [];
    for (let i = 0; i < w * h; i++) {
      if (lab[i] >= 0 || d[i * 4 + 3] < 128) continue;
      const id = sizes.length; let n = 0; const st = [i]; lab[i] = id;
      while (st.length) {
        const j = st.pop(); n++; const x = j % w, y = (j / w) | 0;
        const nb = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1];
        for (const k of nb) if (k >= 0 && lab[k] < 0 && d[k * 4 + 3] >= 128) { lab[k] = id; st.push(k); }
      }
      sizes.push(n);
    }
    if (!sizes.length) return im;
    const max = Math.max(...sizes); const out = SG.clone(im);
    for (let i = 0; i < w * h; i++) if (lab[i] < 0 || sizes[lab[i]] < max * ratio) out.d[i * 4 + 3] = 0;
    return out;
  };

  SG.bbox = function (im, th) {
    th = th == null ? 16 : th;
    let x0 = im.w, y0 = im.h, x1 = -1, y1 = -1;
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (im.d[(y * im.w + x) * 4 + 3] > th) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return null;
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  SG.crop = function (im, b) {
    const o = SG.img(b.w, b.h);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const s = ((y + b.y) * im.w + x + b.x) * 4, t = (y * b.w + x) * 4;
      for (let k = 0; k < 4; k++) o.d[t + k] = im.d[s + k];
    }
    return o;
  };

  // 面積平均縮圖（alpha 加權），之後二值化 alpha
  SG.downscale = function (im, tw, th, alphaCut) {
    const o = SG.img(tw, th); const sx = im.w / tw, sy = im.h / th;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const xa = x * sx, xb = (x + 1) * sx, ya = y * sy, yb = (y + 1) * sy;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = Math.floor(ya); yy < Math.ceil(yb); yy++) for (let xx = Math.floor(xa); xx < Math.ceil(xb); xx++) {
        if (xx >= im.w || yy >= im.h) continue;
        const wx = Math.min(xb, xx + 1) - Math.max(xa, xx), wy = Math.min(yb, yy + 1) - Math.max(ya, yy);
        const wgt = wx * wy; const i = (yy * im.w + xx) * 4; const al = im.d[i + 3] / 255;
        r += im.d[i] * al * wgt; g += im.d[i + 1] * al * wgt; b += im.d[i + 2] * al * wgt; a += al * wgt; n += wgt;
      }
      const i = (y * tw + x) * 4;
      if (a > 0) { o.d[i] = r / a; o.d[i + 1] = g / a; o.d[i + 2] = b / a; }
      o.d[i + 3] = n > 0 && a / n >= alphaCut ? 255 : 0;
    }
    return o;
  };

  SG.adjust = function (im, sat, con, bri) {
    const o = SG.clone(im); const d = o.d;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      let r = d[i], g = d[i + 1], b = d[i + 2]; const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      r = (r - 128) * con + 128 + bri; g = (g - 128) * con + 128 + bri; b = (b - 128) * con + 128 + bri;
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    return o;
  };

  // k-means（OKLab）自動萃取調色盤
  SG.extractPalette = function (im, k, seed) {
    const pts = []; const d = im.d;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 127) pts.push([d[i], d[i + 1], d[i + 2]]);
    if (!pts.length) return [[0, 0, 0]];
    const r = SG.rng(seed || 7);
    let sample = pts; if (pts.length > 6000) { sample = []; for (let i = 0; i < 6000; i++) sample.push(pts[Math.floor(r() * pts.length)]); }
    const L = sample.map((p) => SG.oklab(p[0], p[1], p[2]));
    const cent = [L[Math.floor(r() * L.length)]];
    const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    while (cent.length < Math.min(k, L.length)) { // k-means++
      const ds = L.map((p) => Math.min(...cent.map((c) => dist(p, c)))); const tot = ds.reduce((a, b) => a + b, 0);
      if (tot <= 0) break; let t = r() * tot, j = 0; while (t > ds[j] && j < ds.length - 1) { t -= ds[j]; j++; } cent.push(L[j]);
    }
    const asg = new Int32Array(L.length);
    for (let it = 0; it < 12; it++) {
      for (let i = 0; i < L.length; i++) { let best = 0, bd = 1e9; for (let c = 0; c < cent.length; c++) { const v = dist(L[i], cent[c]); if (v < bd) { bd = v; best = c; } } asg[i] = best; }
      const acc = cent.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < L.length; i++) { const a = acc[asg[i]]; const p = sample[i]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; }
      for (let c = 0; c < cent.length; c++) if (acc[c][3]) { const a = acc[c]; cent[c] = SG.oklab(a[0] / a[3], a[1] / a[3], a[2] / a[3]); cent[c].rgb = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; }
    }
    return cent.filter((c) => c.rgb).map((c) => c.rgb.map(Math.round));
  };

  SG.quantize = function (im, pal, dither) {
    const o = SG.clone(im); const d = o.d; const PL = pal.map((c) => SG.oklab(c[0], c[1], c[2]));
    const cache = new Map();
    const nearest = (r, g, b) => {
      r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
      const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      let v = cache.get(key); if (v !== undefined) return v;
      const L = SG.oklab(r, g, b); let best = 0, bd = 1e9;
      for (let i = 0; i < PL.length; i++) { const p = PL[i]; const dd = (L[0] - p[0]) ** 2 + (L[1] - p[1]) ** 2 + (L[2] - p[2]) ** 2; if (dd < bd) { bd = dd; best = i; } }
      cache.set(key, best); return best;
    };
    const err = dither ? new Float32Array(im.w * im.h * 3) : null;
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      const p = y * im.w + x, i = p * 4; if (!d[i + 3]) continue;
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (err) { r += err[p * 3]; g += err[p * 3 + 1]; b += err[p * 3 + 2]; }
      const c = pal[nearest(r, g, b)];
      if (err) {
        const er = (r - c[0]) * 0.75, eg = (g - c[1]) * 0.75, eb = (b - c[2]) * 0.75;
        const add = (xx, yy, f) => { if (xx < 0 || xx >= im.w || yy >= im.h) return; const q = (yy * im.w + xx) * 3; err[q] += er * f; err[q + 1] += eg * f; err[q + 2] += eb * f; };
        add(x + 1, y, 7 / 16); add(x - 1, y + 1, 3 / 16); add(x, y + 1, 5 / 16); add(x + 1, y + 1, 1 / 16);
      }
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    return o;
  };

  // 移除孤立雜點
  SG.cleanOrphans = function (im) {
    const o = SG.clone(im); const { w, h, d } = im;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (!d[i + 3]) continue;
      let n = 0, same = 0; const cnt = {};
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = (yy * w + xx) * 4; if (!d[j + 3]) continue; n++;
        const key = d[j] + ',' + d[j + 1] + ',' + d[j + 2]; cnt[key] = (cnt[key] || 0) + 1;
        if (d[j] === d[i] && d[j + 1] === d[i + 1] && d[j + 2] === d[i + 2]) same++;
      }
      if (n <= 1) { o.d[i + 3] = 0; continue; }
      if (same === 0 && n >= 6) { // 孤立異色點 -> 改成鄰居最多的顏色
        let bk = null, bv = 0; for (const k in cnt) if (cnt[k] > bv) { bv = cnt[k]; bk = k; }
        const c = bk.split(',').map(Number); o.d[i] = c[0]; o.d[i + 1] = c[1]; o.d[i + 2] = c[2];
      }
    }
    return o;
  };

  // 外框：mode = 'dark' 單一暗色 / 'shade' 依鄰色自動加深
  SG.outline = function (im, mode, color, diagonal) {
    if (mode === 'none') return im;
    const o = SG.clone(im); const { w, h, d } = im;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (d[i + 3]) continue;
      let src = -1;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]; if (diagonal) nb.push([1, 1], [-1, 1], [1, -1], [-1, -1]);
      for (const [dx, dy] of nb) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = (yy * w + xx) * 4; if (d[j + 3]) { src = j; break; } }
      if (src < 0) continue;
      const c = mode === 'shade' ? SG.shade([d[src], d[src + 1], d[src + 2]], -0.7) : color;
      o.d[i] = c[0]; o.d[i + 1] = c[1]; o.d[i + 2] = c[2]; o.d[i + 3] = 255;
    }
    return o;
  };

  SG.darkest = (pal) => pal.reduce((a, b) => (SG.lum(b) < SG.lum(a) ? b : a), pal[0]);

  // 週期性 value noise（可無縫拼接）
  SG.periodicNoise = function (seed, period) {
    const r = SG.rng(seed); const N = period; const g = new Float32Array(N * N); for (let i = 0; i < g.length; i++) g[i] = r();
    const sm = (t) => t * t * (3 - 2 * t);
    return function (x, y) {
      x = ((x % N) + N) % N; y = ((y % N) + N) % N;
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0);
      const x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
      const a = g[y0 * N + x0], b = g[y0 * N + x1], c = g[y1 * N + x0], e = g[y1 * N + x1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy;
    };
  };
  SG.BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
})();
