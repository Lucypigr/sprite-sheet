/* 介面邏輯 */
(function () {
  const SG = window.SG;
  const $ = (id) => document.getElementById(id);
  const num = (id) => Number($(id).value);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); };
  const status = (id, msg, cls) => { const s = $(id); s.textContent = msg; s.className = 'status' + (cls ? ' ' + cls : ''); };

  // ---------- 分頁 ----------
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
    try { localStorage.setItem('pf-tab', b.dataset.tab); } catch (e) {}
    if (b.dataset.tab === 'vfx' && !vfx.pack) buildVfx();
    if (b.dataset.tab === 'tiles' && !tiles.ts) buildTiles();
  }));

  // ---------- 通用元件 ----------
  function segmented(id, onChange) {
    const el = $(id); const scope = el.closest('details') || el.parentElement;
    const apply = (v) => {
      el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
      scope.parentElement.querySelectorAll('[data-show]').forEach((n) => { if (el.closest('details').contains(n)) n.style.display = n.dataset.show.split(' ').includes(v) ? '' : 'none'; });
      el.dataset.value = v;
    };
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; apply(b.dataset.v); onChange && onChange(b.dataset.v); });
    apply(el.querySelector('.on').dataset.v);
    return () => el.dataset.value;
  }
  function bindVal(id, fmt) { const el = $(id), v = $(id + '-v'); const f = () => { if (v) v.textContent = fmt ? fmt(el.value) : el.value; }; el.addEventListener('input', f); f(); }
  function fillSelect(id, obj, sel, label) { const s = $(id); s.innerHTML = ''; for (const k in obj) { const o = document.createElement('option'); o.value = k; o.textContent = label ? label(obj[k]) : obj[k].name; if (k === sel) o.selected = true; s.appendChild(o); } }
  function bgSelectors() {
    document.querySelectorAll('.bgsel').forEach((g) => {
      const target = $(g.dataset.target); const opts = [['bg-checker', 'repeating-conic-gradient(#2a2840 0 25%,#353350 0 50%) 0 0/8px 8px'], ['bg-dark', '#0d0c14'], ['bg-light', '#e8e6f0'], ['bg-green', '#3e8948']];
      opts.forEach(([cls, bg]) => { const b = document.createElement('button'); b.style.background = bg; b.title = '背景'; b.onclick = () => { opts.forEach(([c]) => target.classList.remove(c)); target.classList.add(cls); }; g.appendChild(b); });
    });
  }
  bgSelectors();

  // 動畫播放器
  function Player(canvas) {
    const ctx = canvas.getContext('2d'); const st = { pack: null, row: 0, i: 0, last: 0, playing: true };
    function frame(ts) {
      requestAnimationFrame(frame);
      if (!st.pack || !canvas.offsetParent) return;
      const r = st.pack.rows[Math.min(st.row, st.pack.rows.length - 1)];
      if (st.playing) { const dur = (!r.loop && st.i >= r.count - 1 ? 700 : 0) + 1000 / r.fps; if (ts - st.last > dur) { st.last = ts; st.i = (st.i + 1) % r.count; } }
      const fr = r.frames[Math.min(st.i, r.count - 1)];
      const k = Math.max(1, Math.floor(256 / Math.max(fr.w, fr.h)));
      if (canvas.width !== fr.w * k || canvas.height !== fr.h * k) { canvas.width = fr.w * k; canvas.height = fr.h * k; }
      SG.toCanvas(fr, k, canvas);
    }
    requestAnimationFrame(frame);
    return st;
  }

  // ================= 角色 =================
  const ch = { src: null, base: null, pack: null, player: Player($('c-preview')) };
  fillSelect('c-style', SG.STYLES, 'snes'); fillSelect('c-view', SG.VIEWS, 'side');
  fillSelect('c-pal', SG.PALETTES, 'auto');
  fillSelect('t-pal', SG.PALETTES, 'none'); fillSelect('t-style', SG.STYLES, 'snes');
  ['c-height', 'c-colors', 'c-tol', 'c-leg'].forEach((i) => bindVal(i)); bindVal('c-sat', (v) => v + '%'); bindVal('c-con', (v) => v + '%');
  $('c-leg-v').textContent += '%';
  $('c-leg').addEventListener('input', () => { $('c-leg-v').textContent = $('c-leg').value + '%'; });

  const animBox = $('c-anims');
  animBox.innerHTML = '<div class="animrow animhead"><span>動畫</span><span>影格</span><span>FPS</span></div>' + Object.entries(SG.ANIMS).map(([k, a]) =>
    `<div class="animrow"><label><input type="checkbox" data-anim="${k}" ${['idle', 'walk', 'attack', 'hurt', 'death'].includes(k) ? 'checked' : ''}> ${a.label}</label><input type="number" min="2" max="16" value="${a.frames}" data-frames="${k}"><input type="number" min="1" max="60" value="${a.fps}" data-fps="${k}"></div>`).join('');

  const srcMode = segmented('c-src');
  const syncPal = () => { document.querySelectorAll('[data-pal]').forEach((n) => (n.style.display = $('c-pal').value === n.dataset.pal ? '' : 'none')); };
  $('c-pal').addEventListener('change', syncPal); syncPal();

  function setSource(img, pixel, label) {
    ch.src = { img, pixel };
    const oc = $('c-orig'); SG.toCanvas(img, 1, oc); oc.classList.toggle('pix', !!pixel);
    processChar(); status('c-status', label);
  }
  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return toast('請選擇圖片檔');
    const img = new Image(); img.onload = () => { const im = SG.fromCanvasSource(img, 1024); setSource(im, false, `已載入：${file.name}（${img.naturalWidth}×${img.naturalHeight}）`); if ($('c-name').value === 'hero') $('c-name').value = SG.safeName(file.name.replace(/\.\w+$/, '')); URL.revokeObjectURL(img.src); };
    img.onerror = () => toast('無法讀取這張圖片'); img.src = URL.createObjectURL(file);
  }
  $('c-file').addEventListener('change', (e) => loadFile(e.target.files[0]));
  const drop = $('c-drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));
  window.addEventListener('paste', (e) => { const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/')); if (it && document.querySelector('#tab-char.active')) loadFile(it.getAsFile()); });

  try { $('ai-key').value = localStorage.getItem('pf-pollinations-key') || ''; } catch (e) {}
  $('ai-key').addEventListener('change', () => { try { localStorage.setItem('pf-pollinations-key', $('ai-key').value.trim()); } catch (e) {} });
  $('c-dice').onclick = () => { $('c-seed').value = Math.floor(Math.random() * 99999); $('c-gen').click(); };
  $('c-gen').onclick = async () => {
    const desc = $('c-desc').value.trim(); const seed = num('c-seed');
    if (srcMode() === 'proc') { const r = SG.proceduralCharacter(desc, seed); setSource(r.img, true, `程序生成：${r.cfg.kind === 'human' ? '人形' : r.cfg.kind === 'slime' ? '史萊姆' : '怪物'}（種子 ${seed}）`); return; }
    if (!desc) return toast('請先輸入描述');
    const btn = $('c-gen'); btn.disabled = true; status('c-status', 'AI 生成中…（約 5–30 秒）', 'busy');
    try {
      const img = await SG.aiGenerate(SG.aiPrompt('character', desc, $('c-style').value, $('c-view').value), seed, 512);
      setSource(SG.fromCanvasSource(img, 1024), false, `AI 生成完成（種子 ${seed}）。不滿意可按 🎲 換種子，或調整去背容差。`);
    } catch (e) {
      if (e.limit) {
        const r = SG.proceduralCharacter(desc, seed);
        setSource(r.img, true, '');
        status('c-status', `⚠ ${e.message}。已自動改用「程序生成」產生角色。想繼續用 AI：到 enter.pollinations.ai 免費申請 API Key 貼到上方欄位，或稍後再試。`, 'err');
      } else status('c-status', e.message, 'err');
    }
    btn.disabled = false;
  };

  function processChar() {
    if (!ch.src) return;
    try {
      let im = ch.src.img; const pixel = ch.src.pixel;
      if (!pixel) {
        if ($('c-bg').checked) im = SG.removeBackground(im, num('c-tol'));
        if ($('c-blobs').checked) im = SG.keepMainBlobs(im, 0.06);
        const b = SG.bbox(im, 100); if (!b) return status('c-status', '去背後沒有剩下內容，請降低去背容差', 'err');
        im = SG.crop(im, b);
        const H = num('c-height'); const W = Math.max(1, Math.round(b.w * H / b.h));
        im = SG.downscale(im, W, H, 0.4);
      } else { const b = SG.bbox(im, 0); if (b) im = SG.crop(im, b); }
      im = SG.adjust(im, num('c-sat') / 100, num('c-con') / 100, 0);
      const pk = $('c-pal').value; let pal = null;
      if (pk === 'auto') { if (!pixel) pal = SG.extractPalette(im, num('c-colors'), 3); }
      else if (pk !== 'none') pal = SG.PALETTES[pk].colors;
      if (pal) im = SG.quantize(im, pal, $('c-dither').checked);
      if (!pixel && $('c-clean').checked) im = SG.cleanOrphans(im);
      const b2 = SG.bbox(im, 0); if (b2) im = SG.crop(im, b2);
      ch.base = im;
      SG.toCanvas(im, Math.max(1, Math.floor(120 / Math.max(im.w, im.h))), $('c-base'));
      let oc = pal ? SG.darkest(pal) : [24, 20, 37]; if (SG.lum(oc) > 70) oc = [24, 20, 37];
      const anims = [...document.querySelectorAll('[data-anim]')].filter((c) => c.checked).map((c) => c.dataset.anim);
      if (!anims.length) return status('c-status', '請至少勾選一個動畫', 'err');
      const frames = {}, fps = {};
      document.querySelectorAll('[data-frames]').forEach((n) => (frames[n.dataset.frames] = Math.max(2, Math.min(16, Number(n.value) || 2))));
      document.querySelectorAll('[data-fps]').forEach((n) => (fps[n.dataset.fps] = Math.max(1, Number(n.value) || 8)));
      ch.pack = SG.buildCharacterSheet(im, {
        anims, frames, fps, facing: $('c-facing').value, mirror: $('c-mirror').checked, legStart: num('c-leg') / 100,
        accent: SG.hex($('c-accent').value), outline: $('c-outline').value, outlineColor: oc,
        cellW: num('c-cw') || 0, cellH: num('c-ch') || 0,
      });
      if (ch.pack.cw && (!num('c-cw') || !num('c-ch'))) { $('c-cw').placeholder = '自動 ' + ch.pack.cw; $('c-ch').placeholder = '自動 ' + ch.pack.ch; }
      const sel = $('c-play-anim'); sel.innerHTML = ch.pack.rows.map((r, i) => `<option value="${i}">${r.name}</option>`).join('');
      sel.value = String(Math.max(0, [...sel.options].findIndex((o) => o.textContent === ch.lastAnim)));
      ch.player.pack = ch.pack; ch.player.row = Number(sel.value); ch.player.i = 0;
      drawSheet('c');
      $('c-meta').textContent = `角色 ${im.w}×${im.h} · 格子 ${ch.pack.cw}×${ch.pack.ch} · 表 ${ch.pack.sheet.w}×${ch.pack.sheet.h} · ${ch.pack.rows.length} 個動畫${pal ? ' · ' + pal.length + ' 色' : ''}`;
    } catch (e) { console.error(e); status('c-status', '處理失敗：' + e.message, 'err'); }
  }
  $('c-play-anim').addEventListener('change', (e) => { ch.player.row = Number(e.target.value); ch.player.i = 0; ch.lastAnim = e.target.selectedOptions[0].textContent; });
  $('c-play').onclick = () => { ch.player.playing = !ch.player.playing; $('c-play').textContent = ch.player.playing ? '⏸' : '▶'; };
  const reproc = debounce(processChar, 120);
  document.querySelectorAll('#tab-char .side input, #tab-char .side select').forEach((el) => { if (['c-file', 'c-desc', 'c-seed', 'c-style', 'c-view', 'c-name', 'c-scale', 'ai-key'].includes(el.id)) return; el.addEventListener('input', reproc); el.addEventListener('change', reproc); });

  function drawSheet(p) {
    const pack = p === 'c' ? ch.pack : vfx.pack; if (!pack) return;
    const z = num(p + '-zoom'); const cv = $(p + '-sheet'); SG.toCanvas(pack.sheet, z, cv);
    const x = cv.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 1;
    for (let i = 1; i < pack.sheet.w / pack.cw; i++) { x.beginPath(); x.moveTo(i * pack.cw * z + 0.5, 0); x.lineTo(i * pack.cw * z + 0.5, cv.height); x.stroke(); }
    for (let j = 1; j < pack.sheet.h / pack.ch; j++) { x.beginPath(); x.moveTo(0, j * pack.ch * z + 0.5); x.lineTo(cv.width, j * pack.ch * z + 0.5); x.stroke(); }
  }
  $('c-zoom').addEventListener('input', () => drawSheet('c'));

  async function exportPack(pack, base, k, what, kind) {
    if (!pack) return toast('還沒有內容可以匯出');
    base = SG.safeName(base); const png = base + '.png'; const sheet = SG.scaleImg(pack.sheet, k);
    const blob = await SG.pngBlob(sheet);
    const tres = SG.spriteFramesTres(pack, png, k); const json = SG.sheetJson(pack, png, k);
    if (what === 'png') return SG.download(blob, png);
    if (what === 'tres') return SG.download(new Blob([tres], { type: 'text/plain' }), base + '.tres');
    if (what === 'json') return SG.download(new Blob([json], { type: 'application/json' }), base + '.json');
    const zip = await SG.zip([{ name: png, data: blob }, { name: base + '.tres', data: tres }, { name: base + '.json', data: json }, { name: 'README_Godot.txt', data: SG.GODOT_README(kind, base) }]);
    SG.download(zip, base + '.zip'); toast('已下載 ' + base + '.zip');
  }
  const cExp = (w) => () => exportPack(ch.pack, $('c-name').value, num('c-scale'), w, 'sprite');
  $('c-zip').onclick = cExp('zip'); $('c-png').onclick = cExp('png'); $('c-tres').onclick = cExp('tres'); $('c-json').onclick = cExp('json');

  // ================= VFX =================
  const vfx = { type: 'explosion', pack: null, player: Player($('v-preview')) };
  fillSelect('v-ramp', SG.RAMPS, 'fire');
  ['v-scale', 'v-dens', 'v-gamma'].forEach((i) => bindVal(i, (v) => v + '%'));
  $('v-types').innerHTML = Object.entries(SG.VFX).map(([k, v]) => `<button data-type="${k}" class="${k === vfx.type ? 'on' : ''}">${v.name}</button>`).join('');
  $('v-types').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; vfx.type = b.dataset.type; const d = SG.VFX[vfx.type];
    $('v-types').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    $('v-frames').value = d.frames; $('v-ramp').value = d.ramp; $('v-name').value = 'vfx_' + vfx.type; buildVfx();
  });
  function rampView() { $('v-ramp-view').innerHTML = SG.RAMPS[$('v-ramp').value].c.map((c) => `<span style="background:${SG.toHex(c)}"></span>`).join(''); }
  function buildVfx() {
    rampView();
    vfx.pack = SG.buildVfx({
      type: vfx.type, size: num('v-size'), frames: Math.max(2, Math.min(32, num('v-frames') || 8)), fps: Math.max(1, num('v-fps') || 12), seed: num('v-seed'),
      ramp: $('v-ramp').value, scale: num('v-scale') / 100, density: num('v-dens') / 100, gamma: num('v-gamma') / 100,
      dither: $('v-dither').checked, outline: $('v-outline').checked, sy: $('v-flat').checked ? 0.5 : 1, cutoff: true,
    });
    vfx.player.pack = vfx.pack; vfx.player.row = 0; drawSheet('v');
    $('v-meta').textContent = `${vfx.pack.cw}×${vfx.pack.ch} × ${vfx.pack.rows[0].count} 影格 · 表 ${vfx.pack.sheet.w}×${vfx.pack.sheet.h}${vfx.pack.rows[0].loop ? ' · 循環' : ''}`;
  }
  const rebuildVfx = debounce(buildVfx, 80);
  document.querySelectorAll('#tab-vfx .side input, #tab-vfx .side select').forEach((el) => { if (['v-name', 'v-scale-out'].includes(el.id)) return; el.addEventListener('input', rebuildVfx); el.addEventListener('change', rebuildVfx); });
  $('v-dice').onclick = () => { $('v-seed').value = Math.floor(Math.random() * 99999); buildVfx(); };
  $('v-play').onclick = () => { vfx.player.playing = !vfx.player.playing; $('v-play').textContent = vfx.player.playing ? '⏸' : '▶'; };
  $('v-zoom').addEventListener('input', () => drawSheet('v'));
  const vExp = (w) => () => exportPack(vfx.pack, $('v-name').value, num('v-scale-out'), w, 'vfx');
  $('v-zip').onclick = vExp('zip'); $('v-png').onclick = vExp('png'); $('v-tres').onclick = vExp('tres');

  // ================= 圖塊 =================
  const tiles = { ts: null, map: null, mapSeed: 3, upperImg: null, lowerImg: null };
  fillSelect('t-upper', SG.TERRAINS, 'grass'); fillSelect('t-lower', SG.TERRAINS, 'dirt');
  bindVal('t-depth'); bindVal('t-rough', (v) => v + '%');
  const tMode = segmented('t-mode', () => { syncMode(); buildTiles(); });
  const tSrc = segmented('t-src', () => buildTiles());
  function syncMode() { document.querySelectorAll('[data-mode]').forEach((n) => (n.style.display = tMode() === n.dataset.mode ? '' : 'none')); }
  syncMode();
  function buildTiles() {
    try {
      const pk = $('t-pal').value; const pal = pk === 'none' || pk === 'auto' ? null : SG.PALETTES[pk].colors;
      const useAi = tSrc() === 'ai';
      tiles.ts = SG.buildTileset({
        size: num('t-size'), seed: num('t-seed'), upper: $('t-upper').value, lower: $('t-lower').value, variants: Math.max(0, Math.min(8, num('t-var'))),
        rough: num('t-rough') / 100, border: $('t-border').checked, shadow: $('t-shadow').checked, palette: pal,
        iso: tMode() === 'iso', depth: num('t-depth'), upperImg: useAi ? tiles.upperImg : null, lowerImg: useAi ? tiles.lowerImg : null,
      });
      const z = num('t-zoom'); const cv = $('t-sheet'); SG.toCanvas(tiles.ts.sheet, z, cv);
      const x = cv.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,0.15)';
      for (let i = 1; i < tiles.ts.sheet.w / tiles.ts.tw; i++) { x.beginPath(); x.moveTo(i * tiles.ts.tw * z + 0.5, 0); x.lineTo(i * tiles.ts.tw * z + 0.5, cv.height); x.stroke(); }
      for (let j = 1; j < tiles.ts.sheet.h / tiles.ts.th; j++) { x.beginPath(); x.moveTo(0, j * tiles.ts.th * z + 0.5); x.lineTo(cv.width, j * tiles.ts.th * z + 0.5); x.stroke(); }
      drawMap();
      $('t-meta').textContent = `${tiles.ts.tiles.length} 個圖塊 · ${tiles.ts.tw}×${tiles.ts.th} · 表 ${tiles.ts.sheet.w}×${tiles.ts.sheet.h}`;
      const nm = $('t-name'); if (!nm.dataset.touched) nm.value = `tiles_${$('t-upper').value}_${$('t-lower').value}${tiles.ts.iso ? '_iso' : ''}`;
    } catch (e) { console.error(e); status('t-status', '生成失敗：' + e.message, 'err'); }
  }
  function drawMap() {
    if (!tiles.ts) return; const T = tiles.ts.T; const n = tiles.ts.iso ? Math.round(160 / T) + 4 : Math.round(384 / T);
    tiles.map = SG.previewMap(tiles.ts, n, tiles.ts.iso ? n : Math.round(n * 0.6), tiles.mapSeed); SG.toCanvas(tiles.map, num('t-mapzoom'), $('t-map'));
  }
  $('t-name').addEventListener('input', () => ($('t-name').dataset.touched = 1));
  const rebuildTiles = debounce(buildTiles, 100);
  document.querySelectorAll('#tab-tiles .side input, #tab-tiles .side select').forEach((el) => { if (['t-name', 't-scale-out', 't-upper-desc', 't-lower-desc', 't-style'].includes(el.id)) return; el.addEventListener('input', rebuildTiles); el.addEventListener('change', rebuildTiles); });
  $('t-zoom').addEventListener('input', buildTiles); $('t-mapzoom').addEventListener('input', drawMap);
  $('t-remap').onclick = () => { tiles.mapSeed++; drawMap(); };
  $('t-aigen').onclick = async () => {
    const ud = $('t-upper-desc').value.trim() || SG.TERRAINS[$('t-upper').value].name, ld = $('t-lower-desc').value.trim() || SG.TERRAINS[$('t-lower').value].name;
    const btn = $('t-aigen'); btn.disabled = true; status('t-status', 'AI 生成材質中…（兩張，約 10–60 秒）', 'busy');
    try {
      const st = $('t-style').value; const s = num('t-seed');
      const [a, b] = await Promise.all([SG.aiGenerate(SG.aiPrompt('texture', ud, st), s, 512), SG.aiGenerate(SG.aiPrompt('texture', ld, st), s + 1, 512)]);
      tiles.upperImg = SG.fromCanvasSource(a, 512); tiles.lowerImg = SG.fromCanvasSource(b, 512); buildTiles(); status('t-status', 'AI 材質完成，已套用到圖塊。');
    } catch (e) { status('t-status', e.limit ? `⚠ ${e.message}。目前保留程序材質；可到 enter.pollinations.ai 免費申請 API Key 後再試。` : e.message, 'err'); }
    btn.disabled = false;
  };
  async function exportTiles(what) {
    if (!tiles.ts) return; const base = SG.safeName($('t-name').value); const k = num('t-scale-out'); const png = base + '.png';
    const blob = await SG.pngBlob(SG.scaleImg(tiles.ts.sheet, k)); const tres = SG.tileSetTres(tiles.ts, png, k);
    if (what === 'png') return SG.download(blob, png);
    if (what === 'tres') return SG.download(new Blob([tres], { type: 'text/plain' }), base + '.tres');
    if (what === 'map') return SG.download(await SG.pngBlob(SG.scaleImg(tiles.map, k)), base + '_preview.png');
    const zip = await SG.zip([{ name: png, data: blob }, { name: base + '.tres', data: tres }, { name: 'README_Godot.txt', data: SG.GODOT_README('tiles', base) }]);
    SG.download(zip, base + '.zip'); toast('已下載 ' + base + '.zip');
  }
  $('t-zip').onclick = () => exportTiles('zip'); $('t-png').onclick = () => exportTiles('png'); $('t-tres').onclick = () => exportTiles('tres'); $('t-mapdl').onclick = () => exportTiles('map');

  // ---------- 初始化：先放一個程序生成角色做示範 ----------
  (function init() {
    const r = SG.proceduralCharacter($('c-desc').value, num('c-seed'));
    setSource(r.img, true, '示範：程序生成角色。上傳你的角色圖或改用 AI 生成。');
    let tab = null; try { tab = localStorage.getItem('pf-tab'); } catch (e) {}
    if (tab) { const b = document.querySelector(`.tab[data-tab="${tab}"]`); if (b) b.click(); }
  })();
})();
