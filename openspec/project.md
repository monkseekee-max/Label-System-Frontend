# Project Context

## Purpose
LLM-Factory 前端：多租户标注 SAAS 的 Web 控制台，覆盖数据飞轮（采集→清洗→转换→构建）、智能标注工作台（文本/图片/视频）、训练流水线、模型注册与推理、评测与对齐、审批与企业/人员管理。是「本地模型训练工厂」核心训练引擎的人机交互层，驱动数据飞轮的自动化模型迭代闭环。

## Tech Stack
- **框架**：React 19.2 + TypeScript 5.9 + Vite 7
- **UI**：Ant Design 6.2 + @ant-design/pro-components 3.1
- **样式**：Tailwind CSS 4.1（`@tailwindcss/vite`，`@theme` 在 `src/styles/tailwind.css`）+ AntD cssinjs + 全局 CSS；设计 token 在 `src/styles/tokens/`
- **状态**：Zustand 5（auth/preferences/tabs/access/user/global）
- **数据**：TanStack Query 5（页面直接用 `useQuery`/`useMutation`，无自定义 fetch hook）
- **HTTP**：ky 1.14（`src/utils/request/`，Bearer JWT + 全局进度 + 幂等重试）
- **i18n**：react-i18next + i18next（zh-CN / en-US，`src/locales/`；开发期暂不强制 i18n）
- **路由**：react-router 7（前端权限模式，modules 自动 glob）
- **测试**：Vitest 4 + happy-dom + @testing-library/react + jest-dom（globals 启用）
- **图标**：@ant-design/icons + unplugin-icons（本地 SVG + Remix）经 `src/icons/` barrel
- **其他**：ahooks、dayjs、echarts、motion、react-error-boundary、keepalive-for-react

## Project Conventions

### Code Style
- ESLint `@antfu/eslint-config`（严格）；pre-commit 经 simple-git-hooks + lint-staged 跑 `eslint --fix`
- 提交信息：Conventional Commits（`feat:`/`fix:`/`chore:`…）
- 路径别名：`#src/*` → `src/*`；icon 别名 `~icons/svg/*`、`~icons/ri/*`（unplugin-icons）
- 全局类型：`ApiResponse<T>`、`ApiListResponse<T>`、`ApiError` 可不加 import 直接用

### Architecture Patterns
- **API 层**：`src/api/<domain>/` 按页面分目录；统一适配 `RawResponse<T>{code,message,data}` → `ApiResponse<T>`；成功判定统一走 `isSuccessResponse(code===200)`（`src/api/shared.ts`）；错误经 `ApiError` 携带 `errorCode`/`context`
- **请求层**：`src/utils/request/`（ky 实例 + before/afterResponse 钩子 + 401 静默续期 + 重试策略仅幂等方法）
- **路由权限**：静态模块 `src/router/routes/modules/*.ts` 自动 glob；`handle.roles`/`permissions`/`hideInMenu`/`order`；登录后 `AuthGuard` 拉取 `auth/me` 并经 `permission-mapping.ts` 映射角色，`generateRoutesByFrontend` 过滤注入。详见 `menu-router-workflow.md`（路由权限详细参考）
- **页面层**：ProTable/ModalForm/StepsForm；`useQuery` 键 `["<resource>","list",filters]`；`useMutation` 成功后 `queryClient.invalidateQueries`；toast 统一用 `window.$message`/`$notification`/`$modal`（静态桥，`src/utils/static-antd/`）
- **状态**：`useAuthStore`（token）、`useUserStore`（扁平 UserInfoType 字段，非嵌套 `userInfo`）、`useAccessStore`（过滤后路由）、`usePreferencesStore`（UI 偏好，持久化）
- **角色层级**：`superAdmin > admin > {annotator, dataTrainer, reviewer}`；声明父角色自动继承子角色

### Testing Strategy
- 单元/组件：Vitest，测试位于 `src/__tests__/`（横切）与组件同目录 `*.test.tsx`
- 构建 chunk 体积护栏：`src/__tests__/chunk-budget.test.ts`（需先 `npm run build`）
- E2E：Playwright（`e2e/`，独立 runner，vitest 排除）
- 命令：`pnpm test`（vitest）、`pnpm typecheck`（tsc --noEmit）、`pnpm lint`（eslint）

### Git Workflow
- Conventional Commits 强制（commitlint）
- pre-commit：lint-staged → `eslint --fix`
- 主分支开发模型

## Domain Context
多租户标注 SAAS，五角色：
- `superAdmin` — 平台管理员，管所有企业
- `admin` — 企业管理员，管人员与任务
- `reviewer` — 审批标注结果
- `annotator` / `dataTrainer` — 上传素材、执行标注

核心菜单：企业管理 `/platform`、人员管理 `/system`、资料管理 `/data-management`、任务管理 `/task-management`、审批管理 `/approval-management`、标注工作台。后端无「素材送审」接口，审批流针对标注**结果**（`/annotation-results/{id}/merge-review`）。

## Important Constraints
- 仅内部使用（License: Internal use only）
- 目标运行环境：WSL2 Ubuntu 22.04 + NVIDIA GPU + CUDA 12.8；前端面向现代浏览器
- `vite build` 需 `NODE_OPTIONS=--max-old-space-size=8192`
- 开发服务器端口 3335（strictPort），`/api` 代理到本地 FastAPI（127.0.0.1:9090）

## External Dependencies
- 后端 FastAPI（端口 9090）— 数据/指标/评测/对齐/标注系统
- vLLM 推理服务（端口 8001）
- PostgreSQL 16
- label-system 智能标注微服务栈（8100-8105）
- Grafana 监控（运维面）
