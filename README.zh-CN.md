# 图片拼接助手

> [**English**](./README.md) · [中文版](./README.zh-CN.md)

在浏览器本地将多张图片无缝拼接成一张长图，无需上传、无需安装。

![图片拼接助手截图](about.png)

## 功能特性

- **多种输入方式** — 支持拖拽、文件选择和剪贴板粘贴；上传与排序完全支持键盘操作。
- **三种布局** — 纵向、横向和网格，可选在图片之间加入波浪分隔线。
- **主题切换** — 深色与浅色主题，自动记住上次的选择。
- **100% 本地、保护隐私** — 图片仅在浏览器 Canvas 中处理，绝不会上传到任何服务器。
- **安全限制** — 单张图片不超过 10 MiB，宽高比不超过 30:1；为避免浏览器内存耗尽，输出限制在最长边 8192 px、总计 2,000 万像素以内，必要时会等比缩小。

## 技术栈

- React 19 + Vite 7
- [@dnd-kit](https://dndkit.com/) 实现拖拽排序
- 原生 Canvas API 完成拼接与 PNG 编码
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
```

## 部署

默认构建面向根路径站点。若部署到 GitHub Pages 等仓库子路径，请在构建时提供路径：

```bash
VITE_BASE_PATH=/repository-name/ npm run build
```

静态托管平台应将构建命令设为 `npm run build`，发布目录设为 `dist`。

## 项目结构

- `src/lib/imageIntake.js`：图片验证、数量限制和 Object URL 生命周期。
- `src/lib/stitchLayout.js`：三种布局的几何计算与 seam 数据。
- `src/lib/stitchRenderer.js`：Canvas 绘制、输出限额和 PNG 编码。
- `src/components/`：上传、排序预览、设置和结果交互。

## 开源协议

[MIT](./LICENSE) © Yishan
