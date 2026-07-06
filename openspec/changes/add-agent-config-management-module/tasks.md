## 1. OpenSpec
- [x] 1.1 新增 `agent-config-management` 能力规格
- [x] 1.2 为 `frontend-access-control` 增加该模块的角色可见性规则
- [x] 1.3 通过 `openspec validate add-agent-config-management-module --strict`

## 2. API Layer
- [x] 2.1 新增 Agent 配置管理接口类型定义（列表响应、保存请求）
- [x] 2.2 新增 `GET /api/agent-configs` 与 `POST /api/agent-configs` 请求封装

## 3. Frontend Module
- [x] 3.1 新增“Agent 配置管理”页面与基础布局
- [x] 3.2 基于列表接口渲染 Agent 配置项（Agent 类型、已选模型、已选提示词）
- [x] 3.3 提供模型配置与提示词配置选择能力
- [x] 3.4 实现保存动作并调用保存接口

## 4. Routing & Access Control
- [x] 4.1 新增菜单路由配置并接入系统导航
- [x] 4.2 配置仅 `SUPER_ADMIN` 和 `ADMIN` 可访问

## 5. Verification
- [x] 5.1 `pnpm typecheck`
- [x] 5.2 `pnpm build`
