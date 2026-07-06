# 跨 UI 面整合方案 (C5)

> 审计发现：系统存在 4 套独立 UI，无统一导航/鉴权，体验割裂。本文件给出整合决策与落地路径。

## 现状（4 套 UI 面）

| 面 | 技术 | 鉴权 | 入口 | 用途 |
|----|------|------|------|------|
| React 主应用 | `frontend/` (React 19 + AntD 6) | JWT Bearer + refresh（Zustand） | `/login` → `/home` | 业务全功能（标注/训练/审批/管理） |
| 内部 cockpit | `src/integration/static/{app,dashboard,data,eval,training}.html` | X-API-Key（localStorage） | `:9090/app` 等 | 运维/调试多标签面板 |
| API 文档 | FastAPI Swagger/Redoc | 无（开发态） | `:9090/docs`、`/redoc` | 接口浏览 |
| 监控 | Grafana | 独立账号 | Grafana 域名 | 运维指标（HTTP/5xx/PG/GC） |

## 问题

1. **鉴权割裂**：React 用 JWT，cockpit 用 X-API-Key（明文存 localStorage，且 `VITE_LLM_FACTORY_API_KEY` 进浏览器 bundle 可被提取），Grafana/Docs 各自独立
2. **导航割裂**：4 套入口无统一门户，用户需记多套 URL/账号
3. **视觉割裂**：cockpit 是裸 HTML+ECharts，与 React 应用风格无关
4. **安全风险**：X-API-Key 进前端 bundle（A5 已在 `/api` 层移除，但 cockpit 仍用）

## 决策：分阶段整合（非全量合并）

全量合并成本极高且部分面（Grafana/Docs）本就是工具型独立面。采用**门户 + 鉴权统一 + cockpit 收编**三步走：

### 阶段 1（短期，P0 安全）：消除 X-API-Key 进 bundle
- cockpit 的 `src/integration/static/*.html` 改为：用户在 cockpit 内输入 API Key（不再硬编码 `VITE_LLM_FACTORY_API_KEY`），或改为复用 React 应用的 JWT（通过 postMessage / 共享 cookie）
- 后端为 cockpit 增 JWT 鉴权分支，废弃 X-API-Key 直连
- **收益**：消除密钥泄漏风险，单一鉴权模型

### 阶段 2（中期，P1 体验）：cockpit 收编进 React 应用
- 将 cockpit 的 5 个标签页（overview/data/eval/training/label/docs/chat）作为 React 应用内的运维路由（如 `/llm-factory/ops/*`），用 AntD 组件 + ECharts 重写，权限限定 `admin`/`superAdmin`
- Grafana 通过 iframe 嵌入（带 `handle.iframeLink`）或 Grafana 指标 API 拉取后用 ECharts 自绘
- **收益**：单一 UI 面，统一导航/主题/鉴权，cockpit 用户不再需要切入口

### 阶段 3（长期，P2 门户）：统一门户
- Grafana 与 Swagger 保留独立面（工具型，合并无收益），但在 React 应用内提供：
  - 「运维监控」入口跳转 Grafana（带 SSO/自动登录 token）
  - 「API 文档」入口跳转 `/docs`（仅 `superAdmin` 可见）
- 建立 SSO：React 应用签发短期 token，跳转 Grafana/Docs 时自动鉴权（避免重复登录）

## 不做的事（Non-Goals）

- 不把 Grafana 用 React 重写（投入产出比低，Grafana 本身是成熟监控面）
- 不把 Swagger 重写（FastAPI 自动生成，开发工具型）
- 不在本轮做（属架构 backlog，需后端配合改鉴权 + 运维路由新增）

## 本轮结论

C5 的可执行交付是**本方案文档**。代码层面的整合（阶段 1-3）需跨前后端协作，单独立项推进，不在 UI/UX 审计执行范围内。审计已记录割裂现状与风险，后续按阶段排期。
