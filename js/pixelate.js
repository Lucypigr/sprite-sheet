/* 高品質像素化流程 */
(function () {
  const SG = window.SG;

  // 去背後去除殘留的背景色毛邊
  SG.defringe = function (orig, im, tol, passes) {
    const { w, h } = im; let cur = SG.clone(im);
    const d0 = orig.d; const corners = [0, w - 1, (h - 1) * w, h * w - 1];
    const refs = corners.map((i) => SG.oklab(d0[i * 4], d0[i * 4 + 1], d0[i * 4 + 2]));
    const t = (tol / 100) * 0.35 * 2.2; const t2 = t * t;
    for (let p = 0; p < passes; p++) {
      const d = cur.d; const nx = SG.clone(cur);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!d[i * 4 + 3]) continue;
        const edge = (x > 0 && !d[(i - 1) * 4 + 3]) || (x < w - 1 && !d[(i + 1) * 4 + 3]) || (y > 0 && !d[(i - w) * 4 + 3]) || (y < h - 1 && !d[(i + w) * 4 + 3]);
        if (!edge) continue;
        const L = SG.oklab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
        for (const r of refs) { if ((L[0] - r[0]) ** 2 + (L[1] - r[1]) ** 2 + (L[2] - r[2]) ** 2 < t2) { nx.d[i * 4 + 3] = 0; break; } }
      }
      cur = nx;
    }
    return cur;
  };

  // 輕微銳化（縮圖前保留臉部、紋路細節）
  SG.sharpen = function (im, amt) {
    const o = SG.clone(im); const { w, h, d } = im;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4; if (!d[i + 3]) continue;
      for (let c = 0; c < 3; c++) {
        const blur = (d[i - 4 + c] + d[i + 4 + c] + d[i - w * 4 + c] + d[i + w * 4 + c]) / 4;
        o.d[i + c] = d[i + c] + (d[i + c] - blur) * amt;
      }
    }
    return o;
  };

  // 主色區塊縮圖：每個輸出像素取區塊內「最具代表性」的調色盤顏色，而不是平均色
  function modeDownscale(mid, idx, pal, W, H, M, detail) {
    const PL = pal.map((c) => SG.oklab(c[0], c[1], c[2])[0]);
    const o = SG.img(W, H); const out = new Int16Array(W * H).fill(-1); const cnt = new Float32Array(pal.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      cnt.fill(0); let n = 0, Lsum = 0;
      for (let yy = 0; yy < M; yy++) for (let xx = 0; xx < M; xx++) {
        const j = (y * M + yy) * mid.w + x * M + xx; const k = idx[j]; if (k < 0) continue;
        // 區塊中心權重較高，邊緣較低（減少鋸齒）
        const cw = 1 + 0.5 * (1 - Math.abs(xx + 0.5 - M / 2) / (M / 2)) * (1 - Math.abs(yy + 0.5 - M / 2) / (M / 2));
        cnt[k] += cw; n++; Lsum += PL[k];
      }
      if (n < M * M * 0.42) continue;
      const Lavg = Lsum / n; let best = -1, bv = -1;
      for (let k = 0; k < pal.length; k++) {
        if (!cnt[k]) continue;
        // 細節偏好：與區塊平均亮度差越大的顏色（線條、眼睛、高光）越容易保留
        const v = cnt[k] * (1 + detail * 6 * Math.abs(PL[k] - Lavg));
        if (v > bv) { bv = v; best = k; }
      }
      out[y * W + x] = best; const c = pal[best]; const i = (y * W + x) * 4;
      o.d[i] = c[0]; o.d[i + 1] = c[1]; o.d[i + 2] = c[2]; o.d[i + 3] = 255;
    }
    return o;
  }

  function indexImage(im, pal) {
    const PL = pal.map((c) => SG.oklab(c[0], c[1], c[2])); const idx = new Int16Array(im.w * im.h).fill(-1); const cache = new Map();
    for (let p = 0; p < im.w * im.h; p++) {
      const i = p * 4; if (!im.d[i + 3]) continue;
      const r = im.d[i], g = im.d[i + 1], b = im.d[i + 2]; const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      let v = cache.get(key);
      if (v === undefined) { const L = SG.oklab(r, g, b); let bd = 1e9; v = 0; for (let k = 0; k < PL.length; k++) { const q = PL[k]; const dd = (L[0] - q[0]) ** 2 + (L[1] - q[1]) ** 2 + (L[2] - q[2]) ** 2; if (dd < bd) { bd = dd; v = k; } } cache.set(key, v); }
      idx[p] = v;
    }
    return idx;
  }

  // 平滑：多數決去除單點雜色、補洞
  function majorityClean(im, passes) {
    let cur = im;
    for (let p = 0; p < passes; p++) {
      const { w, h, d } = cur; const o = SG.clone(cur);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4; const cnt = new Map(); let opaque = 0, same = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = (yy * w + xx) * 4; if (!d[j + 3]) continue; opaque++;
          const key = (d[j] << 16) | (d[j + 1] << 8) | d[j + 2]; cnt.set(key, (cnt.get(key) || 0) + 1);
          if (d[i + 3] && d[j] === d[i] && d[j + 1] === d[i + 1] && d[j + 2] === d[i + 2]) same++;
        }
        if (!d[i + 3]) { // 被三面以上包圍的透明洞 -> 補色
          if (opaque >= 4) { let bk = 0, bv = 0; for (const [k, v] of cnt) if (v > bv) { bv = v; bk = k; } o.d[i] = bk >> 16; o.d[i + 1] = (bk >> 8) & 255; o.d[i + 2] = bk & 255; o.d[i + 3] = 255; }
          continue;
        }
        if (opaque <= 1) { o.d[i + 3] = 0; continue; } // 突出的單點
        if (same === 0) { // 四鄰都不同色 -> 若其中有一色佔 3 以上則採用
          let bk = 0, bv = 0; for (const [k, v] of cnt) if (v > bv) { bv = v; bk = k; }
          if (bv >= 3) { o.d[i] = bk >> 16; o.d[i + 1] = (bk >> 8) & 255; o.d[i + 2] = bk & 255; }
        }
      }
      cur = o;
    }
    return cur;
  }

  // 光影強化：左上受光、右下背光，再吸附回調色盤
  function rimShade(im, pal, amt) {
    const { w, h, d } = im; const o = SG.clone(im);
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (!d[i + 3]) continue; let c = [d[i], d[i + 1], d[i + 2]];
      if (!solid(x + 1, y) || !solid(x, y + 1)) c = SG.shade(c, -0.22 * amt);
      else if (!solid(x, y - 1) && solid(x, y + 1)) c = SG.shade(c, 0.12 * amt);
      else continue;
      o.d[i] = c[0]; o.d[i + 1] = c[1]; o.d[i + 2] = c[2];
    }
    return pal ? SG.quantize(o, pal, false) : o;
  }

  // 自動調色盤：k-means 後補上較暗與較亮的色階，讓陰影/高光有顏色可用
  function buildPalette(im, k) {
    const base = SG.extractPalette(im, k, 3, true);
    return base;
  }

  /*
    opts: height, method('detail'|'smooth'), colors, palette(null=自動 / 'none' / 顏色陣列), bg, tol, blobs,
          sat, con, detail(0..1), shading(bool), clean(bool), dither(bool)
  */
  SG.pixelate = function (src, o) {
    let im = src;
    if (o.bg) { const removed = SG.removeBackground(im, o.tol); im = removed === im ? im : SG.defringe(src, removed, o.tol, 2); }
    if (o.blobs) im = SG.keepMainBlobs(im, 0.06);
    const b = SG.bbox(im, 100); if (!b) return null;
    im = SG.crop(im, b);
    const H = o.height; const W = Math.max(1, Math.round(b.w * H / b.h));
    let pal = null, out;
    if (o.method === 'smooth') {
      out = SG.downscale(im, W, H, 0.4);
      out = SG.adjust(out, o.sat, o.con, 0);
      if (o.palette === null) pal = SG.extractPalette(out, o.colors, 3); else if (o.palette !== 'none') pal = o.palette;
      if (pal) out = SG.quantize(out, pal, o.dither);
      if (o.clean) out = SG.cleanOrphans(out);
    } else {
      const M = Math.max(2, Math.min(6, Math.floor(Math.min(im.h / H, im.w / W))));
      let mid = SG.downscale(im, W * M, H * M, 0.5);
      mid = SG.adjust(mid, o.sat, o.con, 0);
      mid = SG.sharpen(mid, 0.6);
      if (o.palette === null) pal = buildPalette(mid, o.colors); else if (o.palette !== 'none') pal = o.palette;
      const usePal = pal || SG.extractPalette(mid, 32, 3);
      const idx = indexImage(mid, usePal);
      out = modeDownscale(mid, idx, usePal, W, H, M, o.detail);
      if (o.dither && pal) { // 抖動模式：退回平均色 + Floyd–Steinberg
        out = SG.quantize(SG.adjust(SG.downscale(im, W, H, 0.42), o.sat, o.con, 0), pal, true);
      }
      if (o.clean) out = majorityClean(out, 1);
      if (!pal) pal = usePal;
    }
    if (o.shading) out = rimShade(out, pal, 1);
    const b2 = SG.bbox(out, 0); if (b2) out = SG.crop(out, b2);
    return { img: out, palette: pal };
  };
})();
