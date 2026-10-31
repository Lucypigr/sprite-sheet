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

  // 每個動畫的關鍵參數
  function keyParams(name, i, n, h, f) {
    const p = { dx: 0, dy: 0, sx: 1, sy: 1, shear: 0, rot: 0, breathe: 0, L: [0, 0], R: [0, 0], front: 'R', flash: 0, tint: null, fade: 0, fx: null };
    const A = Math.max(1, Math.round(h / 24)); // 動作幅度隨尺寸縮放
    const ph = (i / n) * Math.PI * 2;
    switch (name) {
      case 'idle': {
        const b = [0, 0, 1, 1, 1, 0, 0, 0];
        p.breathe = b[Math.floor((i / n) * 8)] * A; break;
      }
      case 'walk': case 'run': {
        const run = name === 'run'; const s = Math.sin(ph);
        const stride = (run ? 2 : 1.3) * A, lift = (run ? 2.2 : 1.4) * A;
        p.L = [Math.round(s * stride) * f, Math.round(Math.max(0, s) * lift)];
        p.R = [Math.round(-s * stride) * f, Math.round(Math.max(0, -s) * lift)];
        p.front = s > 0 ? 'L' : 'R';
        p.dy = -Math.round(Math.abs(Math.sin(ph)) * (run ? 1.5 : 0.8) * A) + (run ? 0 : 0);
        p.breathe = Math.abs(Math.cos(ph)) > 0.7 ? A * (run ? 1 : 0) : 0;
        if (run) p.shear = 0.14 * f;
        break;
      }
      case 'attack': {
        const k = [[-0.12, -1, 0], [-0.2, -2, 0], [0.22, 2, 1], [0.28, 3, 2], [0.14, 2, 3], [0.04, 1, 0], [0, 0, 0]];
        const q = k[Math.min(k.length - 1, Math.round((i / Math.max(1, n - 1)) * (k.length - 1)))];
        p.shear = q[0] * f; p.dx = q[1] * A * f; p.fx = q[2] ? { type: 'slash', stage: q[2] } : null;
        if (q[2] === 1) { p.sx = 1.05; p.sy = 0.96; }
        break;
      }
      case 'jump': {
        const k = [[1.15, 0.85, 0], [0.9, 1.12, -0.12], [0.95, 1.06, -0.3], [1, 1, -0.36], [0.96, 1.05, -0.22], [1.18, 0.84, 0], [1, 1, 0]];
        const q = k[Math.min(k.length - 1, Math.round((i / Math.max(1, n - 1)) * (k.length - 1)))];
        p.sx = q[0]; p.sy = q[1]; p.dy = Math.round(q[2] * h);
        if (q[2] < -0.25) { p.L = [0, A]; p.R = [0, A]; }
        break;
      }
      case 'hurt': {
        const k = [[-2, 1, null], [-3, 0, [230, 40, 60]], [-1, 0, null]];
        const q = k[Math.min(k.length - 1, Math.floor((i / n) * k.length))];
        p.dx = q[0] * A * f; p.flash = q[1]; p.tint = q[2]; p.shear = -0.1 * f; break;
      }
      case 'death': {
        const t = i / Math.max(1, n - 1);
        const ang = [0, 12, 30, 55, 80, 90, 90, 90]; const a = ang[Math.round(t * (ang.length - 1))];
        p.rot = (-a * Math.PI / 180) * f; p.dx = -Math.round(t * 3 * A) * f;
        if (i === 0) { p.flash = 1; }
        if (a >= 80 && t < 0.9) p.dy = -A; // 小反彈
        break;
      }
      case 'cast': {
        const s = Math.sin(ph);
        p.dy = -Math.round((s * 0.5 + 0.5) * A); p.breathe = s > 0 ? 0 : A;
        p.fx = { type: 'aura', t: i / n }; p.glow = 0.12 + 0.12 * (s * 0.5 + 0.5);
        break;
      }
    }
    return p;
  }

  // 依參數把底圖畫到一格
  function renderFrame(B, cw, ch, opt, p) {
    const { w, h } = B; const out = SG.img(cw, ch);
    const ox = Math.floor((cw - w) / 2), oy = ch - h - opt.margin;
    const hip = Math.round(h * opt.legStart), chest = Math.round(h * Math.min(opt.legStart, 0.55));
    const legCx = opt.legCx; const px = w / 2, py = h;
    const cos = Math.cos(-p.rot), sin = Math.sin(-p.rot);
    const get = (u, v) => {
      const x = Math.floor(u), y = Math.floor(v);
      if (x < 0 || y < 0 || x >= w || y >= h) return -1;
      const i = (y * w + x) * 4; return B.d[i + 3] ? i : -1;
    };
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      let u = x + 0.5 - ox - p.dx, v = y + 0.5 - oy - p.dy;
      if (p.rot) { const du = u - px, dv = v - py; u = px + du * cos - dv * sin; v = py + du * sin + dv * cos; }
      u = (u - px) / p.sx + px; v = (v - py) / p.sy + py;
      u -= p.shear * (h - v);
      let src = -1;
      if (v >= hip && (p.L[0] || p.L[1] || p.R[0] || p.R[1])) {
        const cand = [];
        const l = get(u - p.L[0], v + p.L[1]); if (l >= 0 && ((l / 4) % w) < legCx && Math.floor(v + p.L[1]) >= hip) cand.push(['L', l]);
        const r = get(u - p.R[0], v + p.R[1]); if (r >= 0 && ((r / 4) % w) >= legCx && Math.floor(v + p.R[1]) >= hip) cand.push(['R', r]);
        if (cand.length === 2) src = (cand[0][0] === p.front ? cand[0] : cand[1])[1];
        else if (cand.length) src = cand[0][1];
      } else if (v < chest && p.breathe) {
        src = get(u, v - p.breathe);
      } else src = get(u, v);
      if (src < 0) continue;
      const o = (y * cw + x) * 4;
      let c = [B.d[src], B.d[src + 1], B.d[src + 2]];
      if (p.flash) c = [255, 255, 255];
      else if (p.tint) c = SG.mix(c, p.tint, 0.55);
      else if (p.glow) c = SG.mix(c, opt.accent, p.glow);
      out.d[o] = c[0]; out.d[o + 1] = c[1]; out.d[o + 2] = c[2]; out.d[o + 3] = 255;
    }
    return { img: out, ox: ox + p.dx, oy: oy + p.dy };
  }

  function put(im, x, y, c) {
    x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= im.w || y >= im.h) return;
    const i = (y * im.w + x) * 4; im.d[i] = c[0]; im.d[i + 1] = c[1]; im.d[i + 2] = c[2]; im.d[i + 3] = 255;
  }

  // 攻擊刀光 / 施法光點
  function drawFx(im, B, fr, p, opt, f, i, n) {
    if (!p.fx) return;
    const acc = opt.accent; const light = SG.shade(acc, 0.6);
    const cx = fr.ox + B.w / 2, cy = fr.oy + B.h * 0.5;
    if (p.fx.type === 'slash') {
      const R = B.h * 0.62; const st = p.fx.stage;
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
    const margin = 1;
    let cw = cfg.cellW, ch = cfg.cellH;
    if (!cw || !ch) {
      const need = Math.max(B.w + 8, cfg.anims.includes('death') ? B.h + 6 : 0, cfg.anims.includes('attack') ? B.w + B.h * 0.7 : 0);
      const s = Math.ceil(Math.max(need, B.h * 1.3 + 2) / 8) * 8;
      cw = ch = s;
    }
    const opt = { margin, legStart: cfg.legStart, legCx, accent: cfg.accent };
    const outlineColor = cfg.outlineColor;
    const rows = [];
    const dirs = cfg.mirror ? [['right', 1], ['left', -1]] : [[null, 1]];
    for (const [dirName, flip] of dirs) {
      for (const name of cfg.anims) {
        const def = SG.ANIMS[name]; const n = cfg.frames[name] || def.frames; const frames = [];
        for (let i = 0; i < n; i++) {
          const p = keyParams(name, i, n, B.h, f);
          const fr = renderFrame(B, cw, ch, opt, p);
          let im = SG.outline(fr.img, cfg.outline, outlineColor, false);
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
