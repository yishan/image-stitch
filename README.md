# 图片拼接助手

本地浏览器中的图片拼接工具：上传、粘贴或拖入最多 6 张图片，调整顺序后生成横向、纵向或网格拼图，并可复制或下载 PNG。

## 功能与限制

- 支持拖拽、文件选择和粘贴图片；可用键盘操作上传和排序。
- 支持横向、纵向、网格三种布局，以及波浪分隔线。
- 图片只在浏览器 Canvas 中处理，不会上传到服务器。
- 单张图片文件不能超过 10 MiB；宽高比不能超过 30:1。
- 为避免浏览器内存耗尽，输出会限制在最大边长 8192px 和 2,000 万像素以内；必要时会等比缩小。

## 本地开发

需要 Node.js 20.19 或更高版本，推荐使用仓库中的 Node 22 配置：

```bash
nvm use
npm ci
npm run dev
```

常用检查：

```bash
npm test
npm run lint
npm run build
npm run preview
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
