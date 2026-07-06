# authentication Specification

## Purpose
TBD - created by archiving change update-phone-company-login-flow. Update Purpose after archive.
## Requirements
### Requirement: Phone-Company-Password Login Flow
系统 SHALL 提供手机号登录流程，并按“手机号校验 -> 公司查询与选择 -> 密码输入与登录提交”的顺序完成认证。

#### Scenario: Login flow succeeds with valid phone and company
- **WHEN** 用户输入合法手机号并成功获取可登录公司列表，随后选择公司并输入正确密码
- **THEN** 系统调用 `POST /api/auth/login`，请求体包含 `phone`、`companyCode`、`password`
- **AND** 登录成功后持久化 token 并跳转到首页或 redirect 目标页

#### Scenario: Company query is blocked for invalid phone
- **WHEN** 用户输入手机号不合法
- **THEN** 系统不发起公司查询请求
- **AND** 页面展示手机号格式校验提示

#### Scenario: Password submission is blocked without company selection
- **WHEN** 用户尚未选择公司
- **THEN** 系统禁用或阻止登录提交
- **AND** 页面提示先选择公司

### Requirement: Authentication API Alignment
系统 SHALL 使用 `/api/auth/*` 认证接口作为唯一鉴权数据来源。

#### Scenario: Fetch companies by phone
- **WHEN** 用户输入合法手机号并触发公司查询
- **THEN** 系统调用 `GET /api/auth/companies?phone=<phone>`
- **AND** 将返回列表渲染为可选公司项

#### Scenario: Load current user profile after login
- **WHEN** 用户已持有有效登录 token
- **THEN** 系统调用 `GET /api/auth/me` 获取当前登录用户信息
- **AND** 后续权限判定使用该接口返回数据

#### Scenario: Logout uses unified endpoint
- **WHEN** 用户执行退出登录
- **THEN** 系统调用 `POST /api/auth/logout`
- **AND** 清理本地登录态并返回登录页

### Requirement: Legacy Login Entrances Hidden
系统 SHALL 在登录页隐藏非目标流程入口（账号密码直登、验证码登录、注册、找回密码）。

#### Scenario: Only phone login entry is visible
- **WHEN** 未登录用户访问登录页
- **THEN** 页面仅展示手机号登录主流程入口
- **AND** 不展示验证码登录、注册、找回密码的入口按钮

### Requirement: Refresh Token Extensibility Without Runtime Refresh
系统 SHALL 保留 refreshToken 字段以保持扩展能力，但当前阶段 MUST NOT 执行自动刷新 token 流程。

#### Scenario: Auth state keeps refresh token field
- **WHEN** 系统初始化或保存登录态
- **THEN** 鉴权状态结构中仍包含 `refreshToken` 字段

#### Scenario: No refresh retry on unauthorized response
- **WHEN** 受保护请求返回 401
- **THEN** 系统不调用 refresh token 接口进行自动重试
- **AND** 按未登录流程处理（清理状态并引导重新登录）
