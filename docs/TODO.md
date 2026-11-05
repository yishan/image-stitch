# 待办核查清单（P0–P2 · Sprint A / B）

> 用途：逐项核对「优化 / 提升」的执行状态与验收证据。改代码前先看这里，交付后更新状态。
> 基线：`43ae144`（Sprint A 已交付）。图例：`[ ]` 待办 · `[~]` 进行中 · `[x]` 完成 · `[!]` 阻塞（需真机/外部条件）。
> 相关文档：[ROADMAP.md](./ROADMAP.md)（战略与竞品依据）、[DESIGN.md](./DESIGN.md)（视觉/交互约束）。

## 0. 本轮 Sprint 安排（逐阶段执行）

| 阶段 | 内容 | 门禁 / 完成标准 | 状态 |
|---|---|---|---|
| **A0 质量基建** | Playwright e2e、CI、fixtures、零上传网络断言 | `npm run e2e` 本地全绿；CI 有 e2e job | ✅ 完成 |
| **A1 清残留 P2** | 缓存增删图复用、波浪缝线裁剪、StitchCanvas 拆分 | 单测 + e2e 覆盖；`StitchCanvas.jsx` 657→463 行 | ✅ 完成 |
| **A2 本地安全感** | 会话恢复（IndexedDB）、设置记忆、清除本机数据 | 刷新恢复图片/顺序/设置；清除后无记录 | ✅ 完成 |
| **A3 效率与可读性** | 快捷键、撤销/重做、长图预览适应宽度/缩放 | 全键盘流程；撤销/重做；长图可读 | ✅ 完成 |
| **B1 每图控制** | 旋转/翻转/contain-cover/焦点（X1） | 不裁切变形；预览=导出；可重置/撤销 | ✅ 完成 |
| **B2 布局预设** | 2×2、1+2、1+3、自动网格（X2） | 1–6 张确定性结果；几何单测 | ✅ 完成 |
| **B3 质量固化** | e2e 扩展、视觉回归、文档更新 | CI 全绿；README/DESIGN/ROADMAP 同步 | ✅ 完成 |
| **B4 拖拽焦点 + 缩放** | 焦点预览拖动、100–300% 缩放 + 方向键/预设兜底 | 单步撤销；不劫持滚动；触摸/鼠标可用 | ✅ 完成 |
| **B5 X3 切片/PDF** | 2048/4096/8192 切片、可排序命名、零依赖 PDF | 首尾无丢失；PDF 页数正确；全程本地 | ✅ 完成 |
| **B6 X4 本地打码** | 框选马赛克/色块、多区域、撤销/清除 | 导出无原像素；触摸可用；无外部请求 | ✅ 完成 |

> 真机验证（iPhone Safari 18MP 长图、iPad、Android）由用户另行执行，代码侧已提供 16MP 探测回退与本地诊断。

---

## 1. P0 — 质量与风险（本轮完成）

### P0-1 Playwright e2e + CI ✅
- [x] 安装 `@playwright/test`，`playwright.config.js`（desktop chromium + Pixel 7，webServer=build+preview，绑定 127.0.0.1）
- [x] fixtures：6 张竖图 + 混合尺寸 + 极端宽高比 + 小图
- [x] 用例：上传/移除/排序、三种布局、PNG/JPEG/WebP 下载（magic+dims）、长图模式、错误路径、**零上传网络断言**
- [x] 用例：会话恢复、快捷键/撤销、预览适应宽度、设置记忆/重置
- [x] `package.json` scripts：`e2e`、`e2e:ui`；`.gitignore` 忽略 `test-results/`、`playwright-report/`、`e2e/.preview-dist/`
- [x] CI：`e2e` job（`npx playwright install --with-deps chromium` + `npm run e2e`，失败上传报告）
- 验收：本地 `21 passed / 0 failed / 21 skipped`（另一 project 的条件跳过），`--repeat-each=2` 42 passed；单次 ~16–30s。

### P0-2 清残留 P2 ✅
- [x] **缓存增删图复用**：cache key 改为 `id|url`；预算变化时复用/缩放缓存位图；只有缓存小于目标时才重解码（`src/lib/renderCache.js`、`stitchRenderer.js`）。实测删一张图 `created` 3→3，不再重解码存活图。
- [x] **波浪缝线裁剪**：缝线只画在相邻图片交集内；共享 `phase` 保证混合尺寸连续（`stitchLayout.js`、`stitchRenderer.js`）；新增单测。
- [x] **StitchCanvas 拆分**：657 → 463 行；拆出 `StitchSettings`（221 行）、`StitchStage`、`SettingsFields`、`ui-icons`。
- [x] 单测：缓存预算变化（缩/扩/失败重试）、缝线交集与 phase、导出尺寸回归。
- 验收：lint/test/build 绿；e2e 长图/布局/导出全绿；窄图缝线不跨空白（由几何单测覆盖）。

### P0-3 真机验证（用户执行，代码侧支持）
- [!] iPhone Safari 长图 18MP → 16MP 回退是否正常
- [!] iPad 横屏触控目标 / Android Chrome 长图
- [ ] 代码侧「本地诊断」入口（画布能力/格式支持/渲染耗时，可复制、不上报）——可选加做

---

## 2. P1 — 本地安全感与效率（本轮完成）

### P1-1 会话恢复（N4，IndexedDB）✅
- [x] `src/lib/sessionStore.js`：图片 Blob/顺序存 `images` store、设置存 `settings` store；读取/清除；失败降级
- [x] 启动恢复；图片 500ms / 设置 350ms 分频保存；epoch + 签名防清除竞态；隐私文案
- [x] 设置面板 footer：保存状态 + 清除本机会话
- [x] 单测（`normalizeStoredImages` 排序/过滤/上限）+ e2e：刷新恢复 2 图 + 横向 + 间距 16；清除后 reload 为空
- 验收：刷新恢复；无上传请求（e2e 断言）；保存失败不阻塞主流程。

### P1-2 快捷键 + 撤销/重做（N5）✅
- [x] `src/lib/history.js`：past/present/future、12 步上限、设置滑块 600ms 合并、reset 单测
- [x] Object URL 生命周期：历史快照引用计数，撤销删除可恢复；不可达 URL 自动 revoke
- [x] `Cmd/Ctrl+Z`、`Shift+Cmd/Ctrl+Z`、`Cmd/Ctrl+S` 导出、`Delete` 删除选中缩略图
- [x] 设置面板 footer 快捷键提示
- [x] e2e：撤销上传/设置、重做、Delete、Ctrl+S 下载全绿
- 验收：全键盘完成上传→排序→调参→导出；无 URL 泄漏（引用计数 + 单测/e2e 覆盖）。

### P1-3 长图预览可读性 ✅
- [x] 工具栏「适应整图 / 适应宽度」切换；宽度模式纵向滚动，舞台高度不变
- [x] 按钮 aria-pressed + 粗指针 44px；`data-preview-mode` 供测试
- [x] e2e：宽度模式 `scrollHeight > clientHeight`、切换回整图
- 验收：6 张截图不再只剩细条；不改变导出结果（e2e 尺寸断言）。

### P1-4 设置记忆 + 恢复默认 ✅
- [x] 格式/质量/尺寸/版式/接缝/预览模式随会话写入 IndexedDB
- [x] 「恢复默认设置」按钮（独立历史步，可撤销）
- [x] e2e：间距 16 → reload 保留；恢复默认 → 0；Ctrl+Z 恢复 16
- 验收：默认流程仍是一键导出；e2e 覆盖。

---

## 3. P2 — 产品能力（Sprint B / 后续）

### B1 每图控制（X1）✅
- [x] B1.1 数据模型：`src/lib/imageTransform.js`，每图 `rotate/flipX/flipY/fit/focusX/focusY` 归一化；随会话/撤销保存；4 个纯函数单测
- [x] B1.2 旋转/翻转：布局前 90° 步进旋转（交换宽高）与镜像；渲染/缝线兼容
- [x] B1.3 适配：`contain` 不放大；`cover` 纵向/横向按交叉轴填满，固定网格内按 `focusX/focusY` 裁切
- [x] B1.4 UI：选中缩略图后的调整条（旋转、水平/垂直翻转、适配/填满、焦点九宫格、重置），触控 44px
- [x] B1.5 预览/导出同源；e2e：旋转/翻转/重置/撤销/cover/会话恢复；几何单测覆盖旋转宽高、cover、焦点像素
- 验收：任意宽高比混排不变形；焦点像素用 e2e 断言；可撤销。导出结果由 visual.spec.js 截图回归覆盖。

### B2 布局预设（X2）✅
- [x] B2.1 几何：`stitchLayout.js` 新增 `createGridPlan`；自动网格保留原 collage 行为
- [x] B2.2 新增预设：2×2、1+2、1+3（1–6 张确定性铺满；奇偶行自动跨满，无空洞）
- [x] B2.3 UI：`网格`方向下出现「网格布局」选择器；预览/导出共用同一 plan
- [x] B2.4 单测：1–6 张、无重叠/越界、2×2 奇偶行、1+2 hero 尺寸；e2e：2×2/1+2/1+3 结果尺寸 + 直边拼缝
- 验收：预设结果确定；e2e 覆盖尺寸；旧三种布局回归（44 条 e2e 全绿）。

### B3 质量固化 ✅
- [x] e2e 扩展：sprint-b.spec.js（12 条，含焦点像素、控件尺寸与拖拽焦点断言）
- [x] 视觉回归截图：visual.spec.js 3 条，导出结果按自然尺寸用 `toHaveScreenshot` 对比基线（`e2e/__screenshots__/`）
- [x] 文档同步：README / DESIGN / ROADMAP / TODO
- 拖拽焦点由 B4 交付（见下）

### B4 拖拽焦点 ✅
- [x] 单元格比例焦点预览；拖动图片设置 `focusX/focusY`，只有溢出轴移动
- [x] 焦点预览内缩放 100–300%，单元格尺寸不变，随会话/撤销保存
- [x] `touch-action: none` + pointer capture：不劫持页面滚动，不与 dnd-kit 缩略图排序冲突
- [x] 拖拽结束只写一条历史；方向键微调 600ms 合并；九宫格 select 保留为精确/键盘替代
- [x] e2e：桌面拖拽/撤销、方向键合并、拖拽/缩放会话恢复；移动端触摸拖拽不改滚动位置
- 已知取舍：拖拽过程中只更新焦点预览，主结果在释放后更新；单元格比例按预设近似，忽略 gap。

### B5 X3 切片 / PDF ✅
- [x] 切片高度 2048/4096/8192；按输出高度切分，`part-01-of-N` 可排序命名，主按钮显示切片数
- [x] 零依赖 PDF：每页一张切片/整图，JPEG 白底，`pdfinfo` 可读，页数与切片数一致
- [x] 单测覆盖范围切分、命名、PDF 结构；e2e 覆盖两张 PNG 切片尺寸与 PDF 页数

### B6 X4 本地打码 ✅
- [x] 结果图框选区域，导出前烘焙不可逆马赛克或纯色块；多区域
- [x] 马赛克/色块切换与色块选色；撤销上一处 / 清除全部；触摸框选不滚动页面；打码后复制/切片/PDF 共享
- [x] e2e 像素哈希前后变化 + 撤销恢复、色块像素校验；移动端触摸框选
- 已知取舍：打码区域按输出归一化，布局大改后可能偏移；打码状态不随 IndexedDB 会话保存（刷新清除）

### 后续（X5–X9 / moonshot）
- [ ] X5 PWA + 离线 + Share Target
- [ ] X6 i18n zh/en（6 张硬编码收敛）
- [ ] X9 EXIF/HEIC 提示与元数据回归
- [ ] L1 重叠感知长截图合并（spike 3–5 天，成功率 <70% 淘汰）
- [ ] 性能二期：预览画布 + 按需/Worker 编码（PNG 编码约 320–350ms → 目标调参 <150ms）
- [ ] Quick wins：下载命名模板、复制格式选择、诊断报告、页脚隐私自证

### 明确不做
- 云端存储/账号/分享链接、模板商城、贴纸文字/完整编辑器、AI 修图、无限画布、原生 App。

---

## 4. 验证命令

```bash
npm run lint            # ESLint
npm test                # node --test（当前 59 用例）
npm run build           # 生产构建
npm run e2e             # Playwright（当前 44 条；本地需 PLAYWRIGHT_BROWSERS_PATH 或已安装浏览器）
npm run e2e -- --ui     # 交互调试
```

本地首次跑 e2e（浏览器装在 /tmp，避免写系统缓存）：

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers npm run e2e
```

## 5. Sprint B 交付证据（2026-11-05）

- **单测**：`npm test` → 69/69。新增 `imageTransform.test.js`（归一化/宽高交换/不可变更新）与 `stitchLayout.test.js` 新增 9 条（旋转、cover、2×2 奇偶行、1+2 hero、焦点透传、单元格比例、zoom 透传、1–6 张边界）。
- **e2e**：`npm run e2e` → 44 passed / 0 failed / 44 skipped（另一 project 条件跳过）。`sprint-b.spec.js` 13 条覆盖旋转/翻转/重置、撤销、混排 cover、会话恢复、2×2、1+2/1+3、焦点像素、拖拽/方向键/缩放/会话恢复；`slices.spec.js` 2 条切片/PDF；`redaction.spec.js` 3 条马赛克/色块打码；`mobile.spec.js` 增加触摸拖拽/打码回归；`visual.spec.js` 3 条按自然尺寸截图回归。
- **视觉回归**：`e2e/__screenshots__/` 下 3 张基线（纵向默认、旋转后、2×2 网格）；正常 `npm run e2e` 会对比，变更预期画面时用 `npx playwright test e2e/visual.spec.js --update-snapshots` 更新。
- **构建**：`npm run lint` 干净；`npm run build` 干净。
- **已知不足**：拖拽期间主结果只在释放后更新；缩放目前只在固定网格的「填满」模式生效；单元格比例按预设近似（忽略 gap）；网格预设使用直边拼缝；1+2/1+3 对任意张数的复杂跨格可继续打磨；打码为本地会话状态，不持久化。

## 6. 更新规则

- 完成一项：勾选 `[x]`，在行尾补「证据」（测试名 / commit / 实测数字）。
- 阻塞项标 `[!]` 并写明外部条件（真机、商店审核等）。
- 新增事项先归入 P0/P1/P2 与对应 Sprint，再实现；不要只改代码不改清单。
