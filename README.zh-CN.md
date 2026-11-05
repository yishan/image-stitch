# 图片拼接助手

> [**English**](./README.md) · [中文版](./README.zh-CN.md)

在浏览器本地将多张图片无缝拼接成一张长图，无需上传、无需安装。

![图片拼接助手截图](about.png)

## 功能特性

- **多种输入方式** — 支持拖拽、文件选择和剪贴板粘贴；上传与排序完全支持键盘操作。
- **多种布局** — 纵向、横向、自动网格，以及 2×2 / 1+2 / 1+3 固定单元格预设；自由布局可选波浪接缝，网格预设使用直边拼缝。
- **导出可控** — PNG / JPEG / WebP，JPEG / WebP 可调质量；尺寸预设包含原始尺寸（安全上限）、长图模式、长边 4096 px、宽 1080 px 与自定义长边。
- **长图模式** — 放松最长边到 16,384 px、上限 2,000 万像素。支持 18 MP 画布的浏览器（Chrome / 桌面）下，6 张手机截图可保持原始宽度；运行时检测到 WebKit 约 16 MP 的画布上限时会自动回退到 16 MP，并在结果条标注。
- **版式参数** — 外边距、图片间距、背景色（透明 / 纸色 / 白 / 墨 / 自定义）、直边模式的圆角，以及三档波浪接缝强度；小图不会被放大，会按原始尺寸居中留白。
- **每图调整** — 选中缩略图后可旋转 90°、水平/垂直翻转、切换「适配 / 填满」，在固定网格中选择焦点位置或重置该图；所有操作可撤销并随会话恢复。
- **输出信息可见** — 实时显示成品格式、像素尺寸与文件体积；触及上限时会标注「已按上限缩放」。
- **长图预览** — 可切换「适应整图 / 适应宽度」，长图按宽度查看时可在舞台内纵向滚动细节。
- **会话恢复** — 图片、顺序与全部设置自动保存在本机 IndexedDB，刷新/崩溃后可恢复；设置面板可一键清除本机会话。
- **快捷键与撤销** — `⌘/Ctrl+Z` 撤销、`⇧⌘/Ctrl+Z` 重做、`⌘/Ctrl+S` 下载、`Delete` 删除选中图片；设置滑块合并为一步历史。
- **主题切换** — 默认跟随系统，手动切换后会记住你的选择；切换时不触发过渡闪烁。
- **100% 本地、保护隐私** — 图片仅在浏览器 Canvas 中处理，绝不会上传到任何服务器。
- **安全限制** — 单张图片不超过 10 MiB，宽高比不超过 30:1；单图解码总量与输出像素都有上限（默认最长边 8192 px，长图模式 16,384 px，总计 2,000 万像素），超出时会等比缩小并提示；大画布会先探测浏览器能力，避免在画布上限较低的设备上导出空白图。

## 技术栈

- React 19 + Vite 7
- [@dnd-kit](https://dndkit.com/) 实现拖拽排序
- 原生 Canvas API 完成拼接与编码
- Playwright 负责端到端回归（上传/布局/导出/长图/隐私/会话）
- Node.js ≥ 20.19（见 `.nvmrc`）

## 本地开发

```bash
nvm use
npm ci
npm run dev
```

常用检查：

```bash
npm test        # 运行单元测试（node --test）
npm run lint    # 运行 ESLint
npm run build   # 生产构建到 dist/
npm run preview # 预览生产构建
npm run e2e     # Playwright 端到端（首次需 npx playwright install chromium）
```

## 部署

默认构建面向根路径站点。若部署到 GitHub Pages 等仓库子路径，请在构建时提供路径：

```bash
VITE_BASE_PATH=/repository-name/ npm run build
```

静态托管平台应将构建命令设为 `npm run build`，发布目录设为 `dist`。

## 项目结构

- `src/lib/imageIntake.js`：图片验证、数量限制和 Object URL 生命周期。
- `src/lib/imageTransform.js`：每图旋转/翻转/填充/焦点的归一化与不可变更新。
- `src/lib/stitchLayout.js`：纵向/横向/自动网格/固定网格预设的几何计算与 seam 数据。
- `src/lib/stitchRenderer.js`：Canvas 绘制、导出规格/限额、编码与解码缓存。
- `src/lib/sessionStore.js`：本机会话（IndexedDB）读写与清除。
- `src/lib/history.js`：撤销/重做历史栈。
- `src/components/`：上传、排序预览、设置面板、舞台与结果交互。
- `e2e/`：Playwright 用例、fixtures 与辅助函数。
- `docs/DESIGN.md`：视觉与交互规则（token、状态、动效）。
- `docs/ROADMAP.md`：能力路线图与优先级；`docs/TODO.md`：P0–P2 核查清单。

## 开源协议

[MIT](./LICENSE) © Yishan
