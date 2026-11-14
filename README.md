# JCJS · 异境

原生 HTML、CSS 和 Canvas 网站，无前端构建步骤。页面依次呈现异境、未竟之塔、横向画廊、UNION、JOIN US 和页脚。

## 本地预览

在项目根目录运行：

```sh
python3 -m http.server 8000
```

访问 http://localhost:8000。JavaScript 使用浏览器原生 ES Modules，需要通过 HTTP 访问。发布时保留 `index.html`、`src/`、`styles/` 和 `assets/` 的目录关系即可。

## 代码结构

| 位置 | 职责 |
| --- | --- |
| `index.html` | 页面结构、无障碍标记与首屏保护 |
| `src/main.js` | 初始化、页面切换、键盘、滚轮与触摸输入 |
| `src/core/motion.js` | 贝塞尔曲线与共享标志动效 |
| `src/intro/intro.js` | 开场动画时间轴、重播、跳过与缩放 |
| `src/effects/` | 视差和塔粒子效果 |
| `src/gallery/gallery.js` | 横向画廊、页面进度与页脚平移 |
| `src/artwork/` | 海报、UNION 画面和共享纸张纹理 |
| `src/join/` | JOIN US 印刷画面与链接交互 |
| `styles/` | 按基础场景、开场、海报、无障碍、转场、画廊、JOIN 分组的样式，加载顺序由 HTML 固定 |
| `assets/brand/` | 品牌 SVG |
| `assets/images/` | 浏览器实际加载的图片，包括无脚本回退图 |
| `artwork/sources/` | 生成天空、地面 WebP 所需的原始素材，不参与页面加载 |
| `scripts/build_assets.py` | 生成天空、地面及灰阶塔 WebP |

模块通过 `import` / `export` 声明依赖；共享纸张纹理由独立模块缓存。开场前的短内联脚本保留在 HTML 中，避免首次绘制闪烁，并在模块加载失败时定时解除黑屏。

## 素材重建

已提交运行资源，日常预览无需重建。修改原始素材后，安装 Pillow 并运行：

```sh
python3 -m pip install Pillow
python3 scripts/build_assets.py
```

塔与石头 PNG 直接用于页面；塔 PNG 也是灰阶塔 WebP 的输入。不要删除这些文件或无脚本回退图。

## 交互与检查

- 滚轮、上下方向键、PageUp / PageDown 或纵向触摸拖动切换场景。
- 在第二页按 End 到页脚，Home 回到海报；反向翻页可返回异境。
- F 切换全屏，异境中 R 重播开场，空格暂停 / 恢复视差，Escape 跳过开场。
- `?page=join` 可直接预览 JOIN US；系统减少动态效果设置会跳过开场并减少动画。
- 修改后检查桌面与窄屏的完整正向 / 反向浏览、JOIN US 链接范围、窗口缩放、图片加载和浏览器控制台。

原项目没有独立测试文件。本次移除了生产页面中的开场测试全局变量和 `intro-seek` 调试入口。临时浏览器验证脚本和截图保存在项目外，不纳入发布内容。

## 整理与回退

整理前的完整快照是 Git 提交 `f2c4e2b`。移除的两份参考视频、平面设计参考图和未引用蓝天图仍可从该提交恢复。视觉参数和画面算法保持原有设计。

代码格式配置在 `.prettierrc.json`，可用 Prettier 统一格式：

```sh
npx prettier --write 'src/**/*.js' 'styles/*.css' index.html
```
