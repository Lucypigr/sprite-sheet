# Pixel Forge 像素工坊

免費、純前端的像素風素材生成器，產出可直接放進 **Godot 4** 的檔案：

- **角色 Sprite Sheet**：上傳角色圖片、用 AI 文字生成（免費的 Pollinations.ai），或離線程序生成 →
  自動去背、像素化、套調色盤、加外框 → 自動產生 待機 / 走路 / 跑步 / 攻擊 / 跳躍 / 受傷 / 死亡 / 施法 動畫，可同時輸出左右兩向。
- **VFX 特效**：16 種程序生成特效（爆炸、火焰、斬擊、打擊火花、魔法陣、閃電、治療、冰刺、傳送門、衝擊波、煙霧、火球、閃光、塵土、水花、噴血），
  10 組配色、抖動、2.5D 地面透視。
- **地圖圖塊**：12 種地形，兩兩組合出 16 張角落自動拼接圖塊 + 變化款，支援 2D 正方形與 **2.5D 等角（含方塊厚度）**，可用 AI 生成材質。

## 匯出

| 類型 | 檔案 |
| --- | --- |
| 角色 / VFX | `PNG` + Godot `SpriteFrames .tres`（含每個動畫的 FPS、循環）+ Aseprite 相容 `.json` |
| 圖塊 | `PNG` + Godot `TileSet .tres`（Terrain Set 已設定 Match Corners，可直接用地形筆刷畫） |

在 Godot 中請將 **Project Settings → Rendering → Textures → Default Texture Filter** 設為 `Nearest`。

## 使用

不需要建置，直接開啟 `index.html` 即可（也可用 GitHub Pages 部署）。

```bash
python3 -m http.server 8000
```

所有影像處理都在瀏覽器本機完成；只有使用 AI 生成時會把文字描述送到 Pollinations.ai。
