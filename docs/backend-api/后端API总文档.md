# API 文档 (API Reference)

> **更新日期**: 2026-06-10
> **Base URL**: `http://127.0.0.1:9090`
> **外网地址**: `https://65ca-2409-8a4c-e5-8110-d48c-337c-6f0e-af0a.ngrok-free.app`
> **API 版本**: v1
> **认证方式**: `X-API-Key` Header
> **配套文档**: ADR-010 (接口规范化) / 开发计划文档 §9 / operation.md / ADR-006

本文档为模型工厂对外开放 API 的总览。**完整的交互式文档由 FastAPI 自动生成**, 启动 API 服务后访问：

- **Swagger UI**: `https://65ca-2409-8a4c-e5-8110-d48c-337c-6f0e-af0a.ngrok-free.app/docs`
- **ReDoc**: `https://65ca-2409-8a4c-e5-8110-d48c-337c-6f0e-af0a.ngrok-free.app/redoc`
- **OpenAPI JSON**: `https://65ca-2409-8a4c-e5-8110-d48c-337c-6f0e-af0a.ngrok-free.app/openapi.json`

> 当代码与本页面发生冲突时, 以 `/docs` (代码生成) 为准。
> **ADR-010 变更标记**: 本文档中 `[ADR-010]` 标记表示 ADR-010 接口规范化修复的内容。

---

## 目录

1. [通用约定](#1-通用约定)
2. [认证与安全](#2-认证与安全)
3. [能力域总览](#3-能力域总览)
4. [健康检查 API](#4-健康检查-api)
5. [数据管道 API](#5-数据管道-api)
6. [指标可视化 API](#6-指标可视化-api)
7. [模型评测 API](#7-模型评测-api)
8. [专家对齐 API](#8-专家对齐-api)
9. [训练调度 API](#9-训练调度-api)
10. [LoRA 管理 API](#10-lora-管理-api)
11. [训练 API (后台任务)](#11-训练-api-后台任务)
12. [推理代理 API](#12-推理代理-api)
13. [后台任务队列 API](#13-后台任务队列-api)
14. [V2 多模态 API](#14-v2-多模态-api)
15. [系统管理 API](#15-系统管理-api)
16. [Webhook (Label Studio)](#16-webhook-label-studio)
17. [错误码参考](#17-错误码参考)
18. [客户端调用示例](#18-客户端调用示例)

---

## 1. 通用约定

### 1.1 Base URL

```
http://127.0.0.1:9090    # 笔记本/单机部署
https://factory.internal  # 服务器迁移后 (内网域名)
```

### 1.2 媒体类型

- 请求体: `application/json; charset=utf-8`
- 响应体: `application/json; charset=utf-8`
- 文件上传: `multipart/form-data`
- WebSocket: `ws://` (实时指标流)

### 1.3 时间格式 `[ADR-010 BUG-003]`

所有时间字段为 **ISO 8601 + 时区**, 无例外:

```
2026-06-02T14:15:30+08:00
2026-06-02T06:15:30Z
2026-06-02T14:15:30+00:00
```

> 所有端点返回的时间戳均通过 `format_dt()` 统一格式化。SQLite 测试环境自动附加 UTC 时区。
> **不接受**无时区的裸时间戳 (如 `2026-06-02T14:15:30`)。

### 1.4 标识符约定

| ID 类型 | 格式 | 示例 |
|---------|------|------|
| `run_id` | `run_{YYYYMMDDHHmmss}_{rand}` | `run_20260602143000_a1b2` |
| `batch_id` | `batch_{YYYYMMDDHHmmss}` | `batch_20260602143000` |
| `lora_version` | `lora_v{YYYYMMDD}_{NNN}` | `lora_v20260602_001` |
| `job_id` (eval) | `eval_{YYYYMMDDHHmmss}` | `eval_20260602143000` |
| `benchmark_id` | `benchmark_{hex8}` | `benchmark_a1b2c3d4` |
| `task_id` | `{prefix}_{YYYYMMDDHHmmss}_{hex6}` | `train_20260603110536_34d209` |
| `fingerprint` | 16 字符 hex | `3f8a9b2c1d4e5f67` |
| `media_id` | `{type}_{ts_ms}_{checksum16}` | `image_1717315200000_a1b2c3d4` |

### 1.5 分页约定 `[ADR-010 BUG-004]`

长列表接口统一使用 `limit` / `offset` 参数:

| 参数 | 默认 | 范围 | 说明 |
|------|------|------|------|
| `limit` | 20 | 1-100 | 单页条数 |
| `offset` | 0 | ≥ 0 | 跳过条数 |

**适用端点**:
- `GET /api/v1/data/list`
- `GET /api/v1/eval/results`
- `GET /api/v1/media`
- `GET /api/v1/tasks`

响应:
```json
{
  "items": [...],
  "total": 1234,
  "limit": 20,
  "offset": 0
}
```

### 1.6 排序约定 `[ADR-010 BUG-014]`

支持排序的端点通过 `sort` 参数指定排序字段:

| 端点 | 支持 sort 值 | 默认 |
|------|-------------|------|
| `GET /api/v1/data/list` | `created_at`, `quality_score`, `status` | `created_at DESC` |

### 1.7 创建资源响应 `[ADR-010 BUG-013]`

POST 创建新资源的端点统一返回 `201 Created` (而非 200 OK):

| 端点 | 状态码 |
|------|--------|
| `POST /api/v1/data/import` | 201 |
| `POST /api/v1/data/sync` (source=upload) | 201 |
| `POST /api/v1/eval/benchmark` | 201 |
| `POST /api/v1/alignment/feedback` | 201 |
| `POST /api/v1/media/upload` | 201 |

### 1.8 Pydantic 请求模型清单

| 模型名 | 用途 | 关键字段 |
|--------|------|---------|
| `DataImportRequest` | 数据导入 | `source`, `batch_id`, `records`, `auto_clean` |
| `DataUpdateRequest` | 数据更新 `[ADR-010]` | `answer?`, `question?`, `status?`, `quality_override?` |
| `EvalRunRequest` | 触发评测 | `lora_version`, `benchmark_id`, `compare_with`, `model_1`, `vllm_base_url` |
| `BenchmarkCreateRequest` | 创建基准集 | `name`, `description`, `samples`, `benchmark_id?` |
| `ExpertFeedbackRequest` | 专家反馈 | `sample_id`, `feedback_type`, `original_question`, `original_answer` |
| `SchedulerModeRequest` | 调度模式 | `mode` |
| `LoRAActivateRequest` | 激活 LoRA | `version_tag` |
| `LoRARollbackRequest` | 回滚 LoRA | `version_tag?` |
| `MultimodalTrainRequest` | 多模态训练 | `model`, `epochs`, `lora_rank`, `lr` 等 |
| `InferenceRequest` | 推理请求 `[ADR-010]` | `messages`, `model`, `temperature`, `max_tokens`, `timeout` |

---

## 2. 认证与安全

### 2.1 认证方式

所有受保护接口都需要在请求头携带 API Key:

```
X-API-Key: <32+ 字符随机串>
```

API Key 通过 `.env` 中 `API_KEY` 配置, 服务器迁移后改由 Vault / KMS 注入。

### 2.2 Webhook 签名

Label Studio Webhook 额外使用 HMAC-SHA256 签名:

```
X-LabelStudio-Signature: <hex digest>
```

签名计算: `HMAC-SHA256(WEBHOOK_SECRET, raw_body).hexdigest()`  
参见: `src/data_flywheel/webhook_receiver.py`

### 2.3 本地绑定 (ADR-006)

服务默认监听 `0.0.0.0:9090`, 可通过 `.env` 中 `API_HOST` / `API_PORT` 调整。生产环境通过 Nginx 反代 + 内网 ACL 控制。

### 2.4 统一错误响应 `[ADR-010 BUG-006]`

所有业务错误均返回结构化格式:

```json
{
  "detail": "描述信息",
  "error_code": "ERROR_CODE_NAME",
  "context": {"key": "value"}
}
```

- `detail`: 人类可读的错误描述
- `error_code`: 机器可读的业务错误码 (见 §17.2)
- `context`: 错误上下文信息 (可选, 无 context 时不包含此字段)

认证失败统一返回:
```json
{"detail": "无效的API Key"}
```
HTTP 状态码 `401 Unauthorized`。

---

## 3. 能力域总览

| 路径前缀 | 用途 | 端点数 |
|---------|------|--------|
| `/health` | 健康检查 (含 DB/vLLM 状态) `[ADR-010]` | 1 |
| `/api/v1/data` | 数据管道 (导入/清洗/同步/查询/修改/删除) | 8 |
| `/api/v1/train` | 训练触发 (文本/多模态) | 2 |
| `/api/v1/tasks` | 后台任务队列 (状态/日志/取消) | 4 |
| `/api/v1/inference` | 推理代理 (自动路由 + 超时配置) `[ADR-010]` | 1 |
| `/api/v1/lora` | LoRA 版本管理 (激活/回滚/清理) | 5 |
| `/api/v1/eval` | 模型评测与质量门禁 | 6 |
| `/api/v1/alignment` | 专家对齐闭环 | 4 |
| `/api/v1/scheduler` | 训练调度 (手动/半自动/自动) | 6 |
| `/api/v1/metrics` | 指标可视化与版本对比 | 4 |
| `/api/v1/media` | 媒体资源管理 (图像/视频上传) | 3 |
| `/api/v1/tasks/types` | 任务类型与标注模板 | 3 |
| `/api/v1/system` | 系统状态总览 (GPU/vLLM/LS) | 4 |
| `/webhook` | Label Studio Webhook 回调 | 1 |
| `/` | SPA 前端页面 | 6 |
| **合计** | | **58** |

---

## 4. 健康检查 API

### 4.1 健康检查 `[ADR-010 BUG-015 增强]`

```
GET /health
```

无需认证。返回服务运行状态和依赖服务健康度。

**查询参数**:

| 参数 | 默认 | 可选值 | 说明 |
|------|------|--------|------|
| `mode` | `light` | `light` / `full` | light 仅查 DB, full 额外查 vLLM |

**响应 (mode=light)**:
```json
{
  "status": "ok",
  "service": "llm-factory-api",
  "version": "1.0.0",
  "db": "ok"
}
```

**响应 (mode=full)**:
```json
{
  "status": "ok",
  "service": "llm-factory-api",
  "version": "1.0.0",
  "db": "ok",
  "vllm": {
    "text": {
      "running": true,
      "port": 8001,
      "pids": [12345],
      "models": ["qwen3-8b", "latest"]
    },
    "multimodal": {
      "running": false,
      "port": 8002,
      "pids": [],
      "models": []
    }
  }
}
```

**状态值说明**:
- `status=ok`: 所有依赖正常
- `status=degraded`: DB 或核心依赖不可用
- `db=ok` / `db=error: ...`: 数据库连接状态
- `vllm.*.running`: vLLM 进程是否在运行

---

## 5. 数据管道 API

### 5.1 批量导入标注数据 `[ADR-010 BUG-005 增强]`

```
POST /api/v1/data/import
X-API-Key: required
```

**状态码**: `201 Created`

**请求体** (`DataImportRequest`):
```json
{
  "source": "etl_pipeline",
  "batch_id": "batch_20260602143000",
  "records": [
    {
      "task_id": "task_001",
      "resource_name": "公司体检通知.docx",
      "qa_content": {
        "records": [
          {
            "id": "qa_001",
            "question": "体检什么时候开始？",
            "answer": "下周一上午 8 点。",
            "sourceSegments": {"segment": "公司将于下周一上午 8 点组织体检..."},
            "scores": {"similarity": 0.95, "confidence": 0.92, "trust": 0.9, "hallucination": 0.9}
          }
        ]
      },
      "reviewer_name": "张三"
    }
  ],
  "auto_clean": true,
  "auto_format": false
}
```

**支持的 records 格式 `[ADR-010 BUG-005]`**:

管道自动检测并支持两种格式:

1. **平铺格式** (直接传递字段):
```json
{
  "question": "公司体检什么时间？",
  "answer": "6月20日至6月25日。",
  "source_segment": "公司将于...",
  "scores": {"trust": 0.95, "hallucination": 0.9}
}
```

2. **嵌套格式** (qa_content.records[], 对齐 api.md §4.1):
```json
{
  "task_id": "task_001",
  "resource_name": "通知.docx",
  "qa_content": {
    "records": [
      {
        "id": "qa_001",
        "question": "问题",
        "answer": "答案",
        "sourceSegments": {"segment": "原始段落"},
        "scores": {"similarity": 0.95}
      }
    ]
  }
}
```

**字段映射**:

| 嵌套字段 | 映射到 | 说明 |
|---------|--------|------|
| `qa_content.records[].id` | `annotation_id` | 缺少时自动生成 |
| `qa_content.records[].sourceSegments.segment` | `source_segment` | 可选 |
| `qa_content.records[].scores` | `scores` (trust/confidence/hallucination/similarity) | 可选 |
| `resource_name` | `document_title` | 可选 |
| `reviewer_name` | `annotator` | 可选 |

**响应**:
```json
{
  "batch_id": "batch_20260602143000",
  "total_received": 50,
  "imported": 45,
  "duplicates": 3,
  "filtered": 2,
  "errors": 0,
  "status": "cleaning"
}
```

**限制**: 单次最多 500 条 records。

### 5.2 增量同步数据 `[ADR-010 BUG-002 修复]`

```
POST /api/v1/data/sync
X-API-Key: required
```

**状态码**: `201 Created` (source=upload 时)

**查询参数**:

| 参数 | 默认 | 可选值 | 说明 |
|------|------|--------|------|
| `source` | `labelstudio` | `labelstudio` / `upload` | 数据来源模式 |
| `project_id` | `1` | 整数 | Label Studio 项目 ID (仅 source=labelstudio) |

**模式一: source=labelstudio** (从 Label Studio 拉取, 不需要请求体):
```bash
curl -X POST "http://127.0.0.1:9090/api/v1/data/sync?source=labelstudio&project_id=1" \
  -H "X-API-Key: $API_KEY"
```

**模式二: source=upload** (等同于 `/data/import`, **必须提供请求体**):
```bash
curl -X POST "http://127.0.0.1:9090/api/v1/data/sync?source=upload" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"upload","records":[{"question":"Q","answer":"A","scores":{"trust":0.9,"hallucination":0.9}}]}'
```

**错误响应** (source=upload 但未提供请求体):
```json
{
  "detail": "source=upload 时需提供请求体",
  "error_code": "MISSING_REQUEST_BODY",
  "context": {"source": "upload"}
}
```

**幂等性**: 相同 `batch_id` 重复推送不会重复入库 (fingerprint 去重)。

### 5.3 查询数据状态

```
GET /api/v1/data/status
X-API-Key: required
```

**响应**:
```json
{
  "total_annotations": 12847,
  "by_status": {
    "collected": 234,
    "cleaned": 12000,
    "formatted": 11500,
    "trained": 10000,
    "skipped": 613
  },
  "by_quality_tier": {
    "high": 9000,
    "medium": 3000,
    "low": 847
  },
  "last_import_at": "2026-06-02T14:00:00+00:00"
}
```

> `last_import_at` 始终包含时区信息 `[ADR-010 BUG-003]`

### 5.4 预校验数据 (不入库)

```
POST /api/v1/data/validate
X-API-Key: required
```

请求体与 `/import` 一致, 仅返回校验结果, 不实际写库。用于正式推送前的探查。

### 5.5 查询数据列表 `[ADR-010 BUG-004/014 修复]`

```
GET /api/v1/data/list
X-API-Key: required
```

**查询参数**:

| 参数 | 默认 | 范围 | 说明 |
|------|------|------|------|
| `status` | 全部 | `collected` / `cleaned` / `skipped` | 按状态过滤 |
| `tier` | 全部 | `high` / `medium` / `low` | 按质量等级过滤 |
| `q` | 无 | 关键词 | 搜索问题/答案/文档内容 |
| `sort` | `created_at` DESC | `created_at` / `quality_score` / `status` | 排序字段 `[ADR-010 BUG-014]` |
| `limit` | 20 | 1-100 | 单页条数 `[ADR-010 BUG-004]` |
| `offset` | 0 | ≥ 0 | 跳过条数 |

**响应**:
```json
{
  "total": 12847,
  "limit": 20,
  "offset": 0,
  "items": [
    {
      "id": 42,
      "annotation_id": "qa_001",
      "question": "公司体检什么时间？",
      "answer": "6月20日至6月25日。",
      "status": "cleaned",
      "quality_score": 0.93,
      "quality_tier": "high",
      "document_title": "通知",
      "created_at": "2026-06-02T14:00:00+08:00"
    }
  ]
}
```

### 5.6 查询单条数据详情

```
GET /api/v1/data/{record_id}
X-API-Key: required
```

**响应**:
```json
{
  "id": 42,
  "annotation_id": "qa_001",
  "question": "公司体检什么时间？",
  "answer": "6月20日至6月25日。",
  "status": "cleaned",
  "quality_score": 0.93,
  "quality_tier": "high",
  "task_id": "task_001",
  "annotator": "张三",
  "document_title": "通知",
  "document_content": "公司将于...",
  "source_segment": "公司将于6月20日...",
  "scores": {
    "similarity": 0.95,
    "confidence": 0.92,
    "hallucination": 0.95,
    "trust": 0.93
  },
  "meta": {...},
  "created_at": "2026-06-02T14:00:00+08:00",
  "updated_at": "2026-06-02T15:30:00+08:00"
}
```

**错误响应** (记录不存在):
```json
{
  "detail": "记录不存在: 999999",
  "error_code": "RECORD_NOT_FOUND",
  "context": {"record_id": 999999}
}
```

### 5.7 修改标注数据 `[ADR-010 BUG-009 修复]`

```
PUT /api/v1/data/{record_id}
X-API-Key: required
```

**请求体** (`DataUpdateRequest`):

仅允许以下白名单字段, 非法字段被忽略:

```json
{
  "answer": "修正后的答案",
  "question": "修正后的问题",
  "status": "cleaned",
  "quality_override": 0.95
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `answer` | string? | 修正答案 |
| `question` | string? | 修正问题 |
| `status` | string? | 状态值, 仅允许: `collected` / `cleaned` / `skipped` / `formatted` / `trained` |
| `quality_override` | float? | 手动设置质量分 (0.0-1.0), 自动重算 quality_tier |

**响应**:
```json
{
  "id": 42,
  "status": "cleaned",
  "answer": "修正后的答案",
  "question": "修正后的问题",
  "quality_score": 0.95,
  "quality_tier": "high",
  "updated_at": "2026-06-02T15:30:00+08:00"
}
```

**错误响应** (非法状态值):
```json
{
  "detail": "非法状态: invalid_status, 合法值: [...]",
  "error_code": "INVALID_STATUS",
  "context": {"status": "invalid_status", "valid": ["collected", "cleaned", "skipped", "formatted", "trained"]}
}
```

### 5.8 删除标注数据

```
DELETE /api/v1/data/{record_id}
X-API-Key: required
```

软删除：将记录状态设为 `skipped`。

**响应**:
```json
{"id": 42, "status": "skipped"}
```

### 5.9 触发数据清洗

```
POST /api/v1/data/clean
X-API-Key: required
```

手动触发数据清洗流程：去重、质量评分、质量等级划分。

---

## 6. 指标可视化 API

### 6.1 单次训练完整指标

```
GET /api/v1/metrics/training/{run_id}
X-API-Key: required
```

**响应**:
```json
{
  "run_id": "run_20260602143000_a1b2",
  "status": "completed",
  "final_loss": 1.2,
  "duration_seconds": 1842,
  "train_samples": 480,
  "val_samples": 20,
  "lora_version_tag": "lora_v20260602_001",
  "started_at": "2026-06-02T14:30:00+08:00",
  "completed_at": "2026-06-02T15:00:42+08:00"
}
```

**错误响应**:
```json
{
  "detail": "run_id 不存在: nonexistent",
  "error_code": "RUN_NOT_FOUND",
  "context": {"run_id": "nonexistent"}
}
```

### 6.2 版本对比

```
GET /api/v1/metrics/comparison?versions=lora_v20260601_003&versions=lora_v20260602_001
X-API-Key: required
```

不指定 `versions` 时返回最近 5 个版本对比。

**响应**:
```json
{
  "versions": [
    {
      "version_tag": "lora_v20260602_001",
      "is_active": true,
      "created_at": "2026-06-02T15:00:00+08:00",
      "scores": {...},
      "gate_decision": "PASS",
      "gate_reason": "All metrics above thresholds"
    }
  ]
}
```

### 6.3 聚合看板

```
GET /api/v1/metrics/dashboard
X-API-Key: required
```

返回看板所需的全部聚合数据。

### 6.4 实时指标流 (WebSocket)

```
WS /api/v1/metrics/stream?token=<API_KEY>
```

训练期间推送:
```json
{"type": "step", "data": {"step": 10, "train_loss": 2.3, "lr": 1.5e-4}, "timestamp": "..."}
{"type": "eval", "data": {"step": 50, "eval_loss": 1.9, "perplexity": 6.7}, "timestamp": "..."}
{"type": "resource", "data": {"vram_used_gb": 14.8, "gpu_util": 0.92}, "timestamp": "..."}
{"type": "keepalive"}
```

> 浏览器 WebSocket 不支持自定义 Header, 因此通过 `?token=` query 参数传递 API Key。

---

## 7. 模型评测 API

### 7.1 触发评测任务

```
POST /api/v1/eval/run
X-API-Key: required
```

**请求体** (`EvalRunRequest`):
```json
{
  "lora_version": "lora_v20260602_001",
  "benchmark_id": "benchmark_v1",
  "compare_with": "lora_v20260601_003",
  "run_regression": true,
  "model_1": "latest",
  "vllm_base_url": null
}
```

**响应** (异步):
```json
{
  "job_id": "eval_20260602150000",
  "status": "running",
  "lora_version": "lora_v20260602_001",
  "benchmark_id": "benchmark_v1",
  "model_1": "latest",
  "vllm_base_url": null,
  "poll_url": "/api/v1/eval/results/eval_20260602150000"
}
```

### 7.2 查询评测结果

```
GET /api/v1/eval/results/{job_id}
X-API-Key: required
```

**响应**:
```json
{
  "job_id": "eval_20260602150000",
  "lora_version": "lora_v20260602_001",
  "status": "completed",
  "model_1": "latest",
  "vllm_base_url": null,
  "scores": {
    "qa_generate": {"accuracy": 0.82, "coverage": 0.78},
    "qa_answer": {"f1": 0.79, "rouge_l": 0.85},
    "hallucination_rate": 0.08
  },
  "gate_decision": "PASS",
  "gate_reason": "All metrics above thresholds; no regression > 5%",
  "test_samples": 50,
  "duration_seconds": 124,
  "completed_at": "2026-06-02T15:02:04+08:00"
}
```

**错误响应**:
```json
{
  "detail": "job_id 不存在: nonexistent",
  "error_code": "EVAL_JOB_NOT_FOUND",
  "context": {"job_id": "nonexistent"}
}
```

### 7.3 创建评测基准集 `[ADR-010 BUG-001/011 修复]`

```
POST /api/v1/eval/benchmark
X-API-Key: required
```

**状态码**: `201 Created`

**请求体** (`BenchmarkCreateRequest`):
```json
{
  "name": "RAG-QA Benchmark v2",
  "description": "80 条高质量评测样本, 含三类格式",
  "benchmark_id": "benchmark_v2",
  "samples": [
    {
      "id": "eval_001",
      "type": "qa_generate",
      "input": {"document": "..."},
      "expected": {"answer": "..."}
    }
  ]
}
```

**字段说明**:

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | 基准集名称 |
| `description` | 否 | 描述信息 |
| `benchmark_id` | 否 | 自定义 ID, 不提供则自动生成 |
| `samples` | 否 | 评测样本列表 |

> `samples` 数据会被持久化到 `datasets/benchmarks/{benchmark_id}.jsonl` 文件, 确保后续查询详情可获取完整样本内容 `[ADR-010 BUG-011]`。

**响应**:
```json
{
  "benchmark_id": "benchmark_a1b2c3d4",
  "name": "RAG-QA Benchmark v2",
  "sample_count": 1
}
```

### 7.4 列出评测基准集

```
GET /api/v1/eval/benchmarks
X-API-Key: required
```

**响应**:
```json
{
  "benchmarks": [
    {
      "benchmark_id": "benchmark_v1",
      "name": "Benchmark v1",
      "description": "...",
      "sample_count": 50,
      "file_path": "datasets/benchmarks/benchmark_v1.jsonl",
      "is_locked": false,
      "created_at": "2026-06-02T14:00:00+08:00"
    }
  ]
}
```

### 7.5 获取基准集详情

```
GET /api/v1/eval/benchmarks/{benchmark_id}
X-API-Key: required
```

返回基准集元数据 + 所有评测样本内容。

**错误响应**:
```json
{
  "detail": "benchmark 不存在: nonexistent",
  "error_code": "BENCHMARK_NOT_FOUND",
  "context": {"benchmark_id": "nonexistent"}
}
```

### 7.6 质量门禁检查

```
GET /api/v1/eval/gate?lora_version=lora_v20260602_001
X-API-Key: required
```

**错误响应**:
```json
{
  "detail": "未找到 lora_v_unknown 的评测结果",
  "error_code": "EVAL_RESULT_NOT_FOUND",
  "context": {"lora_version": "lora_v_unknown"}
}
```

### 7.7 列出评测结果

```
GET /api/v1/eval/results
X-API-Key: required
```

**查询参数**:

| 参数 | 默认 | 说明 |
|------|------|------|
| `lora_version` | 全部 | 按 LoRA 版本过滤 |
| `benchmark_id` | 全部 | 按基准集过滤 |
| `limit` | 20 | 单页条数 (1-100) |

---

## 8. 专家对齐 API

### 8.1 获取待对齐样本

```
GET /api/v1/alignment/pending?limit=20
X-API-Key: required
```

优先级基于自动评分低分排序 (低分=高优先级)。

### 8.2 提交专家反馈 `[ADR-010 BUG-013]`

```
POST /api/v1/alignment/feedback
X-API-Key: required
```

**状态码**: `201 Created`

**请求体** (`ExpertFeedbackRequest`):
```json
{
  "sample_id": "align_001",
  "feedback_type": "correction",
  "original_question": "...",
  "original_answer": "...",
  "corrected_answer": "...",
  "reason": "模型答案遗漏了关键时间信息",
  "expert_id": "expert_zhang",
  "confidence": 0.95
}
```

`feedback_type` 取值:
- `correction`: 专家给出修正答案
- `preference`: 专家在 chosen/rejected 间选择 (DPO 用)
- `rejection`: 标记该样本不应进入训练集

**响应**:
```json
{"status": "received", "feedback_id": 42}
```

### 8.3 触发对齐训练

```
POST /api/v1/alignment/train
X-API-Key: required
```

```json
{
  "strategy": "sft_correction",
  "min_feedback_count": 20,
  "correction_weight": 2.0,
  "model_key": "qwen3-8b"
}
```

### 8.4 对齐训练进度

```
GET /api/v1/alignment/progress
X-API-Key: required
```

```json
{
  "feedback_collected": 35,
  "pending": 15,
  "aligned": 20,
  "threshold": 20
}
```

---

## 9. 训练调度 API

### 9.1 查询调度器状态

```
GET /api/v1/scheduler/status
X-API-Key: required
```

返回调度器当前状态：是否应触发训练、调度模式、统计数据。

### 9.2 获取调度模式

```
GET /api/v1/scheduler/mode
X-API-Key: required
```

### 9.3 设置调度模式

```
PUT /api/v1/scheduler/mode
X-API-Key: required
```

```json
{"mode": "auto"}
```

可选值: `manual` / `semi_auto` / `auto`

**错误响应** (非法模式):
```json
{
  "detail": "无效的调度模式: invalid",
  "error_code": "INVALID_SCHEDULER_MODE",
  "context": {"mode": "invalid"}
}
```

### 9.4 列出训练建议

```
GET /api/v1/scheduler/proposals
X-API-Key: required
```

### 9.5 批准训练建议

```
POST /api/v1/scheduler/approve
X-API-Key: required
```

```json
{"proposal_id": "pending_20260602_001"}
```

### 9.6 手动触发训练 `[ADR-010 BUG-007]`

```
POST /api/v1/scheduler/trigger
X-API-Key: required
```

**查询参数**:

| 参数 | 默认 | 说明 |
|------|------|------|
| `model_key` | `qwen3-8b` | 模型标识 |
| `lora_profile` | `standard` | LoRA 配置 |
| `training_profile` | `standard` | 训练配置 |
| `use_seed` | `false` | 使用种子数据 |
| `dataset_path` | 无 | 自定义数据集路径 |

> 与 `POST /api/v1/train/text` 功能相同, 但语义不同: `scheduler/trigger` 是调度触发, `train/text` 是直接触发。两者内部统一调用 `training_dispatcher`。

**响应**:
```json
{
  "task_id": "train_20260603110536_34d209",
  "status": "queued",
  "version_tag": "lora_v20260603_002",
  "model_key": "qwen3-8b",
  "command": "python scripts/start_training.py ..."
}
```

---

## 10. LoRA 管理 API

### 10.1 列出所有版本

```
GET /api/v1/lora/versions
X-API-Key: required
```

### 10.2 当前活跃版本

```
GET /api/v1/lora/active
X-API-Key: required
```

### 10.3 激活指定版本

```
POST /api/v1/lora/activate
X-API-Key: required
```

```json
{"version_tag": "lora_v20260601_003"}
```

内部流程: 停 vLLM → 更新三重指针 (软链接 + PG + config) → 重启 vLLM → 健康检查。

**错误响应**:
```json
{
  "detail": "版本不存在: nonexistent",
  "error_code": "LORA_VERSION_NOT_FOUND",
  "context": {"version_tag": "nonexistent"}
}
```

### 10.4 回滚到上一版本

```
POST /api/v1/lora/rollback
X-API-Key: required
```

```json
{"version_tag": "lora_v20260601_003"}
```

不指定 `version_tag` 时回滚到当前活跃版本的前一个。

**错误响应**:
```json
{
  "detail": "当前无活跃版本, 无法回滚",
  "error_code": "LORA_VERSION_NOT_FOUND",
  "context": {"version_tag": null}
}
```

### 10.5 清理旧版本

```
POST /api/v1/lora/cleanup
X-API-Key: required
```

保留最近 N 个 (默认 5, 由 `MAX_LORA_VERSIONS` 控制), 删除其余。活跃版本不清理。

---

## 11. 训练 API (后台任务)

### 11.1 触发文本 LoRA 训练

```
POST /api/v1/train/text?model_key=qwen3-8b&use_seed=true
X-API-Key: required
```

**查询参数**:

| 参数 | 默认 | 说明 |
|------|------|------|
| `model_key` | `qwen3-8b` | 模型标识 |
| `lora_profile` | `standard` | LoRA 配置 (light/standard/heavy) |
| `training_profile` | `standard` | 训练配置 (quick_test/standard) |
| `use_seed` | `false` | 使用种子数据 |
| `dataset_path` | 无 | 自定义数据集路径 |

**响应**:
```json
{
  "task_id": "train_20260603110536_34d209",
  "status": "queued",
  "version_tag": "lora_v20260603_002",
  "model_key": "qwen3-8b"
}
```

训练在后台子进程中执行，通过 `GET /api/v1/tasks/{task_id}` 跟踪进度。

### 11.2 触发多模态 LoRA 训练

```
POST /api/v1/train/multimodal
X-API-Key: required
```

**请求体** (`MultimodalTrainRequest`):
```json
{
  "model": "Qwen/Qwen3.5-4B",
  "train_data": null,
  "val_data": null,
  "output_dir": null,
  "epochs": 3,
  "batch_size": 1,
  "grad_accum": 4,
  "lora_rank": 8,
  "lora_alpha": 16,
  "lr": 0.0002,
  "max_seq_length": 2048
}
```

---

## 12. 推理代理 API

### 12.1 统一推理入口 `[ADR-010 BUG-008 增强]`

```
POST /api/v1/inference/chat
X-API-Key: required
```

**请求体** (`InferenceRequest`):
```json
{
  "messages": [{"role": "user", "content": "你好"}],
  "model": "latest",
  "temperature": 0.7,
  "max_tokens": 512,
  "timeout": 60
}
```

**字段说明**:

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `messages` | array | 必填 | OpenAI 格式消息列表 |
| `model` | string | `"latest"` | 模型名 (latest=当前LoRA, qwen3-8b=基座) |
| `temperature` | float | `0.7` | 温度 (0.0=确定, 1.0=随机) |
| `max_tokens` | int | `512` | 最大生成 token 数 |
| `timeout` | int | `60` | 超时秒数 `[ADR-010 BUG-008]` |

> 自动路由: 纯文本请求 → vLLM 8001, 多模态请求 (content 为数组含 image) → vLLM 8002。

**响应**:
```json
{
  "status": "ok",
  "content": "你好！我是通义千问...",
  "model": "latest",
  "usage": {"prompt_tokens": 5, "completion_tokens": 50, "total_tokens": 55}
}
```

**错误响应** (推理失败):
```json
{
  "detail": "Connection refused",
  "error_code": "INFERENCE_ERROR",
  "context": {"model": "latest"}
}
```

---

## 13. 后台任务队列 API

### 13.1 任务列表

```
GET /api/v1/tasks
X-API-Key: required
```

**查询参数**:

| 参数 | 默认 | 说明 |
|------|------|------|
| `task_type` | 全部 | 按类型过滤 (training/multimodal_training/alignment_training) |
| `status` | 全部 | 按状态过滤 (queued/running/completed/failed/cancelled) |
| `limit` | 20 | 单页条数 (1-100) |

### 13.2 查询任务状态

```
GET /api/v1/tasks/{task_id}
X-API-Key: required
```

**查询参数**:

| 参数 | 默认 | 说明 |
|------|------|------|
| `log_tail` | 50 | 返回最近 N 行日志 |

**响应**:
```json
{
  "task_id": "train_20260603110536_34d209",
  "task_type": "training",
  "status": "running",
  "started_at": "2026-06-03T11:05:36+08:00",
  "duration_seconds": 15.3,
  "exit_code": null,
  "log_lines": 42,
  "logs": ["step 10 loss=2.31", ...],
  "metadata": {"model_key": "qwen3-8b"}
}
```

**错误响应**:
```json
{
  "detail": "任务不存在: nonexistent",
  "error_code": "TASK_NOT_FOUND",
  "context": {"task_id": "nonexistent"}
}
```

### 13.3 获取任务日志

```
GET /api/v1/tasks/{task_id}/logs
X-API-Key: required
```

| 参数 | 默认 | 说明 |
|------|------|------|
| `tail` | 100 | 返回最近 N 行 |
| `offset` | 0 | 日志起始偏移 |

### 13.4 取消任务

```
POST /api/v1/tasks/{task_id}/cancel
X-API-Key: required
```

**错误响应**:
```json
{
  "detail": "无法取消: xxx (不存在或非运行中)",
  "error_code": "TASK_CANCEL_FAILED",
  "context": {"task_id": "xxx"}
}
```

---

## 14. V2 多模态 API

> ADR-009 V2.0 多模态升级

### 14.1 媒体上传

```
POST /api/v1/media/upload
X-API-Key: required
```

**状态码**: `201 Created`

上传图像/视频文件, 支持 `multipart/form-data`。

**查询参数**:

| 参数 | 默认 | 说明 |
|------|------|------|
| `media_type` | `image` | `image` 或 `video` |
| `task_type` | `image_caption` | 关联任务类型 |

**响应**:
```json
{
  "media_id": "image_1717315200000_a1b2c3d4",
  "media_type": "image",
  "file_path": "images/2026/06/image_1717315200000_a1b2c3d4",
  "file_size": 245760,
  "mime_type": "image/jpeg",
  "task_type": "image_caption"
}
```

### 14.2 获取媒体信息

```
GET /api/v1/media/{media_id}
X-API-Key: required
```

返回媒体元数据 (尺寸、时长、帧数等)。

**错误响应**:
```json
{
  "detail": "媒体不存在",
  "error_code": "MEDIA_NOT_FOUND",
  "context": {"media_id": "nonexistent"}
}
```

### 14.3 媒体列表

```
GET /api/v1/media
X-API-Key: required
```

**查询参数**:

| 参数 | 默认 | 范围 | 说明 |
|------|------|------|------|
| `media_type` | 全部 | `image` / `video` | 按类型过滤 |
| `task_type` | 全部 | — | 按任务类型过滤 |
| `limit` | 20 | 1-100 | 单页条数 |
| `offset` | 0 | ≥ 0 | 跳过条数 |

### 14.4 任务类型清单

```
GET /api/v1/tasks/types
X-API-Key: required
```

返回所有支持的 task_type 及其所属类别、推荐模型、训练轨道:
```json
{
  "task_types": [
    {"value": "text_qa", "category": "text", "recommended_model": "qwen3-8b", "train_track": "unsloth_sft"},
    {"value": "image_caption", "category": "image", "recommended_model": "qwen3.5-4b", "train_track": "hf_peft_lora"},
    {"value": "image_qa", "category": "image", "recommended_model": "qwen3.5-4b", "train_track": "hf_peft_lora"},
    {"value": "video_qa", "category": "video", "recommended_model": "qwen3.5-4b", "train_track": "hf_peft_lora"},
    {"value": "video_caption", "category": "video", "recommended_model": "qwen3.5-4b", "train_track": "hf_peft_lora"}
  ]
}
```

### 14.5 标注模板

```
GET /api/v1/tasks/templates
GET /api/v1/tasks/templates/{task_type}
X-API-Key: required
```

返回 Label Studio 标注界面模板 XML。支持 5 种 task_type: text_qa, image_caption, image_qa, video_qa, video_caption。

**错误响应** (未知 task_type):
```json
{
  "detail": "未知 task_type: unknown",
  "error_code": "INVALID_TASK_TYPE",
  "context": {"task_type": "unknown"}
}
```

---

## 15. 系统管理 API

### 15.1 系统全局状态

```
GET /api/v1/system/info
X-API-Key: required
```

返回 GPU、vLLM、数据、LoRA、评测、任务的综合状态。

### 15.2 vLLM 状态

```
GET /api/v1/system/vllm
X-API-Key: required
```

返回文本 (8001) 和多模态 (8002) vLLM 服务的运行状态、PID、已加载模型列表。

### 15.3 远程重启 vLLM

```
POST /api/v1/system/vllm/restart
X-API-Key: required
```

**查询参数**:

| 参数 | 默认 | 说明 |
|------|------|------|
| `mode` | `text` | `text` (端口 8001) 或 `multimodal` (端口 8002) |
| `gpu_util` | `0.85` | GPU 显存利用率 |

> **注意**: 重启需 1-3 分钟，期间推理不可用。

### 15.4 Label Studio 状态

```
GET /api/v1/system/labelstudio
X-API-Key: required
```

返回 Label Studio 连接状态和项目列表。

---

## 16. Webhook (Label Studio)

### 16.1 接收标注事件

```
POST /webhook/annotation
```

由 Label Studio 自动推送, **需要 HMAC 签名校验**。

支持的 event:
- `ANNOTATION_CREATED`: 新标注
- `ANNOTATION_UPDATED`: 修改标注

其余 event 静默忽略。

**响应**:
```json
{
  "status": "processed",
  "results": [
    {"status": "collected", "fingerprint": "3f8a...", "quality": "high"},
    {"status": "duplicate", "fingerprint": "1b2c..."},
    {"status": "filtered", "reason": "low_quality", "score": 0.2}
  ]
}
```

---

## 17. 错误码参考

### 17.1 HTTP 状态码

| 状态码 | 含义 | 触发场景 |
|--------|------|---------|
| 200 | 成功 | 正常查询/更新响应 |
| 201 | 创建成功 `[ADR-010]` | POST 创建资源 (import/feedback/benchmark/upload) |
| 202 | 已接受 (异步) | 训练/评测任务已入队 |
| 400 | 请求参数错误 | JSON 格式错、字段缺失、业务校验失败 |
| 401 | 未认证 | API Key 缺失或无效 |
| 403 | 无权限 | (未来 RBAC 用) |
| 404 | 资源不存在 | 记录/版本/任务不存在 |
| 409 | 冲突 | 重复创建 |
| 422 | 业务校验失败 | 非法状态值、数据质量分太低、Pydantic 校验失败 |
| 429 | 限流 | 请求过快 |
| 500 | 服务端错误 | 未捕获异常 |
| 503 | 服务不可用 | 推理服务不可达 |

### 17.2 业务错误码 `[ADR-010 BUG-006 完整清单]`

所有业务错误均返回 `AppException` 标准格式:

```json
{
  "detail": "描述信息",
  "error_code": "ERROR_CODE",
  "context": {"key": "value"}
}
```

**完整错误码清单**:

| 错误码 | HTTP | 含义 | 触发端点 |
|--------|------|------|---------|
| `RECORD_NOT_FOUND` | 404 | 标注记录不存在 | `data/{id}`, `data/{id}` PUT/DELETE |
| `RUN_NOT_FOUND` | 404 | 训练 run_id 不存在 | `metrics/training/{run_id}` |
| `EVAL_JOB_NOT_FOUND` | 404 | 评测 job_id 不存在 | `eval/results/{job_id}` |
| `EVAL_RESULT_NOT_FOUND` | 404 | 评测结果不存在 | `eval/gate` |
| `BENCHMARK_NOT_FOUND` | 404 | 基准集不存在 | `eval/benchmarks/{id}` |
| `TASK_NOT_FOUND` | 404 | 后台任务不存在 | `tasks/{id}`, `tasks/{id}/logs` |
| `LORA_VERSION_NOT_FOUND` | 404 | LoRA 版本不存在 | `lora/activate`, `lora/rollback` |
| `MEDIA_NOT_FOUND` | 404 | 媒体资源不存在 | `media/{id}` |
| `PROPOSAL_NOT_FOUND` | 404 | 训练建议不存在 | `scheduler/approve` |
| `TEMPLATE_NOT_FOUND` | 404 | 标注模板不存在 | `tasks/templates/{type}` |
| `INVALID_TASK_TYPE` | 400 | 未知任务类型 | `tasks/templates/{type}` |
| `INVALID_SCHEDULER_MODE` | 400 | 无效调度模式 | `scheduler/mode` |
| `INVALID_STATUS` | 422 | 非法状态值 | `data/{id}` PUT |
| `MISSING_REQUEST_BODY` | 400 | 缺少请求体 | `data/sync` (source=upload) |
| `TASK_CANCEL_FAILED` | 400 | 任务取消失败 | `tasks/{id}/cancel` |
| `INFERENCE_ERROR` | 503 | 推理服务错误 | `inference/chat` |

---

## 18. 客户端调用示例

### 18.1 Python (requests)

```python
import requests

BASE = "http://127.0.0.1:9090"
HEADERS = {"X-API-Key": "your_api_key", "Content-Type": "application/json"}

# 健康检查 (含 DB 状态)
health = requests.get(f"{BASE}/health").json()
print(health)  # {"status": "ok", "db": "ok", ...}

# 健康检查 (完整模式, 含 vLLM)
health_full = requests.get(f"{BASE}/health?mode=full").json()

# 批量导入 (返回 201)
resp = requests.post(f"{BASE}/api/v1/data/import",
    headers=HEADERS,
    json={"source": "etl", "records": [...]})
print(resp.status_code)  # 201

# 导入 (嵌套格式)
resp = requests.post(f"{BASE}/api/v1/data/import",
    headers=HEADERS,
    json={
        "source": "etl_pipeline",
        "records": [{
            "task_id": "t1",
            "qa_content": {"records": [
                {"id": "qa_001", "question": "Q?", "answer": "A.",
                 "scores": {"trust": 0.9, "hallucination": 0.9}}
            ]}
        }]
    })

# 数据列表 (排序 + 分页)
data = requests.get(f"{BASE}/api/v1/data/list?sort=quality_score&limit=20",
    headers=HEADERS).json()

# 更新数据 (白名单字段)
resp = requests.put(f"{BASE}/api/v1/data/42",
    headers=HEADERS,
    json={"answer": "修正后", "status": "cleaned", "quality_override": 0.95})

# 触发评测
eval_resp = requests.post(f"{BASE}/api/v1/eval/run",
    headers=HEADERS,
    json={"lora_version": "lora_v20260602_001", "benchmark_id": "benchmark_v1"})
job_id = eval_resp.json()["job_id"]

# 轮询结果
import time
while True:
    r = requests.get(f"{BASE}/api/v1/eval/results/{job_id}", headers=HEADERS).json()
    if r["status"] in ("completed", "failed"):
        break
    time.sleep(5)
print(r["gate_decision"])

# 推理 (带超时)
resp = requests.post(f"{BASE}/api/v1/inference/chat",
    headers=HEADERS,
    json={"messages": [{"role": "user", "content": "你好"}], "timeout": 30})
```

### 18.2 curl

```bash
# 健康检查 (无需认证)
curl http://127.0.0.1:9090/health
curl http://127.0.0.1:9090/health?mode=full

# 数据状态
curl -H "X-API-Key: $API_KEY" http://127.0.0.1:9090/api/v1/data/status

# 数据导入 (返回 201)
curl -X POST http://127.0.0.1:9090/api/v1/data/import \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"etl","records":[{"question":"Q?","answer":"A.","scores":{"trust":0.9,"hallucination":0.9}}]}'

# 数据列表 (排序 + 分页)
curl -H "X-API-Key: $API_KEY" "http://127.0.0.1:9090/api/v1/data/list?sort=quality_score&limit=10"

# 创建评测基准集 (JSON Body)
curl -X POST http://127.0.0.1:9090/api/v1/eval/benchmark \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","description":"测试","samples":[{"id":"s1","type":"qa","input":{"q":"Q?"},"expected":{"a":"A."}}]}'

# 触发训练
curl -X POST http://127.0.0.1:9090/api/v1/scheduler/trigger \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model_key":"qwen3-8b","training_profile":"standard"}'

# 推理 (带超时)
curl -X POST http://127.0.0.1:9090/api/v1/inference/chat \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}],"timeout":30}'

# 回滚 LoRA
curl -X POST http://127.0.0.1:9090/api/v1/lora/rollback \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 18.3 JavaScript (浏览器 / 看板)

```javascript
const API_BASE = "http://127.0.0.1:9090";
const API_KEY = localStorage.getItem("api_key");

async function getDashboard() {
  const r = await fetch(`${API_BASE}/api/v1/metrics/dashboard`, {
    headers: {"X-API-Key": API_KEY}
  });
  return r.json();
}

// 健康检查
async function checkHealth(mode = "light") {
  const r = await fetch(`${API_BASE}/health?mode=${mode}`);
  return r.json();
}

// WebSocket 实时指标
const ws = new WebSocket(`ws://127.0.0.1:9090/api/v1/metrics/stream?run_id=${runId}`);
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "step") updateLossChart(msg.data);
};
```

### 18.4 OpenAI 兼容调用 (推理)

vLLM 直接提供 OpenAI 兼容接口, 端口 8001 (推理) 与 9090 (管理) 分离:

```bash
curl http://127.0.0.1:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "latest",
    "messages": [
      {"role": "system", "content": "你是文档问答助手"},
      {"role": "user", "content": "公司体检什么时间？"}
    ],
    "temperature": 0.3
  }'
```

---

## 附录 A: ADR-010 变更日志

> **日期**: 2026-06-10
> **文档**: ADR-010 接口规范化与缺陷修复

| 编号 | 变更 | 影响端点/章节 |
|------|------|-------------|
| BUG-001 | `create_benchmark` 改用 JSON Body | §7.3 |
| BUG-002 | `data_sync` 参数规范化 | §5.2 |
| BUG-003 | 统一时间戳 ISO 8601 + 时区 | §1.3, 所有含时间字段端点 |
| BUG-004 | 分页统一 limit=20, 上限=100 | §1.5, §5.5, §7.7, §13.1, §14.3 |
| BUG-005 | 支持嵌套 qa_content.records[] 格式 | §5.1 |
| BUG-006 | 统一错误响应含 error_code | §2.4, §17.2 |
| BUG-007 | scheduler/trigger 与 train/text 语义明确 | §9.6 |
| BUG-008 | InferenceRequest 增加 timeout 参数 | §12.1 |
| BUG-009 | data_update 白名单 + 状态校验 + updated_at | §5.7 |
| BUG-013 | POST 创建返回 201 | §1.7 |
| BUG-014 | data_list 增加 sort 参数 | §1.6, §5.5 |
| BUG-015 | health 增加 DB/vLLM 检查 | §4.1 |

## 附录 B: API 版本策略

- URL 路径中 `/v1/` 显式标注版本
- 不兼容变更须升 `/v2/`, 同时保留 `/v1/` 至少 6 个月
- 兼容变更 (新增字段、新增可选参数) 直接落在 `/v1/` 上, 通过 OpenAPI changelog 通知

---

## 附录 C: 多租户规范接口 (第12-20章, ADR-015)

> **日期**: 2026-06-15 · **迁移**: `sql/migrations/008_add_multitenant.sql`
> **分支**: `feat/multitenant-api-spec-ch12-20`

### C.1 设计决策

| 决策 | 取值 |
|------|------|
| 多租户隔离 | `company_id` (Integer, 默认1, 向后兼容) |
| 响应信封 | 统一 `{code, message, data}` |
| 字段命名 | 请求/响应均 camelCase |
| loss 曲线 | `lossPoints[].x`=步数(Integer), `lossPoints[].y`=损失值(Double) |
| 分页 | `limit/offset` (offset=跳过条数, 0-based); 列表额外返 `pageNo/pageSize` |
| 时间格式 | ISO 8601 + 时区 (ADR-010 BUG-003 铁律) |
| 状态枚举 | 大写 (`COMPLETED/RUNNING/MANUAL/PASS...`) |
| LoRA rank | 请求用枚举 `RANK_8/16/32/64`, 详情/列表用 Integer |
| jobId/runId | 统一 String (防 JSON 长整型精度丢失) |

### C.2 端点清单 (路径前缀 `/api/v1/factory`)

为避免破坏既有 `/api/v1/*` 端点与现存前端契约, 规范第12-20章接口以**新命名空间** `/api/v1/factory/*` 提供, 全部走统一信封 + 多租户隔离。

| 章节 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 12 | GET | `/overview` | 训练工厂全局概览 (超管视角) |
| 12 | GET | `/ops-board?companyId=` | 运营看板 (租户隔离) |
| 13 | GET | `/task-types` | 任务类型 + 策略路由 |
| 14 | GET | `/lora/versions?companyId=` | LoRA版本(按基座分组)+操作流水 |
| 14 | POST | `/lora/activate` / `/rollback` / `/cleanup` | LoRA操作 (companyId) |
| 15 | GET | `/tasks?companyId=` | 训练任务列表 |
| 15 | GET | `/tasks/{task_id}` | 训练任务详情 |
| 15 | POST | `/tasks` | 创建训练任务 (自动/半自动触发) |
| 15 | GET | `/tasks/{task_id}/logs` | 运行日志 |
| 16 | POST | `/eval/run` | 触发评测 |
| 16 | GET | `/eval/results?lora_version=&benchmarkId=&job_id=&offset=&limit=` | 评测结果列表 |
| 16 | GET | `/eval/benchmarks?companyId=` | 基准集合 |
| 16 | POST | `/eval/benchmark` | 新增基准 (companyId) |
| 17 | GET | `/alignment/overview?companyId=` | 专家对齐概览 |
| 17 | POST | `/alignment/trigger-sft` | 立即触发SFT |
| 17 | PUT | `/alignment/threshold` | 调整阈值 |
| 17 | GET | `/alignment/feedbacks` / `/history` / `/samples` | 反馈/历史/样本 |
| 17 | POST | `/alignment/feedback` / `/approve` | 提交反馈/审批 |
| 18 | GET | `/datasets/overview?companyId=` | 数据集总览 |
| 18 | GET | `/datasets?companyId=` | 数据集列表 |
| 18 | POST | `/data/import` | 创建数据集 (companyId) |
| 19 | GET/PUT | `/scheduler/mode?companyId=` | 调度模式 (每租户独立) |
| 19 | GET/PUT | `/scheduler/thresholds` | 阈值配置 (每租户独立) |
| 19 | GET/PUT | `/scheduler/training-time` | 训练时间配置 |
| 19 | GET | `/scheduler/history` | 调度操作历史 |
| 19 | GET | `/scheduler/proposals` | 训练建议 |
| 19 | POST | `/scheduler/approve` / `/defer` | 批准/推迟建议 |
| 20 | GET | `/gpu/list` | GPU监控列表 (全局) |
| 20 | GET | `/gpu/alarms` | 告警记录 (全局) |

### C.3 多租户隔离说明

- 9 张核心表 (`annotations/training_runs/lora_versions/scheduler_state/data_batches/benchmarks/eval_results/expert_feedbacks/media_assets`) 已加 `company_id` 列 (默认1, 旧行归属租户1)
- 所有租户端点查询默认带 `company_id` 过滤
- 调度模式/阈值/训练时间配置每租户独立 (新表 `scheduler_thresholds/scheduler_training_time`)
- GPU 监控/告警全局共享 (物理资源)

---


### C.4 安全边界 (company_id 信任层级, P0 临门一脚)

`company_id` **从认证 token 提取, 客户端不可伪造越权**:

| 调用方 | company_id 来源 | 能否跨租户 |
|--------|----------------|-----------|
| 普通用户 (viewer/operator) | **强制取 JWT 的 company_id** | 否, 客户端传的 companyId 被忽略 |
| 管理员 (admin / legacy api_key) | JWT 默认, 可被 companyId 入参覆盖 | 是, 跨租户管理 |

- `require_tenant` 依赖返回 `TenantContext(company_id, role, principal)`
- `resolve_tenant_cid(principal, client_company_id)` 按信任层级解析
- Principal / JWT payload 均携带 `company_id` claim; login 时从 `label_users.company_id` 注入

### C.5 双轨端点收敛策略

系统现存在两套端点:
- `/api/v1/*` (旧, 无信封/无租户, 47 端点): 供现存前端与外部集成调用
- `/api/v1/factory/*` (新, 信封+多租户+camelCase, 38 端点): 规范主线

**收敛决策 (ADR-015 Phase 2)**:
- 新功能/多租户场景一律用 `/api/v1/factory/*` (规范主线)
- 旧 `/api/v1/*` 保持兼容不动, 避免破坏现存调用 (cancel/alignment-pending/scheduler-mode/data 等)
- 前端逐步迁移: 核心数据/模型/评测/任务类页面已迁 factory 命名空间 (见 `factory-client.ts`)
- 未来废弃: 待所有调用方迁移后, 旧端点标记 deprecated

> **文档结束** · 交互式文档以 https://65ca-2409-8a4c-e5-8110-d48c-337c-6f0e-af0a.ngrok-free.app/docs 为准。
