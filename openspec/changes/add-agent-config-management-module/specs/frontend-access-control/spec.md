## ADDED Requirements
### Requirement: Agent Configuration Menu Visibility
系统 SHALL 仅向 `SUPER_ADMIN` 和 `ADMIN` 展示 Agent 配置管理菜单，并仅允许这两类角色访问对应页面路由。

#### Scenario: Authorized roles can see and access agent configuration module
- **WHEN** 用户前端角色为 `SUPER_ADMIN` 或 `ADMIN`
- **THEN** 系统展示 Agent 配置管理菜单
- **AND** 用户可访问 Agent 配置管理页面

#### Scenario: Non-authorized roles cannot see or access agent configuration module
- **WHEN** 用户前端角色不是 `SUPER_ADMIN` 且不是 `ADMIN`
- **THEN** 系统不展示 Agent 配置管理菜单
- **AND** 用户直接访问该路由时被拒绝并进入无权限流程
