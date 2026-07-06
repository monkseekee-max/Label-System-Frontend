# 智能标注系统 · 前端 (Label-System-Frontend)

> 知识图谱智能标注平台的前端工程，基于 **React + Ant Design Pro + Vite**。
> 配套后端为 LLM-Factory（FastAPI 主服务 + label-system 微服务栈）。

---

## ✨ 技术栈

| 分类 | 选型 |
|---|---|
| 框架 | React 19 + TypeScript |
| UI | Ant Design 5 + @ant-design/pro-components |
| 状态 | Zustand（鉴权/设置） + @tanstack/react-query（数据） |
| 路由 | React Router v7 |
| HTTP | [ky](https://github.com/sindresorhus/ky)（统一封装见 `src/utils/request/`） |
| 构建 | Vite |
| 包管理 | pnpm |
| 测试 | Vitest（单测） + Playwright（E2E） |

> 前端基于 [react-antd-admin](https://github.com/innocalls/react-antd-admin) 模板演进。

---

## 🚀 快速开始

### 环境要求

- Node.js ≥ 20
- pnpm ≥ 9（`npm i -g pnpm`）
- 后端服务需运行（见下方 [接口调试指南](./API_DEBUG_GUIDE.md)）

### 安装与启动

```bash
pnpm install           # 安装依赖
pnpm dev               # 启动开发服务器 (默认 http://127.0.0.1:3335)
```

其他常用脚本：

```bash
pnpm build             # 生产构建 (输出到 build/)
pnpm preview           # 预览生产构建
pnpm typecheck         # TypeScript 类型检查
pnpm lint              # ESLint
pnpm test              # Vitest 单测
pnpm test:e2e          # Playwright E2E
```

### 环境变量

复制 `.env.example` 为 `.env` 并按需修改。关键变量：

| 变量 | 说明 | 默认 |
|---|---|---|
| `VITE_API_BASE_URL` | 后端 API 前缀（开发期经 vite proxy 转发到 9090） | `/api` |
| `VITE_GLOB_APP_TITLE` | 网站标题 | `智能标注系统` |
| `VITE_ENABLE_MOCK_FALLBACK` | API 失败时是否回退 Mock（**生产必须 false**） | `true`(dev) / `false`(prod) |

---

## 📁 目录结构

```
src/
├── api/              # 接口层（按业务域分目录: label-system/ llm-factory/ user/ ...）
├── components/       # 通用组件
├── pages/            # 页面（首页/企业管理/数据/标注/训练/应用 等）
├── router/           # 路由配置（含权限角色映射）
├── store/            # Zustand 状态（auth / user / settings）
├── utils/request/    # HTTP 客户端封装（ky + Bearer 注入）
└── locales/          # 国际化 (zh-CN / en-US)
docs/
└── backend-api/      # ★ 后端接口文档（见下方）
```

---

## 📚 后端接口文档（本仓库已附带）

为方便前端联调，本仓库在 [`docs/backend-api/`](./docs/backend-api/) 目录附带了后端接口文档：

| 文件 | 说明 |
|---|---|
| [`后端API总文档.md`](./docs/backend-api/后端API总文档.md) | LLM-Factory 主后端 API 总览（18 章，含认证/数据管道/训练/推理/评测等） |
| [`label-system-openapi.json`](./docs/backend-api/label-system-openapi.json) | label-system 微服务 OpenAPI 3.0 规范（30 个接口，可导入 Apifox/Postman/Swagger UI） |
| [`ADR-020-前端后端集成契约对齐.md`](./docs/backend-api/ADR-020-前端后端集成契约对齐.md) | 前后端集成契约（字段命名/响应信封/错误码对齐） |
| [`ADR-010-接口规范化与缺陷修复.md`](./docs/backend-api/ADR-010-接口规范化与缺陷修复.md) | 接口规范化与已知缺陷修复记录 |
| [`api-contract-adr019.md`](./docs/backend-api/api-contract-adr019.md) | ADR-019 API 契约 |
| [`对外演示指南.md`](./docs/backend-api/对外演示指南.md) | 系统对外演示指南（含登录方式/演示流程） |

> ⭐ **前端联调必读**：[《前端接口调试指南》](./API_DEBUG_GUIDE.md) —— 包含服务地址、登录认证、请求架构、调试方法与常见坑。

---

## 🔐 登录与权限

- 登录字段为 **手机号**（非用户名），需带 **企业编码 companyCode**
- 认证：JWT Bearer Token（登录后自动注入请求头）
- 角色驱动菜单/路由可见性（`SUPER_ADMIN` / `admin` / `dataTrainer` 等）

演示账号（本地开发库）：

| 字段 | 值 |
|---|---|
| 手机号 | `13800000000` |
| 密码 | `admin@123` |
| companyCode | `HMJC` |
| 角色 | `SUPER_ADMIN` |

详见 [接口调试指南](./API_DEBUG_GUIDE.md)。

---

## 📄 License

MIT
