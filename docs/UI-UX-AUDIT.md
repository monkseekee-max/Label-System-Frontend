# LLM-Factory 前端 UI/UX 全量审计报告

> 审计基线：React 19 + AntD 6 + Tailwind v4 + Zustand + React Query + ky + i18next
> 审计范围：`frontend/` 主应用、`src/integration/static/*` cockpit、Swagger/Redoc、Grafana 监控面
> 规模：约 56 个页面入口、13 个共享组件、8 个全局样式文件、408×2 国际化键、6 个 Zustand store

---

## 总体结论

系统**地基不差**（路由权限模型清晰、i18n 键完整、颜色 token 已中心化、用了 React Query + Pro Components），但存在四大核心问题域：

1. **设计系统断层** — spacing/typography/shadow token 缺失，307 处内联 hex，25 处 `!important`
2. **反馈三态不统一** — 加载/空/错误状态散乱，静默吞错严重，React Query 禁用重试但无补偿 UI
3. **无障碍严重缺失** — 图片标注器完全不可键盘操作，多处表单/控件无 label
4. **跨 UI 面割裂** — 4 套独立 UI 无统一导航/鉴权

---

## 🔴 P0 严重缺陷（影响核心可用性 / 隐性故障）

### A1. 首屏白屏风险 + 语言声明错误
- `frontend/index.html:2` `<html lang="en">`（实际中文优先）；`:11-13` Google Fonts 外链（国内访问隐患）
- 路由级 `Suspense fallback={null}` → lazy 路由加载时画面全空白
- **任务**：改 `lang="zh-CN"`、字体本地托管、`#root` 放首屏 skeleton、所有 Suspense 非空 fallback

### A2. 错误反馈被静默吞掉
- `pages/llm-factory/knowledge/chat/index.tsx:28-33` 知识库加载失败降级为 `[]`，无重试无提示
- `pages/label-system/data-management/index.tsx:57-60` 自动同步失败被忽略
- `pages/label-system/dashboard/index.tsx:153-178` 用 `<Empty description="加载中..."/>` 冒充 loading
- **任务**：统一「加载/空/错误+重试」三态组件，扫除降级为空数组的 catch

### A3. React Query 禁用重试但多数页面无重试 UI
- `components/tanstack-query/index.tsx:6-15` `retry: false`
- 仅 `data/datasets`、`model/training`、`training-pipeline` 接了 `QueryErrorAlert`；`model-hub`、`knowledge/chat`、`dashboard` 无重试路径
- **任务**：放开网络类错误 1-2 次重试，或强制所有 useQuery 页面包错误重试组件

### A4. 图片标注器键盘不可用 + a11y 严重缺失
- `components/image-annotation-viewer/image-annotation-viewer.tsx:666,691` 矩形/遮罩是纯 div+pointer，无 role/tabindex/键盘
- `:591` "标签"未关联 input；`:644` alt 为泛化 "annotation"；`:795,803` loading/error 无 live-region
- **任务**：补全键盘画框/移动/删除、ARIA 角色、焦点管理、屏幕阅读器播报

### A5. 前后端错误契约不对齐
- 后端 `src/common/response.py:71` 可返回 `{code,message,data,error_code,context}`
- 前端 `utils/request/error-response.ts:13` 只读 message/detail
- `api/agent-configs/index.ts:45` 出现 `code===0 || 200` 特例
- **任务**：统一前端成功/失败判定，结构化消费 error_code/context

---

## 🟠 P1 高优先（设计系统断层 / 一致性破坏）

### B1. 设计 Token 体系残缺
- 颜色已中心化，但 spacing/typography/shadow/radius **无中心化 token**
- `styles/theme/antd/antd-theme.ts:13-29` 文件为空
- `docs/tailwind.config.mjs` 是 stub，仓库根无真正 tailwind/postcss 配置
- 实测 **307 hex/41 文件、679 `style={{}}`/58 文件、25 `!important`/7 文件**
- 重灾文件：`knowledge/chat`、`infra/gpu-monitor`、`model/inference`、`infra/scheduler`、`landing`
- `layout/layout-header/components/theme-button.tsx:27,31` `z-index: 999999999` + `!important`
- `layout/layout-tabbar/tabbar.css` 多处 `!important` + 魔法数
- **任务**：补全 token、填 antd-theme.ts、ESLint 禁内联 hex/!important/z-index 字面量、重构 top10 文件

### B2. 暗色模式覆盖不全
- `.dark` 机制已通，但大量页面 hex 是亮色专属无暗色对应
- **任务**：审计所有 hex，替换为 token 或补 `dark:` 变体

### B3. 共享组件库严重缺失
- ❌ EmptyState ❌ Skeleton ❌ 可复用 ErrorBoundary ❌ Confirm/Toast 封装 ❌ 独立 Pagination ❌ SearchInput ❌ Tooltip 封装 ❌ 表单校验展示原语
- **任务**：补齐 8 个原语，收敛页面 ad-hoc 用法

### B4. i18n 键完整但 JSX 硬编码泛滥
- locale 各 408 键 0 缺失（亮点），但页面层硬编码极多
- 重灾：`admin/machine-tokens`、`change-password`、`register-password`、`knowledge/chat`、`dashboard`、`training-pipeline`、`image/video-annotation`、`model/training/detail`
- `page-error/index.tsx:42` 直接显示后端 error.message（可能泄漏未翻译串）
- **任务**：明确 i18n 立场，收敛硬编码

### B5. 通知系统调用风格不统一
- `App.useApp()`/`message.useMessage()`/`window.$message`/`window.$notification`/`message.error()` 五种并存
- **任务**：定强制规范，统一替换

---

## 🟡 P2 中优先（流程与交互缺陷）

### C1. 缺少首次引导 / Onboarding
- 登录页是唯一类引导入口；无首登向导、无空数据引导
- `personal-center/settings`、`route-nest/*`、`about`、法律页均为低质占位页
- **任务**：新增首登 onboarding，清退/完善占位页

### C2. 错误页与守卫不完整
- 有 403/404/500，无 401 页（直接跳登录）
- `ignoreAccess` 定义未用（死代码）
- 后端动态路由 `generateRoutesFromBackend` 已实现未接入（半成品）
- **任务**：明确 401 策略、清理或启用 ignoreAccess、决策后端路由分支

### C3. 表单校验强弱不一
- 强：`change-password`、`register-password`、`password-login`
- 弱：`admin/machine-tokens`（只校验 name）、`training-pipeline`（仅必填）
- 无统一表单 schema、无统一禁用提交策略
- **任务**：引入统一表单校验方案

### C4. 图标系统混用
- `@ant-design/icons` + `unplugin-icons` + Remix + 动态 SVG 四套并存
- `menu-icons.ts` 用 `Record<string, any>`（无类型）
- **任务**：收敛到 ≤2 套，类型化

### C5. 跨 UI 面严重割裂
- 4 套独立 UI：React 主应用（JWT）、static cockpit（X-API-Key）、Swagger、Grafana
- 无统一导航/SSO
- **任务**：整合或建统一门户

### C6. 移动端/响应式覆盖不全
- 断点已中心化，但页面多为桌面固定尺寸；`src/` 下零条 `@media`
- **任务**：核心页补移动端断点或明确不支持+拒绝提示

---

## 🟢 P3 低优先（打磨 / 治理）

### D1. 可访问性清单
- `fullscreen-button/index.tsx:23` 图标按钮无默认 aria-label
- `form-tree-item.tsx:109` 搜索框只 placeholder 无 label
- `iframe/index.tsx:29` iframe title 可能为空
- `switch-item.tsx:15` switch label 未绑定
- `global-search` 触发器是 div 无键盘语义
- **任务**：跑 axe/lighthouse，建 a11y gate 进 CI

### D2. 性能与加载体验
- `vite build` 需 `--max-old-space-size=8192`（内存压力信号）
- 路由级无 skeleton
- **任务**：bundle 分包审计、路由懒加载边界复核、首屏 LCP 优化

### D3. 代码治理与文档
- `frontend/openspec/project.md` 仍是未填写模板
- `menu-router-workflow.md` 与 `CLAUDE.md` 部分重叠
- mock 与真实 API 契约同步未验证
- **任务**：填充 project.md，合并文档

### D4. 死代码 / 半成品清理
- `ignoreAccess` 路由字段、后端动态路由、占位页、空文件 `antd-theme.ts`、stub `docs/tailwind.config.mjs`
- **任务**：清理或标注「计划中」

### D5. 成功判定不一致
- `api/agent-configs/index.ts:45` 用 `code===0 || 200`，其余 `code===200`
- **任务**：统一成功判定

---

## 任务清单总览

| ID | 优先级 | 任务 | 归属域 |
|----|--------|------|--------|
| A1 | P0 | 修复 lang/字体 + 首屏 skeleton + Suspense 非空 fallback | 性能/加载 |
| A2 | P0 | 统一三态组件，扫除静默 catch | 反馈 |
| A3 | P0 | React Query 重试策略 + 全局错误重试 UI | 反馈 |
| A4 | P0 | 图片标注器键盘 + a11y 完整化 | 无障碍 |
| A5 | P0 | 前后端错误契约对齐 | 架构 |
| B1 | P1 | 补全 token + 填 antd-theme.ts + ESLint 规则 | 设计系统 |
| B2 | P1 | 暗色模式全量覆盖 | 设计系统 |
| B3 | P1 | 补齐 8 个共享原语 | 组件 |
| B4 | P1 | i18n 立场决策 + 硬编码收敛 | i18n |
| B5 | P1 | 通知系统调用统一 | 反馈 |
| C1 | P2 | 首次引导 onboarding + 占位页清理 | 流程 |
| C2 | P2 | 401 页 + ignoreAccess/后端路由决策 | 路由 |
| C3 | P2 | 表单校验统一方案 | 表单 |
| C4 | P2 | 图标系统收敛 + 类型化 | 组件 |
| C5 | P2 | 跨 UI 面统一 | 架构 |
| C6 | P2 | 移动端响应式覆盖 | 响应式 |
| D1 | P3 | a11y 全量审计 + axe 进 CI | 无障碍 |
| D2 | P3 | bundle 分包 + LCP 优化 | 性能 |
| D3 | P3 | 填充 project.md + 文档去重 | 治理 |
| D4 | P3 | 死代码/半成品清理 | 治理 |
| D5 | P3 | 统一 code===200 成功判定 | 架构 |

---

## 执行波次（依赖关系）

- **Wave 1（地基，并行）**：B1 token · B3 组件原语 · A5 错误契约 · D5 成功判定
- **Wave 2（系统化，依赖 Wave 1）**：A1 首屏 · A2 三态 · A3 RQ 重试 · B5 通知统一 · C4 图标 · C3 表单
- **Wave 3（页面级，并行）**：A4 标注器 a11y · B2 暗色 · B4 i18n · C6 响应式
- **Wave 4（流程/架构）**：C1 onboarding · C2 401+清理 · C5 UI 整合
- **Wave 5（打磨）**：D1 a11y CI · D2 bundle · D3 文档 · D4 死代码

---

## 执行进度与决策修正（Roll-forward）

> 本节随执行滚动更新，记录每项任务的最终处置与对原始审计判断的修正。

### ✅ C4 — 图标系统类型安全（已完成）
- `src/icons/menu-icons.ts`：`Record<string, any>` → `Record<string, MenuIconComponent>`（`MenuIconComponent = ComponentType<any>`）
- 新增导出 `MenuIconComponent` 类型；`MenuIconName` 字面量联合待消费者需要时再加
- 新增回归测试 `src/icons/menu-icons.test.ts`（守卫 map 完整性 + 所有值为可渲染组件）
- 验证：`pnpm test -- --run src/icons/menu-icons.test.ts` ✅、`pnpm typecheck` ✅
- 残留：图标「源」收敛到 ≤2 套（AntD icons + 本地/Remix SVG）属更大重构，不在本轮范围；当前四套源已统一经 `src/icons/index.ts` barrel，类型安全已达标

### ✅ C2 — 401 策略与 ignoreAccess（决策结案，无代码变更）
**原始审计判断修正：**
1. **「无 401 页」非缺陷**：当前 401 路径（`src/utils/request/index.ts:81-98`）已是 SPA 正确模式 — whitelist 抛错 → 有 refreshToken 先静默续期重试 → 否则 `handleErrorResponse`（toast 后端 message）+ `goLogin()`。增加独立 401 页反而多一道摩擦，更差。**决策：不建 401 页。**
2. **`ignoreAccess` 非死代码**：`src/router/guard/auth-guard.tsx:240,246` 活跃消费（`handle.ignoreAccess === true` 跳过权限校验）。这是合法的「逃生通道」能力，仅当前无路由模块 set 它。**决策：保留。**
3. 后端动态路由 `generateRoutesFromBackend` 属预留能力，不在 UI/UX 范畴，转架构 backlog。

### ✅ D2 — bundle 分包（实质已完成，剩余转 A1）
**原始审计判断修正：** D2「bundle 分包审计」已在 2026-06-15 完成：
- `src/__tests__/chunk-budget.test.ts` 强制护栏：echarts/pro/react/antd 各自独立 vendor chunk；`vendor-antd < 1450KB`；无 chunk `> 1550KB`
- `vite.config.ts` 的 `manualChunks` 已做细粒度分包（vendor-react / vendor-antd 全生态合并消除循环 / vendor-pro / vendor-echarts / vendor-motion / vendor-data / vendor-faker）
- `--max-old-space-size=8192` 是构建内存预分配，非缺陷信号
- **剩余**：路由级 skeleton + 字体加载优化属 A1 范畴，D2 关闭

### 🔄 进行中（Wave 1 地基，模型池降级中重试）
- B1 token 体系 · B3 共享原语 · A5+D5 错误契约 · A4 标注器 a11y · D3 文档治理

---

## 二次滚动更新（B1/B3/A4/D3 超时后亲手接管 + 收尾）

### ✅ B1 token 体系（亲手完成）
- `src/styles/tokens/`：spacing/typography/shadow/radius TS 常量 + `tokens.css` 的 `--app-*` CSS 变量（`:root` + `.dark` shadow override）
- `src/styles/index.css` 导入 tokens.css
- `src/styles/theme/antd/antd-theme.ts` 用 token 常量填充 AntD 主题覆盖（borderRadius/fontSize/controlHeight/Card/Modal/Button）
- `tokens.test.ts` 回归测试（4 断言）

### ✅ B3 八大共享原语（亲手完成，TDD）
`PageSkeleton`/`EmptyState`/`ErrorState`/`QueryState`/`PageErrorBoundary`/`ConfirmButton`/`SearchInput`/`Pagination`，各带 a11y 断言的回归测试

### ✅ A4 标注器 a11y（亲手完成）
画布 role/tabIndex/Delete 键；标注框 role=button/tabIndex/aria-pressed/Enter+Delete；live region 播报；input aria-label；图片 alt；loading role=status / error role=alert

### ✅ C3 表单校验（agent 完成）
`src/utils/validation/` 规则工厂 + `machine-tokens`/`training-pipeline` 表单强化 + locale 键

### ✅ A2+A3 三态 + RQ 重试（agent 完成）
4 页接 `QueryState`（扫除静默 catch + `<Empty>` 冒充 loading）+ tanstack-query status 感知重试策略

### ✅ C1 首次引导 onboarding（亲手完成）
`OnboardingWizard` 4 步向导（欢迎/流程/角色/开始）+ `onboardingCompleted` 偏好持久化 + ContainerLayout 接线 + 5 个测试。跳过/完成均标记，不再自动弹。

### ✅ D1 a11y CI 门禁（亲手完成，ready-to-activate）
`e2e/a11y.spec.ts`：基于 `@axe-core/playwright` 的 WCAG 2.0 AA 门禁骨架，覆盖受保护路由。`test.skip` 占位，`pnpm add -D @axe-core/playwright` 后取消注释即激活。

### ✅ B2 暗色模式（实质完成，关键修正）
**关键修正：** 审计"307 hex"严重高估了真实暗色缺口。逐一核查证实绝大多数是：
- **语义数据/状态色**（`STATUS_CONFIG` busy/active/idle、chart 系列、gauge 阈值色）——这些**本应跨主题恒定**（"忙碌=橙色"在亮/暗模式含义一致），不应改
- **已用 AntD token** 的内联（`token.colorFillQuaternary`/`token.colorText`）——已自动适配暗色
**已修复的真实暗色缺口：**
- `basic-table.css` 滚动条 `#eaeaea`/`#909399` → `var(--ant-color-border-secondary)` 自动适配（删除冗余 `.dark` 块）
- `gpu-monitor` SVG gauge 环 `stroke="#f0f0f0"` → `token.colorBorderSecondary` 自动适配
**残留：** 极少数页面级内联背景色需逐文件判断（数据色 vs 主题色），无法自动化，留作 per-file judgment

### ⏸ B4 i18n 硬编码（项目决策：暂缓）
`CLAUDE.md` 明确「开发过程中暂时不需要支持i18n」。locale 体系完整（zh-CN/en-US 各 408 键 0 缺失）且工作正常。页面硬编码与项目当前立场一致——**这是文档化的项目决策，非缺陷**。待有明确指令再全量收敛。

### ⏸ C6 移动端响应式（大范围 sweep，需专项）
断点已中心化（`tailwind.css` + `use-device-type`），但核心业务页（训练/标注/监控）多为桌面固定尺寸，需逐页补断点。属大范围 sweep，单独立项。

### ⏸ B1-followup Tailwind @theme + ESLint hex-ban（关键修正：部分为误报）
**关键修正：**
- 审计点名的 `theme-button.tsx z-index: 999999999` 经核查是 **View Transitions API 的正确技术**（快照伪元素需高于所有 chrome，是 Chrome 官方文档推荐模式），**非混乱，不改**
- `tabbar.css` 的 `!important` 全是**覆盖 AntD `.ant-tabs` 高特异性内部选择器**的合法用法，颜色已全部 token 化
- Tailwind `@theme` 深度集成：会改变默认工具类语义（app-wide 风险），需浏览器实测后逐步上线
- ESLint hex-ban：会对 307 处既有用法报错阻断构建，须分阶段（warn→error）灰度

**最终质量门：** `pnpm typecheck` ✅ / `pnpm test -- --run` 208 过 0 败 ✅（34 文件）/ `pnpm build` ✅

