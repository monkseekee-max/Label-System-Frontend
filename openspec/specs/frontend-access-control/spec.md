# frontend-access-control Specification

## Purpose
TBD - created by archiving change update-phone-company-login-flow. Update Purpose after archive.
## Requirements
### Requirement: Static Route Access Control Source
系统 SHALL 使用前端静态路由作为菜单与访问控制的唯一路由来源。

#### Scenario: Dynamic route fetch is not used
- **WHEN** 用户登录并进入系统
- **THEN** 系统不依赖后端动态路由接口来构建菜单树
- **AND** 菜单与可访问页面基于前端静态路由配置生成

### Requirement: Role and Position Mapping for Frontend Roles
系统 SHALL 将 `/api/auth/me` 返回的 `role` 与 `position` 通过独立配置映射为前端 `roles` 集合，用于复用既有路由权限判断。

#### Scenario: Mapped role grants expected menus
- **WHEN** 用户 `role/position` 命中映射规则
- **THEN** 系统生成对应前端 `roles`
- **AND** 用户仅可见与可访问该角色允许的菜单与页面

#### Scenario: Unknown role or position falls back safely
- **WHEN** 用户 `role/position` 未命中映射规则
- **THEN** 系统应用最小权限降级策略
- **AND** 不暴露受限菜单与受限页面

### Requirement: Independent Frontend Permission Configuration File
系统 SHALL 保留独立的前端菜单权限配置文件，用于集中维护角色映射与菜单权限策略。

#### Scenario: Permission rules can be maintained without editing page components
- **WHEN** 需要调整角色映射或菜单权限策略
- **THEN** 开发者可通过独立配置文件完成调整
- **AND** 无需在业务页面组件中分散修改权限判断逻辑
