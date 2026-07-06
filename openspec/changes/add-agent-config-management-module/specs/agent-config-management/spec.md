## ADDED Requirements
### Requirement: Agent Configuration Management Page
系统 SHALL 提供 Agent 配置管理页面，支持按公司维度查看 Agent 配置映射及可选配置数据。

#### Scenario: User opens agent configuration page successfully
- **WHEN** 具备权限的用户进入 Agent 配置管理页面
- **THEN** 系统调用 `GET /api/agent-configs`
- **AND** 页面展示 `agentConfigs` 映射及可选 `modelConfigs`、`promptConfigs` 列表

### Requirement: Agent Configuration Save
系统 SHALL 支持用户编辑并保存 Agent 配置映射。

#### Scenario: User saves updated agent configuration successfully
- **WHEN** 用户修改某个 Agent 的模型配置或提示词配置并点击保存
- **THEN** 系统调用 `POST /api/agent-configs` 提交 `SaveAgentConfigRequest`
- **AND** 请求体 `agentConfigs` 使用 AgentType 作为 key，值包含 `modelConfigId` 与可选 `promptConfigId`
- **AND** 保存成功后页面显示成功反馈并保持最新配置状态
