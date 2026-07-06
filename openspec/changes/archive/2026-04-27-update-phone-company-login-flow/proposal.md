# Change: update-phone-company-login-flow

## Why
现有登录流程基于“用户名+密码”并混合验证码/注册/找回入口，已不符合目标后端鉴权体系。需要统一为手机号登录，并按手机号先查询可登录公司，再输入密码完成登录，同时把权限来源切换为 `/api/auth/me`。

## What Changes
- 登录页改为单一入口：手机号登录（隐藏账号密码登录、验证码登录、注册、找回密码入口）。
- 登录流程改为三阶段：
  - 输入并校验手机号；
  - 根据手机号调用 `/api/auth/companies` 获取公司列表并选择公司；
  - 输入密码并调用 `/api/auth/login` 完成登录。
- 鉴权接口切换：
  - 退出登录：`POST /api/auth/logout`
  - 当前用户：`GET /api/auth/me`
- Token 策略调整：
  - 当前阶段不再使用 refresh token 自动刷新流程；
  - 保留 `refreshToken` 字段（用于后续扩展兼容）。
- 权限与菜单策略调整：
  - 使用前端静态路由作为菜单与页面来源，不再依赖后端动态路由拉取；
  - 基于 `/api/auth/me` 的 `role/position` 映射前端 `roles`，并据此控制菜单可见性与页面访问。
- 保留并强化前端“独立菜单权限配置文件”能力，用于集中维护角色映射与路由/菜单权限规则。

## Impact
- Affected specs:
  - `authentication`
  - `frontend-access-control`
- Affected code (expected):
  - `src/pages/login/*`
  - `src/api/user/*`（或拆分为 `src/api/auth/*`）
  - `src/store/auth.ts`
  - `src/store/user.ts`
  - `src/router/guard/auth-guard.tsx`
  - `src/router/routes/config.ts`
  - `src/router/routes/modules/*`
  - 新增独立权限映射配置文件（路径待实施时确定）
  - `fake/*.fake.ts`（联调用 mock 时）
  - `src/locales/*/authority.json`（文案）
