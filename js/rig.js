/* 骨架動畫：依使用者擺放的關節，把角色切成部位，用正向運動學（FK）產生動作 */
(function () {
  const SG = window.SG;
  const D = Math.PI / 180;
  const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
  const normRad = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const normDeg = (a) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
  const lerp = (a, b, t) => a + (b - a) * t;

  SG.BODY_TYPES = { biped: '雙足人形', quad: '四足動物', float: '無腳／飛行' };
  SG.WEAPONS = { none: '徒手（出拳）', sword: '劍／刀（揮砍）', axe: '斧／錘（重劈）', spear: '長槍（突刺）', bow: '弓（射箭）', staff: '法杖（施法）' };
  SG.FLOAT_MODES = { bounce: '彈跳（史萊姆）', hover: '漂浮（幽靈）', fly: '拍翅飛行（有翅膀）' };
  SG.JOINT_LABEL = {
    headTop: '頭頂', neck: '脖子', shoulder: '肩', hip: '髖', elbowF: '前肘', handF: '前手', elbowB: '後肘', handB: '後手',
    kneeF: '前膝', footF: '前腳', kneeB: '後膝', footB: '後腳', tip: '武器尖',
    tail: '尾巴尖', head: '頭', kneeFF: '前腿膝', footFF: '前腳掌', kneeFB: '前腿膝(遠)', footFB: '前腳掌(遠)',
    kneeRF: '後腿膝', footRF: '後腳掌', kneeRB: '後腿膝(遠)', footRB: '後腳掌(遠)',
    base: '底部', top: '頂部', wingRootF: '翅根', wingTipF: '翅尖', wingRootB: '翅根(遠)', wingTipB: '翅尖(遠)',
  };

  // ---------- 骨架模板 ----------
  // bone: n 名稱, a 起點關節, b 終點關節, p 父骨（null = 根）, z 繪製順序, back 被遮擋的遠側肢體
  SG.rigDef = function (type, o) {
    o = o || {};
    if (type === 'quad') return {
      root: 'hip', feet: ['footFF', 'footFB', 'footRF', 'footRB'], trail: 'head',
      bones: [
        { n: 'body', a: 'hip', b: 'shoulder', p: null, z: 3 },
        { n: 'neck', a: 'shoulder', b: 'head', p: 'body', z: 4 },
        { n: 'tail', a: 'hip', b: 'tail', p: 'body', z: 2 },
        { n: 'uFB', a: 'shoulder', b: 'kneeFB', p: 'body', z: 1, back: 1 }, { n: 'lFB', a: 'kneeFB', b: 'footFB', p: 'uFB', z: 1, back: 1 },
        { n: 'uRB', a: 'hip', b: 'kneeRB', p: 'body', z: 1, back: 1 }, { n: 'lRB', a: 'kneeRB', b: 'footRB', p: 'uRB', z: 1, back: 1 },
        { n: 'uFF', a: 'shoulder', b: 'kneeFF', p: 'body', z: 5 }, { n: 'lFF', a: 'kneeFF', b: 'footFF', p: 'uFF', z: 5 },
        { n: 'uRF', a: 'hip', b: 'kneeRF', p: 'body', z: 5 }, { n: 'lRF', a: 'kneeRF', b: 'footRF', p: 'uRF', z: 5 },
      ],
      fill: { body: ['uFF', 'uRF', 'neck'] },
      defaults: { tail: [0.04, 0.28], hip: [0.3, 0.42], shoulder: [0.68, 0.4], head: [0.88, 0.22], kneeFF: [0.72, 0.72], footFF: [0.73, 0.97], kneeFB: [0.62, 0.72], footFB: [0.62, 0.97], kneeRF: [0.33, 0.72], footRF: [0.33, 0.97], kneeRB: [0.24, 0.72], footRB: [0.24, 0.97] },
    };
    if (type === 'float') {
      const fly = o.floatMode === 'fly';
      const bones = [{ n: 'body', a: 'base', b: 'top', p: null, z: 3 }];
      if (fly) bones.push({ n: 'wingB', a: 'wingRootB', b: 'wingTipB', p: 'body', z: 1, back: 1 }, { n: 'wingF', a: 'wingRootF', b: 'wingTipF', p: 'body', z: 5 });
      const defaults = { base: [0.5, 0.97], top: [0.5, 0.03] };
      if (fly) Object.assign(defaults, { wingRootF: [0.58, 0.42], wingTipF: [0.95, 0.15], wingRootB: [0.42, 0.42], wingTipB: [0.06, 0.15] });
      return { root: 'base', feet: o.floatMode === 'bounce' ? ['base'] : [], trail: 'top', bones, fill: fly ? { body: ['wingF'] } : {}, defaults };
    }
    // 雙足
    const bones = [
      { n: 'torso', a: 'hip', b: 'neck', p: null, z: 3 },
      { n: 'head', a: 'neck', b: 'headTop', p: 'torso', z: 4 },
      { n: 'uaB', a: 'shoulder', b: 'elbowB', p: 'torso', z: 0, back: 1 }, { n: 'faB', a: 'elbowB', b: 'handB', p: 'uaB', z: 0, back: 1 },
      { n: 'thB', a: 'hip', b: 'kneeB', p: null, z: 1, back: 1 }, { n: 'shB', a: 'kneeB', b: 'footB', p: 'thB', z: 1, back: 1 },
      { n: 'thF', a: 'hip', b: 'kneeF', p: null, z: 5 }, { n: 'shF', a: 'kneeF', b: 'footF', p: 'thF', z: 5 },
      { n: 'uaF', a: 'shoulder', b: 'elbowF', p: 'torso', z: 6 }, { n: 'faF', a: 'elbowF', b: 'handF', p: 'uaF', z: 6 },
    ];
    const defaults = { headTop: [0.5, 0.02], neck: [0.5, 0.3], shoulder: [0.5, 0.36], hip: [0.5, 0.6], elbowF: [0.6, 0.47], handF: [0.66, 0.58], elbowB: [0.42, 0.47], handB: [0.36, 0.58], kneeF: [0.56, 0.8], footF: [0.6, 0.97], kneeB: [0.44, 0.8], footB: [0.4, 0.97] };
    const armed = o.weapon && o.weapon !== 'none';
    if (armed) { bones.push({ n: 'weapon', a: 'handF', b: 'tip', p: 'faF', z: 7, weapon: 1 }); defaults.tip = [0.85, 0.3]; }
    return { root: 'hip', feet: ['footF', 'footB'], trail: armed ? 'tip' : 'handF', bones, fill: { torso: ['uaF', 'faF', 'weapon'] }, defaults };
  };

  // ---------- 自動擺放關節（依剪影粗略估計）----------
  SG.autoJoints = function (B, type, o) {
    const def = SG.rigDef(type, o); const f = o.facing === 'left' ? -1 : 1; const { w, h, d } = B;
    const J = {}; for (const k in def.defaults) J[k] = def.defaults[k].slice();
    const op = (x, y) => d[(y * w + x) * 4 + 3] > 0;
    const rowCx = (y0, y1) => { let s = 0, n = 0; for (let y = Math.floor(y0 * h); y < Math.max(Math.floor(y0 * h) + 1, Math.floor(y1 * h)); y++) for (let x = 0; x < w; x++) if (op(x, y)) { s += x + 0.5; n++; } return n ? s / n / w : 0.5; };
    // 腳底欄位分群
    const footClusters = () => {
      const band = Math.max(2, Math.round(h * 0.08)); const cols = [];
      for (let x = 0; x < w; x++) { let any = false; for (let y = h - band; y < h; y++) if (op(x, y)) { any = true; break; } cols.push(any); }
      const cl = []; let s = -1;
      for (let x = 0; x <= w; x++) { if (x < w && cols[x]) { if (s < 0) s = x; } else if (s >= 0) { cl.push([s, x - 1]); s = -1; } }
      return cl.map((c) => ({ cx: (c[0] + c[1] + 1) / 2 / w, size: c[1] - c[0] + 1 }));
    };
    if (type === 'biped') {
      const cx = rowCx(0.3, 0.6), hcx = rowCx(0, 0.15);
      J.headTop = [hcx, 0.02]; J.neck = [rowCx(0.25, 0.32), 0.3]; J.shoulder = [J.neck[0], 0.36]; J.hip = [rowCx(0.55, 0.62), 0.6];
      let cl = footClusters().sort((a, b) => b.size - a.size).slice(0, 2);
      let fA, fB;
      if (cl.length >= 2) { const s = cl.sort((a, b) => a.cx - b.cx); fA = s[1].cx; fB = s[0].cx; }
      else { const c = cl.length ? cl[0].cx : cx; const sp = cl.length ? cl[0].size / w / 4 : 0.08; fA = c + sp; fB = c - sp; }
      if (f < 0) [fA, fB] = [fB, fA];
      J.footF = [fA, 0.97]; J.footB = [fB, 0.97];
      J.kneeF = [lerp(J.hip[0], fA, 0.55), 0.8]; J.kneeB = [lerp(J.hip[0], fB, 0.55), 0.8];
      J.elbowF = [J.shoulder[0] + 0.1 * f, 0.47]; J.handF = [J.shoulder[0] + 0.16 * f, 0.57];
      J.elbowB = [J.shoulder[0] - 0.08 * f, 0.47]; J.handB = [J.shoulder[0] - 0.13 * f, 0.57];
      if (J.tip) {
        // 武器尖：前手前方、腰部以上，離髖關節最遠的像素（通常是劍尖 / 槍尖 / 杖頭）
        let best = null, bd = -1; const hx = J.hip[0] * w, hy = J.hip[1] * h, sx = J.shoulder[0] * w;
        for (let y = 0; y < Math.floor(0.75 * h); y++) for (let x = 0; x < w; x++) {
          if (!op(x, y) || (x + 0.5 - sx) * f < w * 0.12) continue;
          const dd = Math.hypot(x + 0.5 - hx, (y + 0.5 - hy) * 0.8); if (dd > bd) { bd = dd; best = [(x + 0.5) / w, (y + 0.5) / h]; }
        }
        J.tip = best || [Math.min(0.98, Math.max(0.02, J.handF[0] + 0.2 * f)), 0.25];
      }
      return J;
    }
    if (type === 'quad') {
      const cl = footClusters().sort((a, b) => b.cx - a.cx); // 由前到後
      const names = ['footFF', 'footFB', 'footRF', 'footRB'];
      if (cl.length >= 4) cl.slice(0, 4).forEach((c, i) => (J[names[i]] = [c.cx, 0.97]));
      else if (cl.length >= 2) { // 近/遠腿黏在一起：各自拆成前後兩半
        const a = cl[0], b = cl[cl.length - 1], qa = a.size / w / 4, qb = b.size / w / 4;
        J.footFF = [a.cx + qa * f, 0.97]; J.footFB = [a.cx - qa * f, 0.97]; J.footRF = [b.cx + qb * f, 0.97]; J.footRB = [b.cx - qb * f, 0.97];
      }
      if (f < 0) for (const k of Object.keys(J)) if (!names.includes(k)) J[k][0] = 1 - J[k][0];
      J.kneeFF = [J.footFF[0], 0.72]; J.kneeFB = [J.footFB[0], 0.72]; J.kneeRF = [J.footRF[0] + 0.02 * f, 0.72]; J.kneeRB = [J.footRB[0] + 0.02 * f, 0.72];
      // 頭：前側 40% 中最高的像素
      let hy = h, hx = 0;
      for (let y = 0; y < h && hy === h; y++) for (let x = 0; x < w; x++) { const fx = f > 0 ? x / w : 1 - x / w; if (fx > 0.6 && op(x, y)) { hy = y; hx = x; break; } }
      if (hy < h) J.head = [(hx + 0.5) / w, Math.min(0.5, (hy + h * 0.1) / h)];
      return J;
    }
    J.base = [rowCx(0.85, 1), 0.97]; J.top = [rowCx(0, 0.12), 0.03];
    if (f < 0) for (const k of ['wingRootF', 'wingTipF', 'wingRootB', 'wingTipB']) if (J[k]) J[k][0] = 1 - J[k][0];
    return J;
  };

  function distSeg(px, py, a, b) {
    const vx = b[0] - a[0], vy = b[1] - a[1]; const L = vx * vx + vy * vy;
    let t = L ? ((px - a[0]) * vx + (py - a[1]) * vy) / L : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - a[0] - vx * t, py - a[1] - vy * t);
  }

  // ---------- 依骨頭切分部位 ----------
  SG.segmentRig = function (B, def, J, opt) {
    const { w, h, d } = B; const n = def.bones.length; const owner = new Int16Array(w * h).fill(-1);
    const segs = def.bones.map((b) => [J[b.a], J[b.b]]);
    const wi = def.bones.findIndex((b) => b.weapon); const wR = opt.weaponWidth;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!d[(y * w + x) * 4 + 3]) continue; const px = x + 0.5, py = y + 0.5;
      if (wi >= 0 && distSeg(px, py, segs[wi][0], segs[wi][1]) <= wR) { owner[y * w + x] = wi; continue; }
      let best = -1, bd = 1e9;
      for (let i = 0; i < n; i++) { if (i === wi) continue; const dd = distSeg(px, py, segs[i][0], segs[i][1]) * (def.bones[i].back ? 1.6 : 1); if (dd < bd) { bd = dd; best = i; } }
      owner[y * w + x] = best;
    }
    const layers = def.bones.map(() => SG.img(w, h));
    for (let p = 0; p < w * h; p++) { const o = owner[p]; if (o < 0) continue; const L = layers[o].d; for (let k = 0; k < 4; k++) L[p * 4 + k] = d[p * 4 + k]; }
    // 補洞：前方肢體移開後，身體被遮住的地方用附近身體顏色補上
    for (const into in def.fill) {
      const ii = def.bones.findIndex((b) => b.n === into); if (ii < 0) continue;
      const from = new Set(def.fill[into].map((nm) => def.bones.findIndex((b) => b.n === nm)).filter((i) => i >= 0));
      const ds = []; for (let p = 0; p < w * h; p++) if (owner[p] === ii) ds.push(distSeg((p % w) + 0.5, Math.floor(p / w) + 0.5, segs[ii][0], segs[ii][1]));
      if (!ds.length) continue; ds.sort((a, b) => a - b); const R = ds[Math.floor(ds.length * 0.85)] + 0.5;
      const L = layers[ii].d;
      // 多源 BFS：每個待補像素取「最近的身體像素」顏色，避免橫條紋
      const need = new Uint8Array(w * h); const src = new Int32Array(w * h).fill(-1); const q = [];
      for (let p = 0; p < w * h; p++) {
        if (owner[p] === ii) { src[p] = p; q.push(p); continue; }
        if (from.has(owner[p]) && distSeg((p % w) + 0.5, Math.floor(p / w) + 0.5, segs[ii][0], segs[ii][1]) <= R) need[p] = 1;
      }
      for (let qi = 0; qi < q.length; qi++) {
        const p = q[qi]; const x = p % w, y = Math.floor(p / w);
        for (const np of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
          if (np < 0 || src[np] >= 0 || !need[np]) continue; src[np] = src[p]; q.push(np);
        }
      }
      for (let p = 0; p < w * h; p++) if (need[p] && src[p] >= 0) for (let c = 0; c < 4; c++) L[p * 4 + c] = d[src[p] * 4 + c];
    }
    const bbox = layers.map((L) => SG.bbox(L, 0));
    return { owner, layers, bbox };
  };

  // ---------- 正向運動學 ----------
  function solve(def, J, P, f) {
    const W = {}; const rp = J[def.root]; const R0 = (P.rot || 0) * D * f;
    const root = { R: R0, apply: (q) => { const v = rot(q[0] - rp[0], q[1] - rp[1], R0); return [rp[0] + v[0] + P.dx, rp[1] + v[1] + P.dy]; } };
    for (const b of def.bones) {
      const par = b.p ? W[b.p] : root; const A = J[b.a]; const S = par.apply(A); const R = par.R + (P.L[b.n] || 0) * D * f;
      W[b.n] = { R, S, A,
        apply: (q) => { const v = rot(q[0] - A[0], q[1] - A[1], R); return [S[0] + v[0], S[1] + v[1]]; },
        inv: (q) => { const v = rot(q[0] - S[0], q[1] - S[1], -R); return [A[0] + v[0], A[1] + v[1]]; } };
    }
    return W;
  }
  const endBone = (def, joint) => def.bones.find((b) => b.b === joint) || def.bones.find((b) => b.a === joint);

  // 關鍵影格 → 各骨頭局部角度（支援 {d: 絕對方向}：0＝前、90＝下、-90＝上、180＝後）
  function resolve(def, J, K, f, h) {
    const P = { dx: (K.dx || 0) * h * f, dy: (K.dy || 0) * h, rot: K.rot || 0, L: {}, grot: K.grot || 0, sx: K.sx || 1, sy: K.sy || 1,
      ground: K.ground !== false, pivot: K.pivot || 'center', fx: K.fx || null, flash: K.flash || 0, tint: K.tint || null, glow: K.glow || 0 };
    const Rw = {}; const R0 = P.rot * D * f;
    for (const b of def.bones) {
      const parR = b.p ? Rw[b.p] : R0; const v = K[b.n]; let loc = 0;
      if (typeof v === 'number') loc = v;
      else if (v && v.d != null) {
        const a0 = Math.atan2(J[b.b][1] - J[b.a][1], J[b.b][0] - J[b.a][0]); const target = (f > 0 ? v.d : 180 - v.d) * D;
        loc = (normRad(target - a0 - parR) / D) * f;
      }
      P.L[b.n] = loc; Rw[b.n] = parR + loc * D * f;
    }
    return P;
  }
  function mixPose(A, B, t) {
    const o = Object.assign({}, t < 0.5 ? A : B); o.L = {};
    for (const k of ['dx', 'dy', 'rot', 'grot', 'sx', 'sy', 'glow']) o[k] = lerp(A[k], B[k], t);
    for (const k in A.L) o.L[k] = A.L[k] + normDeg(B.L[k] - A.L[k]) * t;
    return o;
  }

  // ---------- 動作庫 ----------
  const S = Math.sin, C = Math.cos, TAU = Math.PI * 2, pos = (v) => Math.max(0, v);
  const BIPED = {
    idle: { label: '待機 idle', frames: 6, fps: 6, loop: true, fn: (t) => { const s = S(t * TAU), b = (s + 1) / 2;
      return { torso: 1.5 * s, head: -1.5 * s, uaF: 3 * s, faF: -2 - 2 * b, uaB: -2 * s, thF: -3 * b, shF: 6 * b, thB: -3 * b, shB: 6 * b }; } },
    walk: { label: '走路 walk', frames: 8, fps: 10, loop: true, fn: (t) => { const p = t * TAU, s = S(p), c = C(p);
      return { thF: -26 * s, thB: 26 * s, shF: 6 + 40 * pos(c), shB: 6 + 40 * pos(-c), uaF: 22 * s, uaB: -22 * s, faF: -12 - 10 * pos(-s), faB: -12 - 10 * pos(s), torso: 4 + 1.5 * S(2 * p), head: -2 * S(2 * p) }; } },
    run: { label: '跑步 run', frames: 8, fps: 14, loop: true, fn: (t) => { const p = t * TAU, s = S(p), c = C(p);
      return { thF: -42 * s, thB: 42 * s, shF: 10 + 75 * pos(c), shB: 10 + 75 * pos(-c), uaF: 42 * s, uaB: -42 * s, faF: -75, faB: -75, torso: 13, head: -8, dy: -0.04 * Math.abs(c), sy: 1 - 0.04 * Math.abs(s) }; } },
    jump: { label: '跳躍 jump', frames: 7, fps: 10, loop: false, keys: [
      { thF: -38, shF: 72, thB: -32, shB: 66, torso: 16, uaF: 35, uaB: 35, faF: -10 },
      { dy: -0.14, uaF: { d: -70 }, uaB: { d: -80 }, faF: -10, thF: 6, thB: 12, torso: -4, sy: 1.06, sx: 0.95 },
      { dy: -0.3, thF: -55, shF: 95, thB: -35, shB: 85, uaF: { d: -40 }, uaB: { d: -60 }, torso: 6 },
      { dy: -0.33, thF: -45, shF: 80, thB: -25, shB: 75, uaF: { d: -20 }, uaB: { d: -40 }, torso: 4 },
      { dy: -0.16, thF: -12, shF: 18, thB: 8, shB: 15, uaF: { d: -110 }, uaB: { d: -120 }, torso: -6 },
      { thF: -36, shF: 70, thB: -30, shB: 64, torso: 18, uaF: 25, uaB: 25 },
      {},
    ] },
    hurt: { label: '受傷 hurt', frames: 3, fps: 10, loop: false, keys: [
      { flash: 1, torso: -18, head: -14, uaF: 28, uaB: 24, faF: 25, dx: -0.06, thF: 8, thB: -6 },
      { tint: [230, 40, 60], torso: -12, head: -8, uaF: 16, faF: 12, dx: -0.08 },
      { torso: -3, dx: -0.03 },
    ] },
    death: { label: '死亡 death', frames: 7, fps: 10, loop: false, keys: [
      { flash: 1, torso: -15, head: -12, uaF: 20 },
      { torso: 26, head: 22, thF: -32, shF: 72, thB: -28, shB: 68, uaF: -15, uaB: -10, faF: -10 },
      { torso: 12, head: 10, thF: -18, shF: 40, thB: -16, shB: 38, grot: -30, pivot: 'back' },
      { torso: -5, head: -10, uaF: 40, uaB: 30, grot: -72, pivot: 'back' },
      { torso: -8, head: -14, uaF: 70, uaB: 50, grot: -90, pivot: 'back', dy: -0.04 },
      { torso: -6, head: -10, uaF: 80, uaB: 60, grot: -90, pivot: 'back' },
      { torso: -6, head: -10, uaF: 80, uaB: 60, grot: -90, pivot: 'back' },
    ] },
    cast: { label: '施法 cast', frames: 6, fps: 10, loop: true, fn: (t) => { const s = S(t * TAU);
      return { uaF: { d: -55 }, faF: { d: -75 }, weapon: { d: -90 }, uaB: { d: -40 - 8 * s }, faB: { d: -60 }, torso: -6 - 2 * s, head: -4, dy: -0.015 * (s + 1), glow: 0.1 + 0.1 * (s + 1) / 2, fx: { glow: 1, t } }; } },
  };
  // 依武器的攻擊
  const ATTACK = {
    sword: [
      { uaF: { d: 70 }, faF: { d: 30 }, weapon: { d: -60 } },
      { torso: -12, head: 4, uaF: { d: -130 }, faF: { d: -150 }, weapon: { d: -165 }, uaB: 30, thF: -10, thB: 14, dx: -0.04 },
      { torso: 18, uaF: { d: 15 }, faF: { d: 25 }, weapon: { d: 35 }, uaB: -30, thF: -36, shF: 16, thB: 26, dx: 0.1, fx: { trail: 1 } },
      { torso: 22, uaF: { d: 60 }, faF: { d: 80 }, weapon: { d: 105 }, uaB: -35, thF: -36, shF: 16, thB: 26, dx: 0.12, fx: { trail: 1 } },
      { torso: 12, uaF: { d: 70 }, faF: { d: 85 }, weapon: { d: 110 }, thF: -24, thB: 18, dx: 0.08 },
      { uaF: { d: 70 }, faF: { d: 30 }, weapon: { d: -60 }, dx: 0.02 },
    ],
    axe: [
      { uaF: { d: 70 }, faF: { d: 40 }, weapon: { d: -45 } },
      { torso: -16, head: 6, uaF: { d: -105 }, faF: { d: -100 }, weapon: { d: -120 }, uaB: { d: -110 }, faB: { d: -100 }, thF: -8, thB: 16, dx: -0.03, dy: -0.02 },
      { torso: -6, uaF: { d: -80 }, faF: { d: -60 }, weapon: { d: -40 }, uaB: { d: -80 }, dx: 0.04 },
      { torso: 28, head: 12, uaF: { d: 50 }, faF: { d: 75 }, weapon: { d: 85 }, uaB: { d: 50 }, thF: -40, shF: 40, thB: 30, dx: 0.1, fx: { trail: 1, shake: 1 } },
      { torso: 24, uaF: { d: 55 }, faF: { d: 80 }, weapon: { d: 90 }, uaB: { d: 55 }, thF: -38, shF: 38, thB: 28, dx: 0.1 },
      { uaF: { d: 70 }, faF: { d: 40 }, weapon: { d: -45 }, dx: 0.02 },
    ],
    spear: [
      { uaF: { d: 70 }, faF: { d: 5 }, weapon: { d: -5 } },
      { torso: -10, uaF: { d: 120 }, faF: { d: 15 }, weapon: { d: -3 }, uaB: { d: 100 }, faB: { d: 10 }, thF: -6, thB: 16, dx: -0.06 },
      { torso: 15, uaF: { d: 10 }, faF: { d: 0 }, weapon: { d: 0 }, uaB: { d: 40 }, thF: -36, shF: 10, thB: 30, dx: 0.14, fx: { trail: 1 } },
      { torso: 18, uaF: { d: 0 }, faF: { d: 0 }, weapon: { d: 0 }, uaB: { d: 30 }, thF: -38, shF: 10, thB: 32, dx: 0.17, fx: { trail: 1 } },
      { torso: 10, uaF: { d: 25 }, faF: { d: 5 }, weapon: { d: 0 }, thF: -26, thB: 22, dx: 0.1 },
      { uaF: { d: 70 }, faF: { d: 5 }, weapon: { d: -5 }, dx: 0.02 },
    ],
    bow: [
      { uaF: { d: 70 }, faF: { d: 70 } },
      { torso: -2, uaF: { d: 0 }, faF: { d: 0 }, weapon: { d: -90 }, uaB: { d: 10 }, faB: { d: 180 } },
      { torso: -5, head: 3, uaF: { d: 0 }, faF: { d: 0 }, weapon: { d: -90 }, uaB: { d: -15 }, faB: { d: 180 }, thF: -8, thB: 10 },
      { torso: -6, uaF: { d: 0 }, faF: { d: 0 }, weapon: { d: -90 }, uaB: { d: 160 }, faB: { d: 200 }, thF: -8, thB: 10, dx: -0.02, fx: { arrow: 0 } },
      { torso: -3, uaF: { d: 5 }, faF: { d: 5 }, weapon: { d: -90 }, uaB: { d: 120 }, faB: { d: 160 }, fx: { arrow: 1 } },
      { uaF: { d: 50 }, faF: { d: 50 }, fx: { arrow: 2 } },
    ],
    staff: [
      { uaF: { d: 70 }, faF: { d: 70 } },
      { torso: -8, uaF: { d: -55 }, faF: { d: -75 }, weapon: { d: -90 }, uaB: { d: -30 }, faB: { d: -50 }, glow: 0.12, fx: { glow: 1, t: 0.2 } },
      { torso: -10, uaF: { d: -60 }, faF: { d: -80 }, weapon: { d: -95 }, uaB: { d: -40 }, faB: { d: -60 }, glow: 0.25, dy: -0.02, fx: { glow: 2, t: 0.6 } },
      { torso: 14, uaF: { d: 0 }, faF: { d: -5 }, weapon: { d: -25 }, uaB: { d: 60 }, thF: -24, thB: 18, dx: 0.06, fx: { orb: 0 } },
      { torso: 10, uaF: { d: 10 }, faF: { d: 0 }, weapon: { d: -20 }, thF: -20, thB: 15, dx: 0.05, fx: { orb: 1 } },
      { uaF: { d: 60 }, faF: { d: 50 }, dx: 0.01, fx: { orb: 2 } },
    ],
    none: [
      { uaF: { d: 65 }, faF: { d: -70 }, uaB: { d: 75 }, faB: { d: -65 } },
      { torso: -8, uaF: { d: 125 }, faF: { d: -40 }, uaB: { d: 70 }, faB: { d: -65 }, dx: -0.03, thF: -6, thB: 12 },
      { torso: 16, uaF: { d: 0 }, faF: { d: 0 }, uaB: { d: 100 }, faB: { d: -30 }, thF: -28, shF: 10, thB: 22, dx: 0.08, fx: { trail: 1 } },
      { torso: 18, uaF: { d: -5 }, faF: { d: -5 }, uaB: { d: 105 }, faB: { d: -25 }, thF: -28, shF: 10, thB: 22, dx: 0.09 },
      { torso: 6, uaF: { d: 60 }, faF: { d: -50 }, thF: -12, thB: 10, dx: 0.04 },
      { uaF: { d: 65 }, faF: { d: -70 }, uaB: { d: 75 }, faB: { d: -65 }, dx: 0.01 },
    ],
  };

  const QUAD = {
    idle: { label: '待機 idle', frames: 6, fps: 6, loop: true, fn: (t) => { const s = S(t * TAU), b = (s + 1) / 2;
      return { body: 1 * s, neck: -3 * s, tail: 10 * S(t * TAU * 2), uFF: -2 * b, lFF: 4 * b, uRF: -2 * b, lRF: -4 * b, uFB: -2 * b, lFB: 4 * b, uRB: -2 * b, lRB: -4 * b }; } },
    walk: { label: '走路 walk', frames: 8, fps: 10, loop: true, fn: (t) => { const p = t * TAU, s = S(p), c = C(p);
      return { uFF: -22 * s, lFF: 5 + 35 * pos(c), uRB: -22 * s, lRB: -5 - 30 * pos(c), uFB: 22 * s, lFB: 5 + 35 * pos(-c), uRF: 22 * s, lRF: -5 - 30 * pos(-c), body: 1.5 * S(2 * p), neck: -3 * S(2 * p), tail: 12 * s }; } },
    run: { label: '奔跑 run', frames: 8, fps: 14, loop: true, fn: (t) => { const p = t * TAU, s = S(p), c = C(p), s2 = S(p - 0.5), c2 = C(p - 0.5);
      return { uFF: -40 * s, lFF: 10 + 50 * pos(c), uFB: -40 * s2, lFB: 10 + 50 * pos(c2), uRF: 40 * S(p + 2.6), lRF: -10 - 45 * pos(C(p + 2.6)), uRB: 40 * S(p + 2.1), lRB: -10 - 45 * pos(C(p + 2.1)),
        body: 6 * s, neck: -6 * s - 4, tail: -15 + 10 * s, dy: -0.05 * pos(-c) }; } },
    attack: { label: '撲咬 attack', frames: 6, fps: 12, loop: false, keys: [
      {},
      { body: 6, neck: -14, uRF: 20, lRF: -45, uRB: 20, lRB: -45, uFF: -10, uFB: -10, tail: 20, dx: -0.05 },
      { body: -10, neck: 8, uFF: -60, lFF: -10, uFB: -55, lFB: -10, uRF: 45, lRF: 0, uRB: 40, lRB: 0, dx: 0.12, dy: -0.1, ground: false, tail: -10, fx: { trail: 1 } },
      { body: 10, neck: 28, uFF: -30, lFF: 10, uFB: -25, lFB: 10, uRF: 30, uRB: 25, dx: 0.17, tail: -15, fx: { trail: 1 } },
      { body: 4, neck: 12, uFF: -12, uRF: 12, dx: 0.12 },
      { dx: 0.03 },
    ] },
    jump: { label: '跳躍 jump', frames: 6, fps: 10, loop: false, keys: [
      { body: 6, uRF: 25, lRF: -50, uRB: 25, lRB: -50, uFF: -15, lFF: 25, uFB: -15, lFB: 25, neck: -8 },
      { body: -12, uFF: -50, uFB: -45, uRF: 45, uRB: 40, dy: -0.15, ground: false, neck: 5 },
      { body: 0, uFF: -30, lFF: 50, uFB: -25, lFB: 50, uRF: 30, lRF: -60, uRB: 25, lRB: -60, dy: -0.28, ground: false },
      { body: 10, uFF: -10, uFB: -5, uRF: 40, uRB: 35, dy: -0.12, ground: false, neck: 8 },
      { body: 4, uFF: -15, lFF: 30, uFB: -15, lFB: 30, uRF: 20, lRF: -40, uRB: 20, lRB: -40 },
      {},
    ] },
    hurt: { label: '受傷 hurt', frames: 3, fps: 10, loop: false, keys: [
      { flash: 1, body: -8, neck: -22, tail: 25, dx: -0.06 }, { tint: [230, 40, 60], body: -5, neck: -14, dx: -0.08 }, { dx: -0.03 }] },
    death: { label: '死亡 death', frames: 6, fps: 8, loop: false, keys: [
      { flash: 1, neck: -20 },
      { uFF: -20, lFF: 50, uFB: -20, lFB: 50, uRF: 20, lRF: -50, uRB: 20, lRB: -50, neck: 20, body: 4 },
      { uFF: -35, lFF: 85, uFB: -35, lFB: 85, uRF: 35, lRF: -85, uRB: 35, lRB: -85, neck: 40, body: 6, tail: 20 },
      { uFF: -45, lFF: 100, uFB: -45, lFB: 100, uRF: 45, lRF: -100, uRB: 45, lRB: -100, neck: 55, body: 4, tail: 30, grot: -8 },
      { uFF: -45, lFF: 100, uFB: -45, lFB: 100, uRF: 45, lRF: -100, uRB: 45, lRB: -100, neck: 60, body: 3, tail: 35, grot: -8 },
      { uFF: -45, lFF: 100, uFB: -45, lFB: 100, uRF: 45, lRF: -100, uRB: 45, lRB: -100, neck: 60, body: 3, tail: 35, grot: -8 },
    ] },
  };

  function floatAnims(mode) {
    const fly = mode === 'fly', bounce = mode === 'bounce';
    const flap = (p, k) => (fly ? { wingF: -35 * S(p) * k, wingB: 35 * S(p) * k } : {});
    const A = {
      idle: { label: '待機 idle', frames: 6, fps: 8, loop: true, fn: (t) => { const p = t * TAU, s = S(p);
        if (bounce) return { sx: 1 + 0.05 * (s + 1) / 2, sy: 1 - 0.06 * (s + 1) / 2 };
        return Object.assign({ dy: -0.04 * s - 0.02, body: 2 * S(p + 1), ground: false, sy: 1 + 0.02 * s }, flap(p, 1)); } },
      move: { label: '移動 move', frames: 8, fps: 12, loop: true, fn: (t) => { const p = t * TAU, s = S(p);
        if (bounce) {
          const k = [[1.25, 0.75, 0], [0.85, 1.2, -0.08], [0.92, 1.1, -0.22], [1, 1, -0.28], [0.95, 1.08, -0.2], [0.9, 1.15, -0.06], [1.2, 0.8, 0], [1.08, 0.92, 0]];
          const q = k[Math.floor(t * k.length) % k.length]; return { sx: q[0], sy: q[1], dy: q[2], ground: false, body: q[2] < 0 ? 6 : 0 };
        }
        return Object.assign({ dy: -0.05 * S(2 * p) - 0.03, body: 10, ground: false }, flap(p * 2, 1.2)); } },
      attack: { label: '攻擊 attack', frames: 6, fps: 12, loop: false, keys: [
        bounce ? {} : { dy: -0.03, ground: false },
        { body: -14, sx: 1.12, sy: 0.88, dx: -0.06, ground: !bounce ? false : true, dy: bounce ? 0 : -0.03, ...flap(-1.5, 1) },
        { body: 14, sx: 1.25, sy: 0.85, dx: 0.14, dy: -0.05, ground: false, fx: { trail: 1 }, ...flap(1.5, 1) },
        { body: 10, sx: 1.12, sy: 0.92, dx: 0.17, dy: bounce ? 0 : -0.03, ground: bounce, fx: { trail: 1 } },
        { body: 4, dx: 0.1, dy: bounce ? 0 : -0.03, ground: bounce },
        bounce ? { dx: 0.02 } : { dx: 0.02, dy: -0.03, ground: false },
      ] },
      hurt: { label: '受傷 hurt', frames: 3, fps: 10, loop: false, keys: [
        { flash: 1, sx: 0.85, sy: 1.15, dx: -0.06, body: -10, ground: bounce, dy: bounce ? 0 : -0.03 },
        { tint: [230, 40, 60], sx: 1.1, sy: 0.9, dx: -0.08, ground: bounce, dy: bounce ? 0 : -0.03 },
        { dx: -0.03, ground: bounce, dy: bounce ? 0 : -0.03 }] },
      death: { label: '死亡 death', frames: 6, fps: 10, loop: false, keys: bounce ? [
        { flash: 1, sx: 0.9, sy: 1.1 }, { sx: 1.25, sy: 0.75 }, { sx: 1.45, sy: 0.5 }, { sx: 1.6, sy: 0.32 }, { sx: 1.7, sy: 0.22 }, { sx: 1.7, sy: 0.2 }] : [
        { flash: 1, dy: -0.03, ground: false }, { body: 20, dy: -0.02, ground: false, ...flap(1, 0.5) }, { body: 50, grot: -20 }, { body: 80, grot: -60 }, { grot: -90, body: 0, dy: -0.03 }, { grot: -90, body: 0 }] },
    };
    return A;
  }

  SG.rigAnims = function (type, o) {
    if (type === 'quad') return QUAD;
    if (type === 'float') return floatAnims(o.floatMode);
    const A = Object.assign({}, BIPED);
    A.attack = { label: '攻擊 attack', frames: 6, fps: 12, loop: false, keys: ATTACK[o.weapon || 'none'] || ATTACK.none };
    return { idle: A.idle, walk: A.walk, run: A.run, attack: A.attack, jump: A.jump, hurt: A.hurt, death: A.death, cast: A.cast };
  };

  // ---------- 繪製 ----------
  function line(im, x0, y0, x1, y1, r, col) {
    const L = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= L; i++) { const x = x0 + (x1 - x0) * i / L, y = y0 + (y1 - y0) * i / L;
      for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
        if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 > r * r + 0.25) continue; put(im, xx, yy, col); } }
  }
  function put(im, x, y, c) { if (x < 0 || y < 0 || x >= im.w || y >= im.h) return; const i = (y * im.w + x) * 4; im.d[i] = c[0]; im.d[i + 1] = c[1]; im.d[i + 2] = c[2]; im.d[i + 3] = 255; }
  function tri(im, a, b, c, col) {
    const minx = Math.floor(Math.min(a[0], b[0], c[0])), maxx = Math.ceil(Math.max(a[0], b[0], c[0])), miny = Math.floor(Math.min(a[1], b[1], c[1])), maxy = Math.ceil(Math.max(a[1], b[1], c[1]));
    const e = (p, q, x, y) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) { const px = x + 0.5, py = y + 0.5; const e1 = e(a, b, px, py), e2 = e(b, c, px, py), e3 = e(c, a, px, py);
      if ((e1 >= 0 && e2 >= 0 && e3 >= 0) || (e1 <= 0 && e2 <= 0 && e3 <= 0)) put(im, x, y, col); }
  }

  SG.buildRigSheet = function (B, cfg) {
    const f = cfg.facing === 'left' ? -1 : 1; const { w, h } = B;
    const def = SG.rigDef(cfg.type, cfg);
    const J = {}; for (const k in def.defaults) { const v = (cfg.joints && cfg.joints[k]) || def.defaults[k]; J[k] = [v[0] * w, v[1] * h]; }
    const seg = SG.segmentRig(B, def, J, { weaponWidth: cfg.weaponWidth });
    const anims = SG.rigAnims(cfg.type, cfg);
    const groundY = def.feet.length ? Math.max(...def.feet.map((k) => J[k][1])) : h;
    const restGround = groundY;
    const Gc = [J[def.root][0], restGround];
    let ox0 = w, ox1 = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (B.d[(y * w + x) * 4 + 3]) { ox0 = Math.min(ox0, x); ox1 = Math.max(ox1, x + 1); }
    const footBones = def.feet.map((k) => endBone(def, k));
    const trailJoint = def.trail; const trailBone = endBone(def, trailJoint);
    const weaponBone = def.bones.find((b) => b.weapon);
    const acc = cfg.accent; const accDark = SG.shade(acc, -0.35), accLight = SG.shade(acc, 0.55);

    // 世界姿勢（含落地鎖定）
    function world(P) {
      let W = solve(def, J, P, f);
      if (P.ground && footBones.length) {
        let maxY = -1e9; def.feet.forEach((k, i) => { const p = W[footBones[i].n].apply(J[k]); if (p[1] > maxY) maxY = p[1]; });
        const P2 = Object.assign({}, P, { dy: P.dy + (restGround - maxY) }); W = solve(def, J, P2, f);
      }
      const pv = P.pivot === 'back' ? [f > 0 ? ox0 : ox1, restGround] : [Gc[0], restGround];
      const ga = P.grot * D * f;
      const fwd = (q) => { const v = rot((q[0] - pv[0]) * P.sx, (q[1] - pv[1]) * P.sy, ga); return [pv[0] + v[0], pv[1] + v[1]]; };
      const inv = (q) => { const v = rot(q[0] - pv[0], q[1] - pv[1], -ga); return [pv[0] + v[0] / P.sx, pv[1] + v[1] / P.sy]; };
      return { W, fwd, inv };
    }
    const jointWorld = (WD, joint) => { const b = endBone(def, joint); return WD.fwd(WD.W[b.n].apply(J[joint])); };

    // 產生每個動畫的姿勢序列
    const list = [];
    for (const name of cfg.anims) {
      const A = anims[name]; if (!A) continue; const n = cfg.frames[name] || A.frames; const poses = [];
      let keys = null; if (A.keys) keys = A.keys.map((K) => resolve(def, J, K, f, h));
      for (let i = 0; i < n; i++) {
        let P;
        if (A.fn) P = resolve(def, J, A.fn(i / n), f, h);
        else { const x = (n > 1 ? i / (n - 1) : 0) * (keys.length - 1); const k = Math.min(keys.length - 2, Math.floor(x)); P = keys.length > 1 ? mixPose(keys[k], keys[k + 1], x - k) : keys[0]; }
        poses.push(P);
      }
      list.push({ name, A, poses });
    }

    // 特效位置（也用於計算格子大小）
    function fxShapes(P, WD, prevP) {
      const out = []; const fx = P.fx; if (!fx) return out;
      if (fx.arrow != null) { const hand = jointWorld(WD, 'handF'); const x = hand[0] + f * (h * 0.15 + fx.arrow * h * 0.55); out.push({ type: 'arrow', x, y: hand[1], len: h * 0.38 }); }
      if (fx.orb != null) { const tip = jointWorld(WD, weaponBone ? 'tip' : 'handF'); const x = tip[0] + f * (h * 0.08 + fx.orb * h * 0.45); out.push({ type: 'orb', x, y: tip[1] + fx.orb * h * 0.04, r: Math.max(1.5, h * 0.07) }); }
      if (fx.glow) { const tip = jointWorld(WD, weaponBone ? 'tip' : 'handF'); out.push({ type: 'glow', x: tip[0], y: tip[1], r: Math.max(2, h * 0.05) * (fx.glow > 1 ? 1.6 : 1.1), t: fx.t || 0 }); }
      if (fx.trail && prevP) {
        const steps = 6; const segs = [];
        for (let j = 0; j <= steps; j++) { const Q = mixPose(prevP, P, j / steps); const W2 = world(Q);
          const tipP = jointWorld(W2, trailJoint); const grip = weaponBone ? jointWorld(W2, weaponBone.a) : null;
          segs.push({ tip: tipP, base: grip ? [lerp(grip[0], tipP[0], 0.35), lerp(grip[1], tipP[1], 0.35)] : null }); }
        out.push({ type: 'trail', segs });
      }
      return out;
    }

    // 計算統一的格子大小（所有影格共用同一個錨點：腳底中心）
    let maxAX = 0, minY = 0, maxY = 0;
    const ext = (q) => { const x = q[0] - Gc[0], y = q[1] - Gc[1]; maxAX = Math.max(maxAX, Math.abs(x)); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    for (const it of list) it.poses.forEach((P, i) => {
      const WD = world(P); it.wd = it.wd || []; it.wd[i] = WD;
      def.bones.forEach((b, bi) => { const bb = seg.bbox[bi]; if (!bb) return; for (const c of [[bb.x, bb.y], [bb.x + bb.w, bb.y], [bb.x, bb.y + bb.h], [bb.x + bb.w, bb.y + bb.h]]) ext(WD.fwd(WD.W[b.n].apply(c))); });
      for (const s of fxShapes(P, WD, i > 0 ? it.poses[i - 1] : null)) {
        if (s.type === 'arrow') { ext([s.x + f * 2, s.y]); ext([s.x - f * s.len, s.y]); }
        else if (s.type === 'orb' || s.type === 'glow') { ext([s.x + s.r * 2, s.y - s.r * 2]); ext([s.x - s.r * 2, s.y + s.r * 2]); }
        else if (s.type === 'trail') for (const g of s.segs) ext(g.tip);
      }
    });
    let cw = cfg.cellW || Math.ceil(maxAX + 3) * 2, ch = cfg.cellH || Math.ceil(maxY - minY + 4);
    cw += cw % 2; ch += ch % 2;
    const ax = cw / 2, ay = cfg.cellH ? ch - Math.ceil(maxY) - 2 : Math.ceil(-minY) + 2;
    const toCell = (q) => [q[0] - Gc[0] + ax, q[1] - Gc[1] + ay];

    const order = def.bones.map((b, i) => ({ b, i })).sort((a, b) => b.b.z - a.b.z); // 前 → 後
    function render(P, WD) {
      const out = SG.img(cw, ch);
      const bbs = order.map(({ i }) => seg.bbox[i]);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const q = WD.inv([x + 0.5 - ax + Gc[0], y + 0.5 - ay + Gc[1]]);
        for (let k = 0; k < order.length; k++) {
          const bb = bbs[k]; if (!bb) continue; const { b, i } = order[k];
          const s = WD.W[b.n].inv(q); const sx = Math.floor(s[0]), sy = Math.floor(s[1]);
          if (sx < bb.x || sy < bb.y || sx >= bb.x + bb.w || sy >= bb.y + bb.h) continue;
          const L = seg.layers[i].d; const si = (sy * w + sx) * 4; if (!L[si + 3]) continue;
          let c = [L[si], L[si + 1], L[si + 2]];
          if (P.flash) c = [255, 255, 255]; else if (P.tint) c = SG.mix(c, P.tint, 0.55); else if (P.glow) c = SG.mix(c, acc, P.glow);
          const o = (y * cw + x) * 4; out.d[o] = c[0]; out.d[o + 1] = c[1]; out.d[o + 2] = c[2]; out.d[o + 3] = 255; break;
        }
      }
      return out;
    }

    function drawFx(im, under, shapes, frameIdx) {
      for (const s of shapes) {
        if (s.type === 'trail') {
          const n = s.segs.length;
          for (let j = 0; j < n - 1; j++) {
            const col = j >= n - 2 ? [255, 255, 255] : j >= n - 4 ? accLight : j >= 1 ? acc : accDark;
            const a = s.segs[j], b = s.segs[j + 1];
            if (a.base) { const A1 = toCell(a.base), A2 = toCell(a.tip), B1 = toCell(b.base), B2 = toCell(b.tip); tri(under, A1, A2, B2, col); tri(under, A1, B2, B1, col); }
            else { const p = toCell(a.tip), q = toCell(b.tip); line(under, p[0], p[1], q[0], q[1], Math.max(1, h * 0.06 * (j + 1) / n), col); }
          }
        } else if (s.type === 'arrow') {
          const p = toCell([s.x, s.y]); const tail = p[0] - f * s.len;
          line(im, tail, p[1], p[0], p[1], 0.5, [210, 190, 150]); put(im, Math.floor(p[0]), Math.floor(p[1]), [255, 255, 255]); put(im, Math.floor(p[0] - f), Math.floor(p[1]) - 1, [255, 255, 255]); put(im, Math.floor(p[0] - f), Math.floor(p[1]) + 1, [255, 255, 255]);
          put(im, Math.floor(tail), Math.floor(p[1]) - 1, acc); put(im, Math.floor(tail), Math.floor(p[1]) + 1, acc);
        } else if (s.type === 'orb') {
          const p = toCell([s.x, s.y]); line(under, p[0] - f * s.r * 2.5, p[1], p[0], p[1], s.r * 0.6, accDark);
          line(im, p[0], p[1], p[0], p[1], s.r, acc); line(im, p[0], p[1], p[0], p[1], s.r * 0.5, [255, 255, 255]);
        } else if (s.type === 'glow') {
          const p = toCell([s.x, s.y]); const r = SG.rng(7 + frameIdx);
          line(under, p[0], p[1], p[0], p[1], s.r, accDark); line(im, p[0], p[1], p[0], p[1], s.r * 0.55, accLight);
          for (let k = 0; k < 5; k++) { const a = r() * TAU, d = s.r * (1.3 + r()); const x = Math.round(p[0] + Math.cos(a) * d), y = Math.round(p[1] + Math.sin(a) * d); put(im, x, y, accLight); if (k % 2) { put(im, x + 1, y, acc); put(im, x - 1, y, acc); put(im, x, y + 1, acc); put(im, x, y - 1, acc); } }
        }
      }
    }

    const rows = [];
    const dirs = cfg.mirror ? [1, -1] : [1];
    const baseFacing = f > 0 ? 'right' : 'left';
    const rendered = list.map((it) => it.poses.map((P, i) => {
      const WD = it.wd[i]; let im = render(P, WD);
      im = SG.outline(im, cfg.outline, cfg.outlineColor, false);
      const shapes = fxShapes(P, WD, i > 0 ? it.poses[i - 1] : null);
      if (shapes.length) { const under = SG.img(cw, ch); drawFx(im, under, shapes, i); for (let p = 0; p < cw * ch; p++) if (!im.d[p * 4 + 3] && under.d[p * 4 + 3]) for (let k = 0; k < 4; k++) im.d[p * 4 + k] = under.d[p * 4 + k]; }
      if (P.fx && P.fx.shake) { const s = SG.img(cw, ch); SG.blit(s, im, 0, 1); im = s; }
      return im;
    }));
    for (const flip of dirs) list.forEach((it, k) => {
      const nm = cfg.mirror ? it.name + '_' + (flip > 0 ? baseFacing : (baseFacing === 'right' ? 'left' : 'right')) : it.name;
      rows.push({ name: nm, frames: rendered[k].map((im) => (flip > 0 ? im : SG.flipX(im))), fps: cfg.fps[it.name] || it.A.fps, loop: it.A.loop });
    });
    const pack = SG.packRows(rows, cw, ch);
    pack.rig = { def, J, seg, w, h, anchor: [ax, ay], Gc };
    return pack;
  };

  // ---------- 匯出 Godot Skeleton2D 場景（可在 Godot 裡自己做動畫）----------
  SG.rigGodotFiles = async function (B, rig, base) {
    const { def, J, seg, Gc } = rig; const files = []; const dir = base + '_rig';
    const ext = []; const nodes = [];
    const v2 = (x, y) => `Vector2(${x.toFixed(1)}, ${y.toFixed(1)})`;
    nodes.push(`[node name="${base}" type="Node2D"]`, '', `[node name="Skeleton2D" type="Skeleton2D" parent="."]`, '');
    const RJ = {}; for (const k in J) RJ[k] = [Math.round(J[k][0]), Math.round(J[k][1])]; // 對齊整數像素
    const G = [Math.round(Gc[0]), Math.round(Gc[1])];
    const rp = RJ[def.root];
    nodes.push(`[node name="root" type="Bone2D" parent="Skeleton2D"]`, `position = ${v2(rp[0] - G[0], rp[1] - G[1])}`, `rest = Transform2D(1, 0, 0, 1, ${(rp[0] - G[0]).toFixed(1)}, ${(rp[1] - G[1]).toFixed(1)})`, '');
    const path = { root: 'Skeleton2D/root' }; const startOf = { root: rp };
    let id = 1;
    for (let i = 0; i < def.bones.length; i++) {
      const b = def.bones[i]; const par = b.p || 'root'; const A = RJ[b.a], E = J[b.b]; const ps = startOf[par];
      const px = A[0] - ps[0], py = A[1] - ps[1];
      const len = Math.hypot(E[0] - A[0], E[1] - A[1]); const ang = Math.atan2(E[1] - A[1], E[0] - A[0]) / D;
      nodes.push(`[node name="${b.n}" type="Bone2D" parent="${path[par]}"]`, `position = ${v2(px, py)}`, `rest = Transform2D(1, 0, 0, 1, ${px.toFixed(1)}, ${py.toFixed(1)})`,
        'auto_calculate_length_and_angle = false', `length = ${len.toFixed(1)}`, `bone_angle = ${ang.toFixed(1)}`, '');
      path[b.n] = path[par] + '/' + b.n; startOf[b.n] = A;
      const bb = seg.bbox[i]; if (!bb) continue;
      const part = SG.crop(seg.layers[i], bb); const png = `${dir}/${b.n}.png`;
      files.push({ name: png, data: await SG.pngBlob(part) });
      ext.push(`[ext_resource type="Texture2D" path="res://${png}" id="${id}"]`);
      nodes.push(`[node name="${b.n}_sprite" type="Sprite2D" parent="${path[b.n]}"]`, `z_index = ${Math.round(b.z * 2)}`, `texture = ExtResource("${id}")`, 'centered = false', `position = ${v2(bb.x - A[0], bb.y - A[1])}`, '');
      id++;
    }
    const tscn = `[gd_scene load_steps=${ext.length + 1} format=3]\n\n${ext.join('\n')}\n\n${nodes.join('\n')}`;
    files.push({ name: `${dir}/${base}_rig.tscn`, data: tscn });
    return files;
  };
})();
