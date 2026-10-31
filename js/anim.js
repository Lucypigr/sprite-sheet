/* 由單張像素角色自動產生動畫影格 */
(function () {
  const SG = window.SG;

  SG.ANIMS = {
    idle: { label: '待機 idle', frames: 4, fps: 6, loop: true },
    walk: { label: '走路 walk', frames: 8, fps: 10, loop: true },
    run: { label: '跑步 run', frames: 6, fps: 14, loop: true },
    attack: { label: '攻擊 attack', frames: 6, fps: 14, loop: false },
    jump: { label: '跳躍 jump', frames: 6, fps: 10, loop: false },
    hurt: { label: '受傷 hurt', frames: 3, fps: 10, loop: false },
    death: { label: '死亡 death', frames: 7, fps: 10, loop: false },
    cast: { label: '施法 cast', frames: 6, fps: 10, loop: true },
  };

  // ---------- 簡易骨架：頭 / 軀幹 / 雙腿，各自旋轉位移，關節處平滑銜接 ----------
  // 姿勢參數（角度單位：弧度；正值＝朝面向方向）
  function pose(o) {
    return Object.assign({ dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, torso: 0, tsy: 1, hx: 0, hy: 0,
      L: { a: 0, lift: 0 }, R: { a: 0, lift: 0 }, front: 'R', flash: 0, tint: null, glow: 0, fx: null, ghost: null }, o);
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  // 在關鍵影格之間插值
  function keyframes(keys, t) {
    const n = keys.length - 1; const x = Math.max(0, Math.min(1, t)) * n; const i = Math.min(n - 1, Math.floor(x)); const k = x - i;
    const A = pose(keys[i]), B = pose(keys[i + 1]); const o = pose({});
    for (const f of ['dx', 'dy', 'sx', 'sy', 'rot', 'torso', 'tsy', 'hx', 'hy', 'glow']) o[f] = lerp(A[f], B[f], k);
    o.L = { a: lerp(A.L.a, B.L.a, k), lift: lerp(A.L.lift, B.L.lift, k) }; o.R = { a: lerp(A.R.a, B.R.a, k), lift: lerp(A.R.lift, B.R.lift, k) };
    const near = k < 0.5 ? A : B; o.front = near.front; o.flash = near.flash; o.tint = near.tint; o.fx = near.fx; o.ghost = near.ghost;
    return o;
  }

  function keyParams(name, i, n, h) {
    const A = Math.max(1, h / 24); // 位移幅度隨角色尺寸縮放（像素）
    const t = n > 1 ? i / (n - 1) : 0, ph = (i / n) * Math.PI * 2;
    switch (name) {
      case 'idle': {
        const s = Math.sin(ph);
        return pose({ tsy: 1 - 0.035 * (s * 0.5 + 0.5), hy: Math.round((s * 0.5 + 0.5) * A * 0.9), torso: 0.02 * Math.sin(ph + 0.8), dy: 0 });
      }
      case 'walk': case 'run': {
        const run = name === 'run'; const s = Math.sin(ph), c = Math.cos(ph);
        const legA = run ? 0.62 : 0.42, lift = (run ? 0.3 : 0.18) * h * 0.36;
        const bob = (run ? 1.6 : 1) * A;
        return pose({
          L: { a: s * legA, lift: Math.max(0, c) * lift }, R: { a: -s * legA, lift: Math.max(0, -c) * lift },
          front: s > 0 ? 'L' : 'R',
          dy: -Math.round(Math.abs(c) * bob),                         // 經過中間姿勢時身體最高
          torso: (run ? 0.2 : 0.06) + 0.04 * Math.sin(ph * 2),        // 前傾 + 隨步伐微晃
          hy: Math.round(Math.max(0, Math.sin(ph * 2 - 1.2)) * A * 0.8), // 頭部延遲（跟隨）
          sy: run ? 1 - 0.05 * Math.abs(s) : 1, sx: run ? 1 + 0.04 * Math.abs(s) : 1,
        });
      }
      case 'attack': {
        const keys = [
          {}, // 預備
          { torso: -0.28, dx: -2 * A, sy: 0.92, sx: 1.04, hx: -A, L: { a: -0.25, lift: 0 }, R: { a: 0.15, lift: 0 } }, // 蓄力：下蹲後仰
          { torso: 0.42, dx: 4 * A, sx: 1.16, sy: 0.96, hx: A, L: { a: -0.45, lift: 0 }, R: { a: 0.45, lift: 0 }, fx: { type: 'slash', stage: 1 }, ghost: 1 }, // 揮擊：拖影
          { torso: 0.36, dx: 4.5 * A, L: { a: -0.42, lift: 0 }, R: { a: 0.42, lift: 0 }, hx: A * 1.5, fx: { type: 'slash', stage: 2 } }, // 跟隨
          { torso: 0.2, dx: 3.5 * A, L: { a: -0.3, lift: 0 }, R: { a: 0.3, lift: 0 }, hx: A, fx: { type: 'slash', stage: 3 } },
          { torso: 0.05, dx: 1 * A, L: { a: -0.1, lift: 0 }, R: { a: 0.1, lift: 0 } }, // 收招
          {},
        ];
        const p = keyframes(keys, t);
        if (p.ghost) p.ghostPose = pose(keys[1]);
        return p;
      }
      case 'jump': return keyframes([
        { sy: 0.84, sx: 1.12, torso: 0.15, L: { a: 0.2, lift: 0 }, R: { a: -0.2, lift: 0 } },           // 下蹲
        { sy: 1.14, sx: 0.9, dy: -0.12 * h, torso: -0.05 },                                               // 起跳伸展
        { dy: -0.32 * h, L: { a: 0.35, lift: 0.35 * h * 0.36 }, R: { a: -0.1, lift: 0.15 * h * 0.36 }, torso: 0.08, hy: A }, // 收腿
        { dy: -0.36 * h, L: { a: 0.25, lift: 0.3 * h * 0.36 }, R: { a: 0, lift: 0.2 * h * 0.36 } },     // 最高點
        { dy: -0.18 * h, sy: 1.06, sx: 0.95, L: { a: 0.1, lift: 0 }, R: { a: -0.15, lift: 0 }, hy: -A },  // 下落
        { sy: 0.82, sx: 1.16, torso: 0.18, hy: A, L: { a: 0.22, lift: 0 }, R: { a: -0.22, lift: 0 } },   // 落地緩衝
        {},
      ], t);
      case 'hurt': return keyframes([
        { dx: -2 * A, torso: -0.3, hx: -A, hy: -A, flash: 1, L: { a: 0.15, lift: 0 }, R: { a: 0.1, lift: 0 } },
        { dx: -3 * A, torso: -0.2, hx: -A, tint: [230, 40, 60], L: { a: 0.1, lift: 0 }, R: { a: 0.05, lift: 0 } },
        { dx: -1 * A, torso: -0.05 },
      ], i / Math.max(1, n - 1));
      case 'death': {
        const p = keyframes([
          { flash: 1, torso: -0.2, hy: -A },
          { torso: 0.3, sy: 0.9, hy: A, L: { a: 0.3, lift: 0.1 * h }, R: { a: 0.2, lift: 0.1 * h } },  // 膝蓋一軟
          { rot: -0.5, torso: 0.1, dx: -A, sy: 0.92 },
          { rot: -1.2, dx: -2 * A, torso: -0.1 },
          { rot: -1.57, dx: -3 * A, dy: -A },                                                            // 倒地小反彈
          { rot: -1.57, dx: -3 * A },
        ], t);
        return p;
      }
      case 'cast': {
        const s = Math.sin(ph);
        return pose({ torso: -0.12 - 0.05 * s, dy: -Math.round((s * 0.5 + 0.5) * A), hy: -Math.round(Math.max(0, s) * A * 0.8), tsy: 1 + 0.03 * s,
          L: { a: 0.08, lift: 0 }, R: { a: -0.08, lift: 0 }, fx: { type: 'aura', t: i / n }, glow: 0.12 + 0.12 * (s * 0.5 + 0.5) });
      }
    }
    return pose({});
  }

  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

  // 依姿勢把底圖畫到一格（反向映射，每個輸出像素回推來源像素）
  function renderFrame(B, cw, ch, opt, p, f) {
    const { w, h } = B; const out = SG.img(cw, ch);
    const ox = Math.floor((cw - w) / 2), oy = ch - h - opt.margin;
    const hip = Math.round(h * opt.legStart), neck = Math.round(h * opt.neck);
    const px = opt.legCx, py = hip; const legLen = h - hip; const bend = Math.max(2, h * 0.14);
    const dx = Math.round(p.dx * f), dy = Math.round(p.dy);
    const get = (u, v) => {
      const x = Math.floor(u), y = Math.floor(v);
      if (x < 0 || y < 0 || x >= w || y >= h) return -1;
      const i = (y * w + x) * 4; return B.d[i + 3] ? i : -1;
    };
    const order = p.front === 'L' ? ['R', 'T', 'L'] : ['L', 'T', 'R']; // 後腿 → 軀幹 → 前腿
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      let u = x + 0.5 - ox - dx, v = y + 0.5 - oy - dy;
      if (p.rot) { const r = rot(u - w / 2, v - h, -p.rot * f); u = w / 2 + r[0]; v = h + r[1]; }
      u = (u - w / 2) / p.sx + w / 2; v = (v - h) / p.sy + h;
      const got = {};
      // 軀幹（含頭）：繞髖關節旋轉，越遠離關節旋轉越完整
      {
        let du = u - px, dv = v - py; const rr = Math.hypot(du, dv);
        [du, dv] = rot(du, dv, -p.torso * f * smooth(rr / bend));
        dv = dv / p.tsy;
        let tu = px + du, tv = py + dv;
        if (tv < neck + 2) { const k = smooth((neck + 2 - tv) / 3); tu -= p.hx * f * k; tv -= p.hy * k; }
        const i = get(tu, tv);
        if (i >= 0) { const sx = (i / 4) % w; if (tv < hip || sx < opt.legX0 || sx >= opt.legX1) got.T = i; }
      }
      // 雙腿：繞髖關節擺動，抬腿時等比縮短
      for (const side of ['L', 'R']) {
        const P = p[side]; let du = u - px, dv = v - py; const rr = Math.hypot(du, dv);
        [du, dv] = rot(du, dv, P.a * f * smooth(rr / bend));
        const lift = Math.min(P.lift, legLen * 0.6); const sv = py + dv * legLen / Math.max(1, legLen - lift);
        if (sv < hip) continue;
        const i = get(px + du, sv); if (i < 0) continue;
        const sx = (i / 4) % w; if (sx < opt.legX0 || sx >= opt.legX1) continue;
        if ((side === 'L') === (sx < opt.legCx)) got[side] = i;
      }
      let src = -1; for (const k of order) if (got[k] !== undefined) src = got[k];
      if (src < 0) continue;
      const o = (y * cw + x) * 4;
      let c = [B.d[src], B.d[src + 1], B.d[src + 2]];
      if (p.flash) c = [255, 255, 255];
      else if (p.tint) c = SG.mix(c, p.tint, 0.55);
      else if (p.glow) c = SG.mix(c, opt.accent, p.glow);
      out.d[o] = c[0]; out.d[o + 1] = c[1]; out.d[o + 2] = c[2]; out.d[o + 3] = 255;
    }
    return { img: out, ox: ox + dx, oy: oy + dy, torso: p.torso * f };
  }

  // 殘影：用特效色的棋盤格畫出上一個姿勢的剪影
  function addGhost(im, ghost, color) {
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      const i = (y * im.w + x) * 4; if (im.d[i + 3] || !ghost.d[i + 3] || (x + y) % 2) continue;
      im.d[i] = color[0]; im.d[i + 1] = color[1]; im.d[i + 2] = color[2]; im.d[i + 3] = 255;
    }
  }

  function put(im, x, y, c) {
    x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= im.w || y >= im.h) return;
    const i = (y * im.w + x) * 4; im.d[i] = c[0]; im.d[i + 1] = c[1]; im.d[i + 2] = c[2]; im.d[i + 3] = 255;
  }

  // 攻擊刀光 / 施法光點
  function drawFx(im, B, fr, p, opt, f, i, n) {
    if (!p.fx) return;
    const acc = opt.accent; const light = SG.shade(acc, 0.6);
    const cx = fr.ox + B.w / 2 + (fr.torso || 0) * B.h * 0.3, cy = fr.oy + B.h * 0.5;
    if (p.fx.type === 'slash') {
      const R = B.h * 0.7; const st = p.fx.stage;
      const a0 = -100 * Math.PI / 180, span = 200 * Math.PI / 180;
      const head = st === 1 ? 0.45 : st === 2 ? 1 : 1, tail = st === 1 ? 0 : st === 2 ? 0.2 : 0.75;
      for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
        const dx = (x + 0.5 - cx) * f, dy = y + 0.5 - cy; const r = Math.hypot(dx, dy);
        let a = Math.atan2(dy, dx); const t = (a - a0) / span; if (t < tail || t > head) continue;
        const k = (t - tail) / Math.max(0.01, head - tail); const thick = 1 + k * Math.max(1.5, B.h * 0.12) * (st === 3 ? 0.5 : 1);
        if (r > R || r < R - thick) continue;
        put(im, x, y, r > R - 1.2 ? [255, 255, 255] : (k > 0.5 ? light : acc));
      }
    } else if (p.fx.type === 'aura') {
      const r = SG.rng(99); const t = p.fx.t;
      for (let k = 0; k < 10; k++) {
        const bx = r() * (B.w + 6) - 3 + fr.ox, ph = (r() + t) % 1, by = fr.oy + B.h - ph * (B.h + 4);
        const c = ph < 0.5 ? light : acc;
        put(im, bx, by, c); if (k % 3 === 0 && ph > 0.2 && ph < 0.7) { put(im, bx - 1, by, c); put(im, bx + 1, by, c); put(im, bx, by - 1, c); put(im, bx, by + 1, c); put(im, bx, by, [255, 255, 255]); }
      }
    }
  }

  // 產生所有動畫
  SG.buildCharacterSheet = function (B, cfg) {
    const f = cfg.facing === 'left' ? -1 : 1;
    // 腿部分割中心：以下半身不透明像素的平均 x 計
    let sx = 0, cnt = 0; const hip = Math.round(B.h * cfg.legStart);
    for (let y = hip; y < B.h; y++) for (let x = 0; x < B.w; x++) if (B.d[(y * B.w + x) * 4 + 3]) { sx += x + 0.5; cnt++; }
    const legCx = cnt ? sx / cnt : B.w / 2;
    // 腿部欄位範圍：以腳底附近幾列的像素決定，手、盾牌、披風下緣不會被當成腿
    let lx0 = B.w, lx1 = -1; const footRows = Math.max(2, Math.round(B.h * 0.12));
    for (let y = B.h - footRows; y < B.h; y++) for (let x = 0; x < B.w; x++) if (B.d[(y * B.w + x) * 4 + 3]) { lx0 = Math.min(lx0, x); lx1 = Math.max(lx1, x); }
    if (lx1 < 0) { lx0 = 0; lx1 = B.w - 1; }
    const margin = 1;
    let cw = cfg.cellW, ch = cfg.cellH;
    if (!cw || !ch) {
      const need = Math.max(B.w + 8, cfg.anims.includes('death') ? B.h + 6 : 0, cfg.anims.includes('attack') ? B.w + B.h * 1.2 + 8 : 0);
      const s = Math.ceil(Math.max(need, B.h * 1.3 + 2) / 8) * 8;
      cw = ch = s;
    }
    const opt = { margin, legStart: cfg.legStart, legCx, legX0: lx0 - 0.5, legX1: lx1 + 1.5, accent: cfg.accent, neck: cfg.legStart * 0.45 };
    const outlineColor = cfg.outlineColor;
    const rows = [];
    const dirs = cfg.mirror ? [['right', 1], ['left', -1]] : [[null, 1]];
    for (const [dirName, flip] of dirs) {
      for (const name of cfg.anims) {
        const def = SG.ANIMS[name]; const n = cfg.frames[name] || def.frames; const frames = [];
        for (let i = 0; i < n; i++) {
          const p = keyParams(name, i, n, B.h);
          const fr = renderFrame(B, cw, ch, opt, p, f);
          let im = SG.outline(fr.img, cfg.outline, outlineColor, false);
          if (p.ghostPose) addGhost(im, renderFrame(B, cw, ch, opt, p.ghostPose, f).img, SG.shade(cfg.accent, -0.15));
          drawFx(im, B, fr, p, opt, f, i, n);
          if (flip < 0) im = SG.flipX(im);
          frames.push(im);
        }
        const baseFacing = f > 0 ? 'right' : 'left';
        let animName = name;
        if (dirName) animName = name + '_' + (flip > 0 ? baseFacing : (baseFacing === 'right' ? 'left' : 'right'));
        rows.push({ name: animName, frames, fps: cfg.fps[name] || def.fps, loop: def.loop });
      }
    }
    return SG.packRows(rows, cw, ch);
  };

  // 把多列動畫拼成一張表
  SG.packRows = function (rows, cw, ch) {
    const cols = Math.max(...rows.map((r) => r.frames.length));
    const sheet = SG.img(cols * cw, rows.length * ch);
    rows.forEach((r, ri) => r.frames.forEach((fr, fi) => SG.blit(sheet, fr, fi * cw, ri * ch)));
    return { sheet, cw, ch, rows: rows.map((r, ri) => ({ name: r.name, fps: r.fps, loop: r.loop, row: ri, count: r.frames.length, frames: r.frames })) };
  };
})();
