/* 程序生成像素特效（VFX） */
(function () {
  const SG = window.SG;
  const P = (s) => s.split(' ').map(SG.hex);
  SG.RAMPS = {
    fire: { name: '火焰', c: P('3e2731 a22633 e43b44 f77622 feae34 fee761 ffffff') },
    ice: { name: '冰霜', c: P('193c3e 124e89 0099db 2ce8f5 a8f4ff ffffff') },
    poison: { name: '毒液', c: P('193c3e 265c42 3e8948 63c74d b6f05a f4ffc0') },
    arcane: { name: '魔法紫', c: P('262b44 68386c b55088 c86cff e8b0ff ffffff') },
    holy: { name: '聖光金', c: P('733e39 b86f50 feae34 fee761 fff6c8 ffffff') },
    electric: { name: '雷電', c: P('262b44 3a4466 41a6f6 73eff7 e8ffff ffffff') },
    smoke: { name: '煙霧', c: P('262b44 3a4466 5a6988 8b9bb4 c0cbdc') },
    blood: { name: '鮮血', c: P('3e2731 68182a a22633 e43b44 f6757a') },
    water: { name: '水花', c: P('124e89 3b5dc9 41a6f6 73eff7 ffffff') },
    shadow: { name: '暗影', c: P('181425 262b44 3e2731 68386c 8b3fbf') },
  };

  SG.VFX = {
    explosion: { name: '爆炸 Explosion', ramp: 'fire', frames: 10, loop: false },
    fire: { name: '火焰（循環）Fire', ramp: 'fire', frames: 8, loop: true },
    slash: { name: '斬擊 Slash', ramp: 'holy', frames: 6, loop: false },
    hit: { name: '打擊火花 Hit Spark', ramp: 'holy', frames: 5, loop: false },
    magic_circle: { name: '魔法陣（循環）Magic Circle', ramp: 'arcane', frames: 12, loop: true },
    lightning: { name: '閃電 Lightning', ramp: 'electric', frames: 8, loop: false },
    heal: { name: '治療光芒 Heal', ramp: 'poison', frames: 10, loop: true },
    ice_spikes: { name: '冰刺 Ice Spikes', ramp: 'ice', frames: 9, loop: false },
    portal: { name: '傳送門（循環）Portal', ramp: 'arcane', frames: 12, loop: true },
    shockwave: { name: '衝擊波 Shockwave', ramp: 'water', frames: 7, loop: false },
    smoke: { name: '煙霧 Smoke Puff', ramp: 'smoke', frames: 8, loop: false },
    projectile: { name: '飛彈/火球（循環）Projectile', ramp: 'fire', frames: 6, loop: true },
    sparkle: { name: '拾取閃光（循環）Sparkle', ramp: 'holy', frames: 8, loop: true },
    dust: { name: '落地塵土 Dust', ramp: 'smoke', frames: 6, loop: false },
    splash: { name: '水花 Splash', ramp: 'water', frames: 8, loop: false },
    blood: { name: '噴血 Blood', ramp: 'blood', frames: 7, loop: false },
  };

  function Buf(n) {
    const b = new Float32Array(n * n);
    const add = (x, y, v) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= n || y >= n) return; const i = y * n + x; b[i] = Math.min(1.2, b[i] + v); };
    const max = (x, y, v) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= n || y >= n) return; const i = y * n + x; if (v > b[i]) b[i] = v; };
    return {
      n, b, add, max,
      disc(cx, cy, r, v, soft, sy) {
        sy = sy || 1; if (v <= 0) return; if (r < 1) { max(cx, cy, v); return; }
        for (let y = Math.floor(cy - r * sy - 1); y <= cy + r * sy + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) / sy) / r; if (d > 1) continue;
          max(x, y, soft ? v * (1 - d * d * soft) : v);
        }
      },
      ring(cx, cy, r, w, v, sy) {
        sy = sy || 1;
        for (let y = Math.floor(cy - (r + w) * sy - 1); y <= cy + (r + w) * sy + 1; y++) for (let x = Math.floor(cx - r - w - 1); x <= cx + r + w + 1; x++) {
          const d = Math.abs(Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) / sy) - r); if (d > w / 2) continue; max(x, y, v * (1 - (d / (w / 2)) * 0.4));
        }
      },
      line(x0, y0, x1, y1, w, v0, v1) {
        v1 = v1 == null ? v0 : v1; const L = Math.hypot(x1 - x0, y1 - y0); const steps = Math.max(1, Math.ceil(L * 2));
        for (let s = 0; s <= steps; s++) { const t = s / steps; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; const v = v0 + (v1 - v0) * t; if (w <= 1) max(x, y, v); else this.disc(x, y, w / 2, v, 0); }
      },
      star(cx, cy, s, v) { this.line(cx - s, cy, cx + s, cy, 1, v * 0.7, v * 0.7); this.line(cx, cy - s, cx, cy + s, 1, v * 0.7); max(cx, cy, v); this.disc(cx, cy, Math.max(1, s * 0.3), v, 0); },
      tri(ax, ay, bx, by, cx, cy, v) {
        const minx = Math.floor(Math.min(ax, bx, cx)), maxx = Math.ceil(Math.max(ax, bx, cx)), miny = Math.floor(Math.min(ay, by, cy)), maxy = Math.ceil(Math.max(ay, by, cy));
        const e = (px, py, x0, y0, x1, y1) => (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
        for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
          const px = x + 0.5, py = y + 0.5; const a = e(px, py, ax, ay, bx, by), b = e(px, py, bx, by, cx, cy), c = e(px, py, cx, cy, ax, ay);
          if ((a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0)) max(x, y, v);
        }
      },
    };
  }

  const ease = (t) => 1 - Math.pow(1 - t, 3);

  // 每個特效：draw(buf, t[0..1), rng種子, 參數)
  const DRAW = {
    explosion(B, t, seed, o) {
      const n = B.n, c = n / 2, R = n * 0.45 * o.scale; const r = SG.rng(seed);
      if (t < 0.25) B.disc(c, c, R * (0.25 + t * 2.4), 1.15 - t, 0.5, o.sy);
      const N = 14 + Math.floor(o.density * 10);
      for (let i = 0; i < N; i++) {
        const a = r() * Math.PI * 2, sp = r.range(0.4, 1), sz = r.range(0.12, 0.25) * R;
        const d = ease(t) * R * sp; const life = 1 - t * r.range(0.9, 1.3);
        if (life <= 0) continue;
        B.disc(c + Math.cos(a) * d, c + Math.sin(a) * d * o.sy - t * R * 0.3, sz * (0.6 + life * 0.8), life * 0.95, 0.6);
      }
      if (t > 0.3) for (let i = 0; i < 8; i++) { const a = r() * Math.PI * 2, d = R * (0.3 + t * 0.6); B.disc(c + Math.cos(a) * d * 0.6, c + Math.sin(a) * d * 0.6 * o.sy - t * R * 0.4, R * 0.18 * (1.2 - t), 0.18 * (1 - t) + 0.05, 0.2); }
    },
    fire(B, t, seed, o) {
      const n = B.n, c = n / 2, H = n * 0.8 * o.scale; const r = SG.rng(seed); const base = n * 0.9;
      const N = 18 + Math.floor(o.density * 14);
      for (let i = 0; i < N; i++) {
        const ph = (r() + t) % 1, x0 = c + r.range(-1, 1) * n * 0.18 * o.scale, wob = r.range(0, 6.28);
        const y = base - ph * H, x = x0 + Math.sin(ph * 6 + wob + t * 6.28) * n * 0.04 - (x0 - c) * ph * 0.7;
        B.disc(x, y, n * 0.12 * o.scale * (1 - ph * 0.85), 1.05 - ph * 0.95, 0.5);
      }
      B.disc(c, base - n * 0.08, n * 0.16 * o.scale, 1.1, 0.4, 0.6);
    },
    slash(B, t, seed, o) {
      const n = B.n, c = n / 2, R = n * 0.42 * o.scale; const a0 = -2.4, span = 3.6;
      const head = Math.min(1, t * 2.2), tail = Math.max(0, t * 1.6 - 0.35);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - c, dy = (y + 0.5 - c) / o.sy; const rr = Math.hypot(dx, dy); let a = Math.atan2(dy, dx);
        let k = (a - a0) / span; if (k < 0) k += (Math.PI * 2) / span; if (k < tail || k > head) continue;
        const q = (k - tail) / Math.max(0.01, head - tail); const th = R * 0.35 * Math.sin(q * Math.PI) * (1 - tail * 0.6) + 1;
        if (rr > R || rr < R - th) continue; B.max(x, y, 0.35 + q * 0.75 + (rr > R - 1.5 ? 0.2 : 0));
      }
    },
    hit(B, t, seed, o) {
      const n = B.n, c = n / 2, R = n * 0.45 * o.scale; const r = SG.rng(seed); const N = 6 + Math.floor(o.density * 6);
      if (t < 0.4) B.disc(c, c, R * 0.35 * (1 - t * 1.5), 1.2, 0.3);
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + r.range(-0.3, 0.3), L = R * r.range(0.6, 1);
        const d0 = ease(t) * L * 0.6, d1 = Math.min(L, d0 + L * 0.5 * (1 - t));
        B.line(c + Math.cos(a) * d0, c + Math.sin(a) * d0 * o.sy, c + Math.cos(a) * d1, c + Math.sin(a) * d1 * o.sy, i % 2 ? 1 : 2, 1 - t * 0.6, 0.6 - t * 0.5);
      }
      if (t > 0.2) B.ring(c, c, R * ease(t), 1.5, 0.7 * (1 - t), o.sy);
    },
    magic_circle(B, t, seed, o) {
      const n = B.n, c = n / 2, R = n * 0.44 * o.scale, sy = o.sy; const pulse = 0.8 + 0.2 * Math.sin(t * Math.PI * 2);
      B.ring(c, c, R, 1.5, 0.9 * pulse, sy); B.ring(c, c, R * 0.78, 1, 0.75, sy); B.ring(c, c, R * 0.3, 1, 0.8 * pulse, sy);
      const rot = t * Math.PI * 2 / 3; // 120° 旋轉＝三角形對稱，可完美循環
      const pts = []; for (let i = 0; i < 6; i++) { const a = rot + (i / 6) * Math.PI * 2; pts.push([c + Math.cos(a) * R * 0.78, c + Math.sin(a) * R * 0.78 * sy]); }
      for (let i = 0; i < 6; i++) { const p = pts[i], q = pts[(i + 2) % 6]; B.line(p[0], p[1], q[0], q[1], 1, 0.7 * pulse); }
      for (let i = 0; i < 12; i++) { const a = -rot * 0.5 + (i / 12) * Math.PI * 2; const x = c + Math.cos(a) * R * 0.89, y = c + Math.sin(a) * R * 0.89 * sy; B.disc(x, y, 1, i % 3 === 0 ? 1.1 : 0.6, 0); }
      B.disc(c, c, R * 0.15, 0.5 * pulse + 0.3, 0.8, sy);
    },
    lightning(B, t, seed, o) {
      const n = B.n, f = Math.floor(t * 8); const r = SG.rng(seed + f * 31); const on = [1, 1, 0.4, 1, 0.8, 0.3, 0.6, 0.15][f] || 0;
      const draw = (x, y, x1, y1, w, v, depth) => {
        const seg = 7; let px = x, py = y;
        for (let i = 1; i <= seg; i++) { const k = i / seg; const nx = x + (x1 - x) * k + (i < seg ? r.range(-1, 1) * n * 0.1 * o.scale : 0); const ny = y + (y1 - y) * k; B.line(px, py, nx, ny, w, v); B.line(px, py, nx, ny, w + 2, v * 0.35);
          if (depth < 1 && r() < 0.25 * o.density + 0.1) draw(nx, ny, nx + r.range(-1, 1) * n * 0.3, ny + n * 0.25, 1, v * 0.7, depth + 1); px = nx; py = ny; }
      };
      if (on > 0.1) draw(n / 2 + r.range(-2, 2), 0, n / 2 + r.range(-2, 2), n * 0.92, 1, on, 0);
      if (f < 4) B.disc(n / 2, n * 0.92, n * 0.18 * (1 - f / 4), on, 0.4, 0.5);
    },
    heal(B, t, seed, o) {
      const n = B.n, c = n / 2; const r = SG.rng(seed); const N = 10 + Math.floor(o.density * 10);
      B.disc(c, n * 0.85, n * 0.35 * o.scale, 0.35 + 0.1 * Math.sin(t * 6.28), 0.9, 0.35);
      for (let i = 0; i < N; i++) {
        const ph = (r() + t) % 1, x = c + r.range(-1, 1) * n * 0.33 * o.scale, y = n * 0.9 - ph * n * 0.8; const v = Math.sin(ph * Math.PI);
        if (i % 3 === 0) { const s = Math.max(1, Math.round(n / 24)); B.line(x - s, y, x + s, y, 1, v * 1.1); B.line(x, y - s, x, y + s, 1, v * 1.1); }
        else B.max(x, y, v * 0.9);
      }
    },
    ice_spikes(B, t, seed, o) {
      const n = B.n, base = n * 0.9; const r = SG.rng(seed); const N = 5 + Math.floor(o.density * 3);
      const grow = Math.min(1, t * 3), fade = t > 0.6 ? (t - 0.6) / 0.4 : 0;
      for (let i = 0; i < N; i++) {
        const x = n * 0.5 + (i - (N - 1) / 2) * n * 0.14 * o.scale + r.range(-1, 1), hgt = n * r.range(0.35, 0.75) * o.scale * ease(Math.max(0, Math.min(1, grow * 1.4 - Math.abs(i - (N - 1) / 2) * 0.15)));
        const w = n * 0.06 * o.scale + 1; const lean = r.range(-0.15, 0.15) * hgt; if (hgt < 1) continue;
        const drop = fade * n * 0.2 * r.range(0.5, 1.2);
        if (fade > 0 && r() < fade * 1.2) { for (let k = 0; k < 3; k++) B.disc(x + r.range(-4, 4) * fade * 2, base - hgt * r() + drop, 1, 0.8 * (1 - fade), 0); continue; }
        B.tri(x - w, base, x + w, base, x + lean, base - hgt, 0.7 * (1 - fade * 0.7));
        B.line(x - w * 0.3, base - 1, x + lean * 0.9, base - hgt + 1, 1, 1.05 * (1 - fade * 0.7));
      }
      if (t < 0.3) B.disc(n / 2, base, n * 0.4 * o.scale * ease(t / 0.3), 0.5 * (1 - t / 0.3), 0.6, 0.3);
    },
    portal(B, t, seed, o) {
      const n = B.n, c = n / 2, R = n * 0.4 * o.scale; const r = SG.rng(seed); const sx = 0.65;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dx = (x + 0.5 - c) / sx, dy = y + 0.5 - c; const d = Math.hypot(dx, dy) / R; if (d > 1.05) continue;
        const a = Math.atan2(dy, dx); const sw = Math.sin(a * 3 + d * 8 - t * Math.PI * 2 * 3) * 0.5 + 0.5;
        B.max(x, y, d > 0.9 ? 0.95 : 0.15 + sw * 0.55 * d + (1 - d) * 0.15);
      }
      for (let i = 0; i < 10; i++) { const ph = (r() + t) % 1, a0 = r() * 6.28; const a = a0 + ph * 4, d = R * (1.3 - ph); B.max(c + Math.cos(a) * d * sx, c + Math.sin(a) * d, 1 - ph * 0.3); }
    },
    shockwave(B, t, seed, o) {
      const n = B.n, c = n / 2, R = n * 0.47 * o.scale; const e = ease(t);
      B.ring(c, c, R * e, Math.max(1, 4 * (1 - t)), 1.05 - t * 0.6, o.sy);
      if (t > 0.15) B.ring(c, c, R * e * 0.7, Math.max(1, 2 * (1 - t)), 0.55 - t * 0.5, o.sy);
      if (t < 0.25) B.disc(c, c, R * 0.25, 1 - t * 3, 0.5, o.sy);
    },
    smoke(B, t, seed, o) {
      const n = B.n, c = n / 2; const r = SG.rng(seed); const N = 7 + Math.floor(o.density * 5);
      for (let i = 0; i < N; i++) { const a = r() * 6.28, sp = r.range(0.2, 0.45) * n * o.scale; const d = ease(t) * sp; const rad = n * r.range(0.1, 0.18) * o.scale * (0.6 + t);
        B.disc(c + Math.cos(a) * d, c + Math.sin(a) * d * 0.6 - t * n * 0.15, rad * (1 - t * 0.4), 0.95 - t * 0.85 + r.range(0, 0.1), 0.7); }
    },
    projectile(B, t, seed, o) {
      const n = B.n, cy = n / 2, hx = n * 0.72; const r = SG.rng(seed);
      for (let i = 0; i < 14; i++) { const ph = (r() + t) % 1; const x = hx - ph * n * 0.6 * o.scale, y = cy + r.range(-1, 1) * n * 0.08 * (1 + ph); B.disc(x, y, n * 0.1 * o.scale * (1 - ph), 1 - ph * 0.9, 0.4); }
      B.disc(hx, cy, n * 0.16 * o.scale, 1.15, 0.45);
    },
    sparkle(B, t, seed, o) {
      const n = B.n, c = n / 2; const r = SG.rng(seed);
      const s = n * 0.32 * o.scale * (0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI))); B.star(c, c, s, 1.1);
      const s2 = s * 0.4; const a = t * Math.PI * 2; B.line(c - s2 * Math.cos(a + 0.78), c - s2 * Math.sin(a + 0.78), c + s2 * Math.cos(a + 0.78), c + s2 * Math.sin(a + 0.78), 1, 0.6);
      for (let i = 0; i < 4; i++) { const ph = (i / 4 + t) % 1; const ang = i * 1.7 + r() * 0.5; const d = n * 0.38 * o.scale; B.max(c + Math.cos(ang) * d, c + Math.sin(ang) * d, Math.sin(ph * Math.PI)); }
    },
    dust(B, t, seed, o) {
      const n = B.n, c = n / 2, base = n * 0.85; const r = SG.rng(seed);
      for (let side of [-1, 1]) for (let i = 0; i < 4 + o.density * 3; i++) {
        const sp = r.range(0.25, 0.48) * n * o.scale; const x = c + side * (2 + ease(t) * sp), y = base - Math.sin(Math.min(1, t * 1.5) * Math.PI) * r.range(1, 4) - i * 0.3;
        B.disc(x, y, n * 0.07 * o.scale * (1 + t) * r.range(0.7, 1.3), 0.8 - t * 0.7, 0.6);
      }
    },
    splash(B, t, seed, o) {
      const n = B.n, c = n / 2, base = n * 0.85; const r = SG.rng(seed); const N = 10 + o.density * 8;
      for (let i = 0; i < N; i++) { const vx = r.range(-1, 1) * n * 0.4 * o.scale, vy = r.range(0.6, 1.2) * n * 0.9 * o.scale; const x = c + vx * t, y = base - vy * t + vy * 1.3 * t * t; if (y > base + 1) continue; B.disc(x, y, Math.max(0.6, n * 0.04 * (1 - t * 0.5)), 1 - t * 0.6, 0); }
      B.ring(c, base, n * 0.4 * o.scale * ease(t), 1.5, 0.8 - t * 0.7, 0.3);
    },
    blood(B, t, seed, o) {
      const n = B.n, c = n / 2; const r = SG.rng(seed); const N = 12 + o.density * 8;
      for (let i = 0; i < N; i++) { const a = r.range(-2.6, -0.5), sp = r.range(0.3, 0.9) * n * 0.6 * o.scale; const x = c + Math.cos(a) * sp * t, y = c + Math.sin(a) * sp * t + n * 0.5 * t * t; B.disc(x, y, Math.max(1, n * 0.06 * (1 - t * 0.5)), 1 - t * 0.5, 0); }
      if (t < 0.3) B.disc(c, c, n * 0.12, 0.9, 0.4);
    },
  };

  // 強度緩衝 -> 色階
  function shadeBuf(B, ramp, o) {
    const n = B.n; const im = SG.img(n, n); const L = ramp.length;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let v = B.b[y * n + x]; if (v <= 0.04) continue;
      v = Math.pow(Math.min(1, v), o.gamma) ;
      if (o.dither) v += (SG.BAYER4[(y & 3) * 4 + (x & 3)] - 0.5) / L;
      const k = Math.floor(v * L); if (k < 0 || (k === 0 && o.cutoff && v < 1 / L * 0.6)) continue;
      const c = ramp[Math.max(0, Math.min(L - 1, k))]; const i = (y * n + x) * 4;
      im.d[i] = c[0]; im.d[i + 1] = c[1]; im.d[i + 2] = c[2]; im.d[i + 3] = 255;
    }
    return im;
  }

  SG.buildVfx = function (cfg) {
    const ramp = cfg.customRamp || SG.RAMPS[cfg.ramp].c; const draw = DRAW[cfg.type]; const frames = [];
    const loop = SG.VFX[cfg.type].loop;
    for (let i = 0; i < cfg.frames; i++) {
      const t = loop ? i / cfg.frames : (i + 0.5) / cfg.frames;
      const B = Buf(cfg.size); draw(B, t, cfg.seed, cfg);
      let im = shadeBuf(B, ramp, cfg);
      if (cfg.outline) im = SG.outline(im, 'dark', SG.darkest(ramp), false);
      frames.push(im);
    }
    return SG.packRows([{ name: cfg.type, frames, fps: cfg.fps, loop }], cfg.size, cfg.size);
  };
})();
