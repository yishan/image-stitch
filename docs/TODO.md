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
| **B3 质量固化** | e2e 扩展、视觉回归、文档更新 | CI 全绿；README/DESIGN/ROADMAP 同步 | 🟡 部分完成 |

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
- 验收：任意宽高比混排不变形；焦点像素用 e2e 断言；可撤销。视觉回归截图未做。

### B2 布局预设（X2）✅
- [x] B2.1 几何：`stitchLayout.js` 新增 `createGridPlan`；自动网格保留原 collage 行为
- [x] B2.2 新增预设：2×2、1+2、1+3（1–6 张确定性铺满；奇偶行自动跨满，无空洞）
- [x] B2.3 UI：`网格`方向下出现「网格布局」选择器；预览/导出共用同一 plan
- [x] B2.4 单测：1–6 张、无重叠/越界、2×2 奇偶行、1+2 hero 尺寸；e2e：2×2/1+2/1+3 结果尺寸 + 直边拼缝
- 验收：预设结果确定；e2e 覆盖尺寸；旧三种布局回归（30 条 e2e 全绿）。

### B3 质量固化（部分完成）
- [x] e2e 扩展：sprint-b.spec.js（9 条，含焦点像素与控件尺寸断言）
- [x] 文档同步：README / DESIGN / ROADMAP / TODO
- [ ] 视觉回归截图（`toHaveScreenshot` 基线）
- [ ] 拖拽焦点（当前为九宫格选择）

### 后续（X3–X9 / moonshot）
- [ ] X3 切片/PDF 导出
- [ ] X4 本地脱敏（框选模糊/马赛克）
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
npm run e2e             # Playwright（当前 30 条；本地需 PLAYWRIGHT_BROWSERS_PATH 或已安装浏览器）
npm run e2e -- --ui     # 交互调试
```

本地首次跑 e2e（浏览器装在 /tmp，避免写系统缓存）：

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers npm run e2e
```

## 5. Sprint B 交付证据（2026-11-05）

- **单测**：`npm test` → 59/59。新增 `imageTransform.test.js`（归一化/宽高交换/不可变更新）与 `stitchLayout.test.js` 7 条（旋转、cover、2×2 奇偶行、1+2 hero、焦点透传、1–6 张边界）。
- **e2e**：`npm run e2e` → 30 passed / 0 failed / 30 skipped（另一 project 条件跳过）。`sprint-b.spec.js` 9 条覆盖旋转/翻转/重置、撤销、混排 cover、会话恢复、2×2、1+2/1+3、焦点像素。
- **构建**：`npm run lint` 干净；`npm run build` 干净。
- **已知不足**：焦点拖动未做（九宫格替代）；网格预设使用直边拼缝；1+2/1+3 对任意张数的复杂跨格可继续打磨。

## 6. 更新规则

- 完成一项：勾选 `[x]`，在行尾补「证据」（测试名 / commit / 实测数字）。
- 阻塞项标 `[!]` 并写明外部条件（真机、商店审核等）。
- 新增事项先归入 P0/P1/P2 与对应 Sprint，再实现；不要只改代码不改清单。
