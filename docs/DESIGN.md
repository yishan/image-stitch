# 视觉与交互规则（Design notes)

> 2026-11 改版后的设计约束。改 UI 前先读这里：token、层级、状态系统都在这一份里。
> 方向：**暗房工作台 / 接触印相（contact sheet）**——暖纸、墨色、唯一的安全灯橙红；等宽数字记录尺寸；细线分隔；波浪接缝是产品签名。

## 1. Token（`src/index.css`）

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--paper` | `#f6f3ed` | `#13110f` | 页面底色 |
| `--surface` | `#fffefc` | `#1e1b18` | 控件/卡片表面 |
| `--surface-sunken` | `#efece5` | `#191613` | 按下、内嵌 |
| `--ink` | `#201c17` | `#eae7e2` | 正文、主按钮底 |
| `--ink-soft` | `#57524a` | `#a5a199` | 次要文字 |
| `--ink-faint` | `#6d6861` | `#8a857e` | 元数据（≥4.5:1） |
| `--line` | `#d8d3cc` | `#33302c` | 装饰细线 |
| `--line-strong` | `#c9c4bc` | `#3a3631` | 图片/画布边框 |
| `--line-control` | `#847f7a` | `#736f6b` | 控件边界（≥3:1） |
| `--accent` | `#ca4b20` | `#f0834e` | 状态/焦点/接缝，不作正文 |
| `--accent-text` | `#b13c11` | `#f5a077` | accent 作链接文字时（≥4.5:1） |
| `--accent-ink` | `#fffefc` | `#13110f` | accent 底上的图形 |
| `--danger` | `#a51d2b` | `#e85f61` | 错误；**永不作主按钮** |
| `--checker-bg` / `--checker` | 固定值 | 固定值 | 透明 PNG 棋盘，刻意不随主题翻转 |

规则：所有正文/控件文字 ≥ 4.5:1，控件边界 ≥ 3:1。改色必须在这张表里加一行并实测对比度。

## 2. 字体与数字

- `--font-ui`：系统无衬线 + PingFang / 雅黑，离线可用，不加载 webfont。
- `--font-mono`：尺寸、编号、文件体积、`3 / 6` 一律用 `.mono` + `tabular-nums`。
- 字号：11 / 12 / 13 / 14 / 16 / 22。CJK 标题不用负字距；标题 `text-wrap: balance`。
- 中文 Windows 只有 400/700 两档字重，层级靠**字号 + 颜色 + 细线**，不要依赖 500/600 的细微差别。

## 3. 空间、圆角、深度

- 间距 4px 基数：4/8/12/16/20/24/32/40。面板内边距 24（移动端 16）。
- 圆角只有两档：控件 `--radius: 2px`，画框/缩略图/上传区 0。内嵌圆角 = 外圆角 − 内边距。
- **只用边框，不用阴影**；不用玻璃拟态、渐变按钮、发光。
- 焦点环：`outline: 2px solid var(--accent); outline-offset: 3px`，任何交互元素不得移除。

## 4. 组件规则

- **按钮**：一屏一个主行动（`.btn--primary`，墨色底/纸色字，15:1）。次要 `.btn--secondary`（细边框），文字按钮只用于「清空」这类破坏性/低频操作。禁用态用 token，不用 opacity。
- **分段控制**：2px 外框，选中项墨色实心、内圆角 0；移动端 / 粗指针 44px 高。
- **波浪接缝开关**：原生 checkbox + 18px 方框 + 正弦图形；选中时 accent 底 + `--accent-ink` 正弦。**不要**换回 iOS 胶囊开关。
- **上传区**：空态虚线框（`--line-control`），有图后收成 48px 单行「继续添加图片 + 3 / 6」。满 6 张禁用。
- **缩略图**：接触印相编号 `01`–`06`、完整图片 `object-fit: contain`、下方等宽原图尺寸、右下 28px 拖拽柄（命中区 44px）、右上移除（命中区 44px，触屏常显）。
- **舞台**：四角 10px 定位标记；图片四边细框 + 固定棋盘格（保证同一张透明导出在深浅主题下观感一致）；下方左「输出 W × H px · 体积」，右操作按钮。
- **移动端**：底栏 sticky + `env(safe-area-inset-bottom)`；页面不出现横向滚动。

## 5. 动效

- 只动 `background-color / border-color / color / opacity / transform`；120–180ms，`ease-out`；按下 `translateY(1px)`。
- 主题切换时给 `<html>` 加 `.theme-switching` 屏蔽所有过渡，避免级联闪烁。
- 尊重 `prefers-reduced-motion`（全局已在 `index.css` 处理）。
- 长于 400ms 的操作必须有指示；加载用 2px 进度线，不用 spinner。

## 6. 内容与语义

- 文案具体：「下载 PNG」「已复制」「图片宽高比不能超过 30:1。」。
- 图片 `alt` 带序号和尺寸；图标按钮必须有 `aria-label`；动态消息放进**始终挂载**的 `role="status"` 区域。
- 隐私是产品卖点：页脚常驻「图片只在本地处理，不会上传」。

## 7. 已知边界（见 `docs/ROADMAP.md`）

- 输出仍固定 PNG，且最长边 8192px / 20MP 会静默缩放（界面已标注「已按上限缩放」）。
- 背景色 / 间距 / 裁剪尚无 UI；`settings.backgroundColor` 已在渲染层存在。
- 刷新丢会话、无 ErrorBoundary、无 e2e。
