# 前端接口调试指南 (API Debug Guide)

> 本文档面向前端开发，说明如何连接后端、登录认证、发起请求、排查问题。
> 配套后端接口文档见 [`docs/backend-api/`](./docs/backend-api/)。

---

## 1. 服务地址

### 本地开发（单机部署）

| 服务 | 地址 | 说明 |
|---|---|---|
| **前端 Dev Server** | `http://127.0.0.1:3335` | Vite，开发用 |
| **FastAPI 主后端** | `http://127.0.0.1:9090` | LLM-Factory 主 API |
| **Swagger UI** | `http://127.0.0.1:9090/docs` | ⭐ 交互式 API 文档（代码生成） |
| **ReDoc** | `http://127.0.0.1:9090/redoc` | 只读 API 文档 |
| **label-system 网关** | `http://127.0.0.1:8100` | 标注微服务栈网关 |
| **PostgreSQL** | `127.0.0.1:5433` | 主库（注意非默认 5432） |
| **Redis** | `127.0.0.1:6379` | |

### 公网（Cloudflare 隧道）

| 地址 | 路由 |
|---|---|
| `https://fun-md.com` | `/api/*`、`/docs`、`/openapi.json`、`/redoc` → 后端 9090；其余 → 前端 vite 3335 |
| `https://app.fun-md.com` | 同上（别名） |

> ⚠️ `docs/backend-api/后端API总文档.md` 中部分 ngrok 地址已**过时**，请以本指南地址为准。

---

## 2. 后端接口文档清单

### 2.1 在线文档（权威，代码自动生成）

启动后端后访问：

- **Swagger UI**：`http://127.0.0.1:9090/docs` ← 推荐，可直接试调
- **ReDoc**：`http://127.0.0.1:9090/redoc`
- **OpenAPI JSON**：`http://127.0.0.1:9090/openapi.json`

> 当代码与静态文档冲突时，**以 `/docs`（代码生成）为准**。

### 2.2 静态文档（本仓库 `docs/backend-api/`）

| 文件 | 内容 |
|---|---|
| `后端API总文档.md` | 主后端全量 API（数据管道/训练/推理/评测/系统管理等 18 章） |
| `label-system-openapi.json` | label-system 微服务 OpenAPI 3.0（**可导入 Apifox/Postman**） |
| `ADR-020-前端后端集成契约对齐.md` | 响应信封/字段命名/错误码契约 |
| `ADR-010-接口规范化与缺陷修复.md` | 接口规范与缺陷修复 |

**导入 Apifox/Postman**：选择 `label-system-openapi.json` → 导入 OpenAPI → 自动生成 30 个接口的请求集合。

---

## 3. 认证机制

### 3.1 登录流程（重要：字段是手机号，非用户名）

```
POST /api/auth/login
Content-Type: application/json

{
  "phone":      "13800000000",
  "companyCode": "HMJC",
  "password":   "admin@123"
}
```

**响应**（HTTP 200，注意此接口**即使失败也返回 HTTP 200**，用 body 中的 `code` 字段区分）：

```jsonc
// 成功
{ "code": 200, "message": "success",
  "data": { "token": "eyJ...", "access_token": "eyJ...",
            "refresh_token": "eyJ...",
            "userId": 1, "username": "admin",
            "role": "admin", "position": "SUPER_ADMIN",
            "companyCode": "HMJC" } }

// 失败（密码错/账号不存在）
{ "code": 401, "message": "密码错误", "data": null }
```

### 3.2 演示账号（本地开发库）

| 账号 | 手机号 | 密码 | companyCode | 角色 |
|---|---|---|---|---|
| admin | `13800000000` | `admin@123` | `HMJC` | SUPER_ADMIN |
| seekee | `13907152990` | `admin@123` | `HMJC` | SUPER_ADMIN |

### 3.3 Token 使用

- 登录返回的 `token`（= `access_token`）存入 Zustand `useAuthStore`。
- 后续所有 `/api/*` 请求（除白名单外）由 HTTP 客户端自动注入：
  ```
  Authorization: Bearer <token>
  ```
- 获取当前用户信息：`GET /api/auth/me`（用 token 换取用户详情/角色）。
- **API Key 登录已关闭**（`allow_api_key_login=false`），前端必须用手机号+密码。

---

## 4. 前端请求架构

### 4.1 Vite Dev Proxy（开发期）

`vite.config.ts` 配置：前端的 `/api/*` 请求被代理到本地后端，**避免 CORS**。

```ts
server: {
  port: 3335,        // strictPort, 必须是 3335
  proxy: {
    "/api": {
      target: "http://127.0.0.1:9090",   // 本地 FastAPI
      changeOrigin: true,
    },
  },
}
```

所以前端代码里只需请求 `VITE_API_BASE_URL`（默认 `/api`），无需写完整后端地址。

### 4.2 HTTP 客户端（ky）

封装在 `src/utils/request/index.ts`：

- **Base URL**：`VITE_API_BASE_URL`（默认 `/api`）
- **超时**：`VITE_API_TIMEOUT`（默认 60000ms）
- **重试**：GET 重试 3 次；**POST/PUT/DELETE 不重试**（避免重复写入）
- **鉴权**：自动注入 `Authorization: Bearer <token>`（白名单接口除外）
- **全局进度条**：nprogress

接口层按业务域组织在 `src/api/<domain>/`，例如：

```
src/api/
├── user/index.ts              # 登录/用户信息
├── label-system/index.ts      # 标注微服务
├── llm-factory/               # 训练/推理/评测/模型
│   ├── models.ts, factory-client.ts, eval.ts, knowledge.ts ...
```

### 4.3 响应信封约定

后端统一响应格式（见 ADR-020）：

```jsonc
{ "code": 200, "message": "success", "data": { ... } }
```

- `code: 200` 成功；非 200 为业务错误（如 401 未授权、403 无权限、500 内部错误）。
- 部分历史端点返回裸 dict（无信封），前端 client 层已做适配。

---

## 5. 本地调试流程

### 5.1 启动后端（一键）

后端项目根目录（LLM-Factory）：

```bash
bash scripts/start_system.sh          # 拉起全栈 (PG/Redis/FastAPI/vLLM/前端/...)
bash scripts/start_system.sh --status # 查看状态
```

确认 `http://127.0.0.1:9090/docs` 可打开即后端就绪。

### 5.2 启动前端

```bash
cd frontend
pnpm install
pnpm dev          # http://127.0.0.1:3335
```

浏览器访问 `http://127.0.0.1:3335`，用演示账号登录。

### 5.3 接口试调（curl）

```bash
# 登录拿 token
curl -s -X POST http://127.0.0.1:9090/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000000","companyCode":"HMJC","password":"admin@123"}'

# 带 token 请求
TOKEN="<上一步返回的 data.token>"
curl -s http://127.0.0.1:9090/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 6. 常见坑与排查

### 6.1 本机代理劫持 127.0.0.1（Clash / fake-IP）

若本机运行 Clash 等代理，`curl http://127.0.0.1:9090` 可能被劫持返回 502 或超时。

**解决**：curl 加 `--noproxy '*'`：

```bash
curl --noproxy '*' http://127.0.0.1:9090/docs
```

浏览器调试同理，需在代理软件中为 `127.0.0.1`、`localhost`、`fun-md.com` 配置直连。

### 6.2 端口必须是 3335

前端 dev server 固定 **3335**（`vite.config.ts` 中 `strictPort: true`）。Cloudflare 隧道也指向 3335。改成其他端口会导致公网访问 502。

### 6.3 CORS

开发期靠 vite proxy 规避（同源 `/api`）。若直连后端 9090 跨域，检查后端 `EXTRA_CORS_ORIGINS` 是否包含前端地址。

### 6.4 label-system 微服务 401

label-system 微服务用双 JWT 密钥校验（`JWT_SECRET` + `BFF_JWT_SECRET`）。若 `/api/label-system/*` 或标注相关接口全 401，通常是后端微服务的 `BFF_JWT_SECRET` 与主 API 不一致，需重启微服务并确保环境变量同步（属后端运维问题）。

### 6.5 浏览器 DevTools 调试技巧

- **Network 面板**：过滤 `Fetch/XHR`，检查 `/api/` 请求的 `Authorization` 头是否存在、响应 `code` 字段。
- **Application → Local Storage**：token 存于 `zustand` persist，key 形如 `react-antd-admin-0.0.0-dev-access-token`。
- **Console**：`window` 下无全局 axios 实例；如需手动试调，在 Console 用 `fetch`。

---

## 7. label-system 微服务接口

标注/数据/工作流等功能由 label-system 微服务栈提供（端口 8100-8106），经主后端 9090 BFF 层代理对外。

| 微服务 | 端口 | 职责 |
|---|---|---|
| gateway | 8100 | 网关 |
| iam | 8101 | 认证/用户/企业 |
| data | 8102 | 数据资产 |
| workflow | 8103 | 标注工作流 |
| ai | 8104 | AI 辅助标注 |
| model_factory | 8105 | 模型工厂 |
| intelligence | 8106 | 智能校验 |

完整接口定义见 [`docs/backend-api/label-system-openapi.json`](./docs/backend-api/label-system-openapi.json)，含认证管理、平台公司、员工、系统配置、标注任务等 30 个接口。
