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
| `src/core/render-budget.js` | 根据设备能力限制画布采样尺寸及像素面积 |
| `src/intro/intro.js` | 开场动画时间轴、重播、跳过与缩放 |
| `src/effects/` | 视差和塔粒子效果 |
| `src/gallery/gallery.js` | 横向画廊、页面进度与页脚平移 |
| `src/artwork/` | 海报、UNION 画面和共享纸张纹理 |
| `src/join/` | JOIN US 印刷画面与链接交互 |
| `styles/` | 按基础场景、开场、海报、无障碍、转场、画廊、JOIN 分组的样式，加载顺序由 HTML 固定 |
| `assets/brand/` | 品牌 SVG |
| `assets/images/` | 浏览器实际加载的图片，包括无脚本回退图 |
| `scripts/build_assets.py` | 从塔 WebP 生成灰阶塔 WebP |

模块通过 `import` / `export` 声明依赖；共享纸张纹理由独立模块缓存。开场前的短内联脚本保留在 HTML 中，避免首次绘制闪烁，并在模块加载失败时定时解除黑屏。

## 素材重建

天空和地面直接使用已提交的 WebP；对应原始素材已删除，可从 Git 历史恢复。灰阶塔仍可从运行用的无损塔 WebP 重建：

```sh
python3 -m pip install Pillow
python3 scripts/build_assets.py
```

塔与石头 WebP 直接用于页面；塔 WebP 也是灰阶塔 WebP 的输入。不要删除这些文件或无脚本回退图。

## 交互与检查

- 滚轮、上下方向键、PageUp / PageDown 或纵向触摸拖动切换场景。
- 在第二页按 End 到页脚，Home 回到海报；反向翻页可返回异境。
- F 切换全屏，异境中 R 重播开场，空格暂停 / 恢复视差，Escape 跳过开场。
- `?page=join` 可直接预览 JOIN US；系统减少动态效果设置会跳过开场并减少动画。
- 修改后检查桌面与窄屏的完整正向 / 反向浏览、JOIN US 链接范围、窗口缩放、图片加载和浏览器控制台。

原项目没有独立测试文件。本次移除了生产页面中的开场测试全局变量和 `intro-seek` 调试入口。临时浏览器验证脚本和截图保存在项目外，不纳入发布内容。

## 整理与回退

整理前的完整快照是 Git 提交 `f2c4e2b`。移除的两份参考视频、平面设计参考图和未引用蓝天图仍可从该提交恢复。该整理提交保留了当时的视觉参数和画面算法。

代码格式配置在 `.prettierrc.json`，可用 Prettier 统一格式：

```sh
npx prettier --write 'src/**/*.js' 'styles/*.css' index.html
```

## 动效与内存

- 首页鼠标视差上限为美术坐标中的水平 12px、垂直 6px；触摸翻页不驱动视差。
- 塔的烟雾痕迹在连续划动时累积，停手 500ms 后用 2200ms 平滑恢复；恢复过程中再次划动会接续当前痕迹。
- 一、二页保留原有 980ms 分层转场。触屏、Android 或报告内存不高于 4GB 的设备限制位图采样尺寸；场景几何、颜色、图层及动画时序不做简化。
- 海报按需绘制，画廊素材在实际进入画廊时生成，返回海报时释放画廊主画布；横条只分配实际印刷区域的位图。相同尺寸的窗口事件不会重复分配整组画布。

画布像素面积只能估算位图开销，不能等同于浏览器的实际 GPU 内存。设备识别采用保守策略；出现过崩溃的 Android 设备仍需真机验证。
