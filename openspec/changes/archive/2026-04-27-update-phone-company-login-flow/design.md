## Context
当前项目鉴权链路基于模板实现：登录返回 `token + refreshToken`，路由可走前后端两种权限模式。目标后端接口已明确为 `/api/auth/*`，且登录模型为 `phone + companyCode + password`，权限信息在 `/api/auth/me` 中返回 `role/position`。

本次变更跨越登录 UI、鉴权 API、路由权限策略和状态结构，属于跨模块改造，需要先固化设计决策，避免实现阶段反复。

## Goals / Non-Goals
- Goals:
  - 统一登录体验为手机号 -> 公司选择 -> 密码登录。
  - 使用 `/api/auth/me` 作为用户登录态与权限信息来源。
  - 权限模式固定为前端静态路由控制，并保留独立权限配置文件。
  - 保留 `refreshToken` 字段兼容性，但停用自动刷新机制。
- Non-Goals:
  - 不引入新的后端动态路由协议。
  - 不在本变更内重构全部业务页面权限模型（仅保证兼容映射可工作）。
  - 不在本变更内新增“修改密码”流程页面（接口可后续接入）。

## Decisions
- Decision: 登录流程采用“串行门禁”
  - 用户必须先通过手机号校验并成功获取公司列表，才可选择公司并输入密码。
  - Rationale: 对齐后端认证前提，避免提交无 `companyCode` 的无效登录请求。

- Decision: 认证 API 统一收敛到 `/api/auth/*`
  - 登录、登出、当前用户信息均使用新接口契约。
  - Rationale: 降低后续接入成本，避免双协议并存。

- Decision: Refresh Token 进入“结构保留、流程停用”模式
  - Store 类型继续保留 `refreshToken` 字段，但请求层不再触发 refresh 重试链路。
  - Rationale: 满足可扩展性要求，同时简化当前行为并避免无效刷新调用。

- Decision: 权限控制固定为“静态路由 + 角色映射配置”
  - 通过独立配置文件将 `role/position` 映射为前端角色集合，再复用现有 `roles/permissions` 机制。
  - Rationale: 保留前端权限配置自治能力，避免路由权限散落在业务代码中。

## Alternatives considered
- Alternative A: 直接用 `role/position` 覆盖全项目 `roles` 字段定义
  - Rejected: 改动面过大，历史路由配置和组件权限判断会产生连锁修改。

- Alternative B: 继续保留后端动态路由并与静态路由并存
  - Rejected: 与“路由使用前端静态路由”的目标冲突，且增加复杂度。

## Risks / Trade-offs
- 风险: 角色映射不完整导致菜单显示异常。
  - Mitigation: 提供默认降级映射（最小权限），并对未知 role/position 输出可观测告警。

- 风险: 旧登录入口被隐藏后，依赖这些入口的测试或文档失效。
  - Mitigation: 同步更新页面用例与文档，移除或改写旧入口断言。

- 风险: 停用 refresh 后，token 过期用户会更频繁回到登录页。
  - Mitigation: 401 明确跳转登录并保留回跳地址，保持体验可预期。

## Migration Plan
1. 新增认证 API 契约类型与调用方法。
2. 改造登录页面为手机号三阶段流程并隐藏其他入口。
3. 切换用户信息来源到 `/api/auth/me`。
4. 固定前端静态路由权限模式，落地独立映射配置文件。
5. 停用 refresh token 自动刷新链路（保留字段）。
6. 完成联调、测试与文档更新。

## Open Questions
- 无（关键行为已由需求确认）。
