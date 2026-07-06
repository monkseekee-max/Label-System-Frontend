# Change: Add Agent Configuration Management Module

## Why
当前系统缺少 Agent 配置管理入口，无法在前端为公司维度维护 Agent 与模型配置、提示词配置的绑定关系，影响运营和管理效率。

## What Changes
- 新增“Agent 配置管理”模块页面，用于查看与保存 Agent 配置映射。
- 对接后端接口：
  - `GET /api/agent-configs`：获取当前公司 Agent 配置、可选模型配置列表、可选提示词配置列表。
  - `POST /api/agent-configs`：提交保存 Agent 配置映射。
- 新增模块菜单与路由，仅 `SUPER_ADMIN` 和 `ADMIN` 可见与可访问。
- 暂不引入额外后端依赖和轮询机制，按页面加载与显式保存交互。

## Impact
- Affected specs:
  - `agent-config-management`（新增能力）
  - `frontend-access-control`（新增菜单权限规则）
- Affected code:
  - `src/api/*`（新增 Agent 配置接口封装与类型）
  - `src/pages/*`（新增 Agent 配置管理页面）
  - `src/router/routes/modules/*`（新增菜单路由）
  - `src/router/permission-mapping*` / 权限相关配置文件（接入角色可见性）
