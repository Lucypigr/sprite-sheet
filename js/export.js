/* 匯出：PNG、Godot 4 .tres（SpriteFrames / TileSet）、JSON、ZIP（無外部依賴） */
(function () {
  const SG = window.SG;

  SG.scaleImg = function (im, k) {
    if (k === 1) return im; const o = SG.img(im.w * k, im.h * k);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const s = ((Math.floor(y / k)) * im.w + Math.floor(x / k)) * 4, d = (y * o.w + x) * 4; for (let c = 0; c < 4; c++) o.d[d + c] = im.d[s + c]; }
    return o;
  };
  SG.pngBlob = function (im) { return new Promise((res) => SG.toCanvas(im, 1).toBlob(res, 'image/png')); };
  SG.download = function (blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  SG.safeName = (s) => (s || 'sprite').trim().replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'sprite';

  // ---------- Godot 4 SpriteFrames ----------
  SG.spriteFramesTres = function (pack, pngName, k) {
    k = k || 1; const subs = []; const anims = []; let id = 0;
    for (const r of pack.rows) {
      const frames = [];
      for (let i = 0; i < r.count; i++) {
        const sid = 'AtlasTexture_' + (id++);
        subs.push(`[sub_resource type="AtlasTexture" id="${sid}"]\natlas = ExtResource("1_sheet")\nregion = Rect2(${i * pack.cw * k}, ${r.row * pack.ch * k}, ${pack.cw * k}, ${pack.ch * k})\n`);
        frames.push(`{\n"duration": 1.0,\n"texture": SubResource("${sid}")\n}`);
      }
      anims.push(`{\n"frames": [${frames.join(', ')}],\n"loop": ${r.loop ? 'true' : 'false'},\n"name": &"${r.name}",\n"speed": ${Number(r.fps).toFixed(1)}\n}`);
    }
    return `[gd_resource type="SpriteFrames" load_steps=${subs.length + 2} format=3]\n\n[ext_resource type="Texture2D" path="res://${pngName}" id="1_sheet"]\n\n${subs.join('\n')}\n[resource]\nanimations = [${anims.join(', ')}]\n`;
  };

  // ---------- Godot 4 TileSet（Terrain: Match Corners）----------
  SG.tileSetTres = function (ts, pngName, k) {
    k = k || 1; const iso = ts.iso;
    const names = iso ? ['top_corner', 'right_corner', 'left_corner', 'bottom_corner'] : ['top_left_corner', 'top_right_corner', 'bottom_left_corner', 'bottom_right_corner'];
    const lines = [];
    const countBy = {};
    for (const t of ts.tiles) {
      const key = `${t.x}:${t.y}/0`; const up = t.corners.reduce((a, b) => a + b, 0);
      countBy[t.corners.join('')] = (countBy[t.corners.join('')] || 0) + 1;
      lines.push(`${key} = 0`);
      if (iso && ts.depth) lines.push(`${key}/texture_origin = Vector2i(0, ${-Math.round(ts.depth * k / 2)})`);
      lines.push(`${key}/terrain_set = 0`);
      lines.push(`${key}/terrain = ${up >= 2 ? 1 : 0}`);
      t.corners.forEach((c, i) => lines.push(`${key}/terrains_peering_bit/${names[i]} = ${c}`));
      if (t.variant) lines.push(`${key}/probability = 0.25`);
    }
    const col = (c) => `Color(${(c[0] / 255).toFixed(3)}, ${(c[1] / 255).toFixed(3)}, ${(c[2] / 255).toFixed(3)}, 1)`;
    return `[gd_resource type="TileSet" load_steps=3 format=3]\n\n[ext_resource type="Texture2D" path="res://${pngName}" id="1_tiles"]\n\n[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]\ntexture = ExtResource("1_tiles")\ntexture_region_size = Vector2i(${ts.tw * k}, ${ts.th * k})\n${lines.join('\n')}\n\n[resource]\n${iso ? 'tile_shape = 1\n' : ''}tile_size = Vector2i(${(iso ? ts.T * 2 : ts.T) * k}, ${ts.T * k})\nterrain_set_0/mode = 1\nterrain_set_0/terrain_0/name = "${ts.lower}"\nterrain_set_0/terrain_0/color = ${col(ts.lowerColor)}\nterrain_set_0/terrain_1/name = "${ts.upper}"\nterrain_set_0/terrain_1/color = ${col(ts.upperColor)}\nsources/0 = SubResource("TileSetAtlasSource_1")\n`;
  };

  SG.sheetJson = function (pack, pngName, k) {
    k = k || 1; const frames = {}; const tags = [];
    for (const r of pack.rows) {
      tags.push({ name: r.name, from: Object.keys(frames).length, to: Object.keys(frames).length + r.count - 1, direction: 'forward', fps: r.fps, loop: r.loop });
      for (let i = 0; i < r.count; i++) frames[`${r.name}_${i}`] = { frame: { x: i * pack.cw * k, y: r.row * pack.ch * k, w: pack.cw * k, h: pack.ch * k }, duration: Math.round(1000 / r.fps) };
    }
    return JSON.stringify({ frames, meta: { app: 'Pixel Forge', image: pngName, size: { w: pack.sheet.w * k, h: pack.sheet.h * k }, frameTags: tags, scale: '1' } }, null, 2);
  };

  // ---------- ZIP（store，不壓縮）----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  SG.zip = async function (files) {
    const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
    for (const f of files) {
      const data = typeof f.data === 'string' ? enc.encode(f.data) : new Uint8Array(await f.data.arrayBuffer());
      const name = enc.encode(f.name); const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  };

  SG.RIG_README = (base) => `
骨架場景（進階）
----------------
${base}_rig/${base}_rig.tscn 是 Skeleton2D 骨架場景，每個部位是一張獨立 PNG，綁在對應的 Bone2D 上。
想自己做更多動作：把場景拖進遊戲場景，加一個 AnimationPlayer，對各個 Bone2D 的 rotation 打關鍵影格即可。
`;
  SG.GODOT_README = (kind, base) => `Pixel Forge 匯出檔 —— Godot 4 使用說明
=========================================

1. 把整個資料夾內的檔案複製到 Godot 專案根目錄（res://）。
   （.tres 內的路徑為 res://${base}.png，若放在子資料夾請在 Godot 內重新指定貼圖，或用文字編輯器修改路徑。）
2. 像素風請設定：專案設定 > Rendering > Textures > Canvas Textures > Default Texture Filter = Nearest。
${kind === 'sprite' ? `3. 新增 AnimatedSprite2D 節點 → Sprite Frames 屬性 → 載入 ${base}.tres，即可看到所有動畫（含 FPS 與是否循環）。
   程式範例：$AnimatedSprite2D.play("walk")
4. 也可用 ${base}.json（Aseprite 相容格式）給其他引擎或工具。` : kind === 'tiles' ? `3. 新增 TileMapLayer 節點 → Tile Set 屬性 → 載入 ${base}.tres。
4. 在 TileMap 面板切到「Terrains」分頁，選擇 Terrain Set 0 的地形，直接用筆刷畫地圖即可自動拼接（Match Corners 模式）。
   全填滿的變化款圖塊已設定較低機率，會隨機穿插增加自然感。
5. 2.5D 等角圖塊：tile_shape 已設為 Isometric；若方塊高度位置需要微調，請調整每個圖塊的 Texture Origin。` : `3. 新增 AnimatedSprite2D → 載入 ${base}.tres，呼叫 play() 播放；非循環特效可在 animation_finished 訊號時 queue_free()。`}
`;
})();
