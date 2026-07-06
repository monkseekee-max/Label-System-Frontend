# ADR-019 P0 API 契约冻结清单

> 状态：P0 基线清单 v1  
> 范围：训练工厂 `/api/v1/factory/*`、标注系统 `/api/v1/label/*`、label-system BFF `/api/data|ai|workflows/*`

## 1. 通用规则

- `/api/v1/factory/*` 成功响应统一信封：`{ code, message, data }`。
- `/api/v1/factory/*` 业务错误统一信封：`{ code, message, data: null, error_code, context? }`。
- factory 规范端点对前端暴露 camelCase 字段；旧裸响应端点必须在 client 层显式标注为 legacy/raw。
- 分页统一使用 `offset` / `limit`；前端 `pageNo` / `pageSize` 仅在 client 层转换。
- 时间字段统一 ISO 8601 字符串；缺失值使用 `null` 或空字符串由 client 映射。
- 多租户 `companyId` 仅供 admin 跨租户；普通用户最终以 JWT claim 中 `company_id` 为准。
- 生产模式禁止真实 API 失败回退 Mock。

## 2. `/api/v1/factory/*` 端点

| 端点 | 方法 | 响应 | 分页 | 鉴权 | 租户 | 字段 | 备注 |
|---|---|---|---|---|---|---|---|
| `/api/v1/factory/overview` | GET | 信封 | 无 | `verify_api_key` | 全局 | camelCase | 工厂总览 |
| `/api/v1/factory/ops-board` | GET | 信封 | 无 | `verify_api_key` + `require_tenant` | `companyId` | camelCase | 运营看板 |
| `/api/v1/factory/task-types` | GET | 信封 | 无 | `verify_api_key` | 全局 | camelCase | 任务类型目录 |
| `/api/v1/factory/lora/versions` | GET | 信封 | 无 | `verify_api_key` + `require_tenant` | `companyId` | camelCase | LoRA 分组列表 |
| `/api/v1/factory/lora/activate` | POST | 信封 | 无 | `verify_api_key` + `require_tenant` | body `companyId` | camelCase | 激活版本 |
| `/api/v1/factory/lora/rollback` | POST | 信封 | 无 | `verify_api_key` + `require_tenant` | body `companyId` | camelCase | 回滚版本 |
| `/api/v1/factory/lora/cleanup` | POST | 信封 | 无 | `verify_api_key` + `require_tenant` | body `companyId` | camelCase | 删除前强制归档 |
| `/api/v1/factory/tasks` | GET | 信封 | `offset/limit` | `verify_api_key` + `require_tenant` | `companyId` | camelCase | 训练任务列表 |
| `/api/v1/factory/tasks/{task_id}` | GET | 信封 | 无 | `verify_api_key` | 任务归属 | camelCase | 任务详情 |
| `/api/v1/factory/tasks` | POST | 信封 | 无 | `verify_api_key` + `require_tenant` | body `companyId` | camelCase | 创建训练任务 |
| `/api/v1/factory/tasks/{task_id}/logs` | GET | 信封 | `offset/tail` | `verify_api_key` | 任务归属 | camelCase | 日志读取 |
| `/api/v1/factory/eval/run` | POST | 信封 | 无 | `verify_api_key` + `require_tenant` | by loraVersion | camelCase | 触发评测 |
| `/api/v1/factory/eval/results` | GET | 信封 | `offset/limit` | `verify_api_key` + `require_tenant` | `companyId` | camelCase | 支持 `job_id` 单查 |
| `/api/v1/factory/eval/benchmarks` | GET | 信封 | 无 | `verify_api_key` + `require_tenant` | `companyId` | camelCase | 基准集列表 |
| `/api/v1/factory/eval/benchmark` | POST | 信封 | 无 | `verify_api_key` + `require_tenant` | body `companyId` | camelCase | 创建基准集 |
| `/api/v1/factory/alignment/*` | GET/POST/PUT | 信封 | 部分 `limit` | `verify_api_key` + `require_tenant` | `companyId` | camelCase | 专家对齐 |
| `/api/v1/factory/datasets/overview` | GET | 信封 | 无 | `verify_api_key` + `require_tenant` | `companyId` | camelCase | 数据集统计 |
| `/api/v1/factory/datasets` | GET | 信封 | `offset/limit` | `verify_api_key` + `require_tenant` | `companyId` | camelCase | 数据集列表 |
| `/api/v1/factory/data/batches` | GET | 信封 | `offset/limit` | `verify_api_key` + `require_tenant` | `companyId` | camelCase | 数据管道批次 |
| `/api/v1/factory/data/import` | POST | 信封 | 无 | `verify_api_key` + `require_tenant` | body `companyId` | camelCase | 数据导入 |
| `/api/v1/factory/scheduler/*` | GET/PUT/POST | 信封 | 部分 `limit` | `verify_api_key` + `require_tenant` | `companyId` | camelCase | 调度配置/历史 |
| `/api/v1/factory/gpu/list` | GET | 信封 | 无 | `verify_api_key` | 全局 | camelCase | GPU 列表 |
| `/api/v1/factory/gpu/alarms` | GET | 信封 | `limit` | `verify_api_key` | 全局 | camelCase | GPU 告警 |

## 3. Legacy / raw 端点

| 端点 | 方法 | 响应 | 使用方 | 迁移策略 |
|---|---|---|---|---|
| `/api/v1/tasks/{id}` | GET | 裸响应 | `factory-client.getTaskStatus` | 保留 raw client 标注；后续补 factory 信封端点 |
| `/api/v1/tasks/{id}/cancel` | POST | 裸响应 | `cancelTrainingTask` | 显式 token/API key；无默认 key |
| `/api/v1/media` | GET | 裸响应 | `factory-client.getMedia` | 保留 raw client 标注；后续补 factory 信封端点 |
| `/api/v1/data/export` | GET | 文件流 | data-productivity | 显式鉴权，生产禁止默认 key |

## 4. `/api/v1/label/*` 端点

- 由 `src/app/label/routes.py` 注册，成功响应沿用统一响应工具或模块约定。
- P0 本轮仅冻结“必须鉴权、必须租户隔离、不允许生产 Mock fallback”的原则。
- P2 项目/任务中心落地时补充逐端点字段快照。

## 5. label-system BFF `/api/data|ai|workflows/*`

| 前缀 | 用途 | 响应 | 鉴权 | P0 冻结点 |
|---|---|---|---|---|
| `/api/data/*` | 资产/数据服务代理 | 源服务裸响应 | 前端 Bearer token | 无 token 直接前端认证错误，不伪造默认 Bearer |
| `/api/ai/*` | 预标注/QA/多模态 AI 代理 | 源服务裸响应 | 前端 Bearer token | 失败不得生产回退 Mock |
| `/api/workflows/*` | 审核/工作流代理 | 源服务裸响应 | 前端 Bearer token | 无 token 不发请求 |

## 6. 已有契约测试

- `tests/unit/test_factory_spec_api.py` 覆盖 factory 信封、字段、分页、多租户与错误响应。
- `frontend/src/__tests__/factory-mapping.test.ts` 覆盖前端字段映射。
- `frontend/src/__tests__/factory-fallback.test.ts` 覆盖 Mock fallback enabled/disabled/production 行为。
- `frontend/src/__tests__/label-system-auth.test.ts` 覆盖 BFF 默认 token 禁止。
