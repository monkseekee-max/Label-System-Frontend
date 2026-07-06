# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (Vite, proxied to /api)
pnpm build        # Production build (NODE_OPTIONS --max-old-space-size=8192)
pnpm typecheck    # tsc --noEmit (run after every change)
pnpm lint         # ESLint (antfu config, strict)
pnpm lint:fix     # ESLint auto-fix (run before committing)
pnpm test         # Vitest (unit tests in __tests__ and *.test.ts files)
pnpm test -- --run src/router/role-hierarchy.test.ts  # Run single test file
```

Pre-commit hook runs `eslint --fix` on staged files via lint-staged. Commit messages must follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).

## Architecture Overview

### Request / API Pattern

All API files live in `src/api/<domain>/`. The HTTP client is `ky` via `src/utils/request/index.ts` (configured with base URL from `VITE_API_BASE_URL`, `Bearer` token injection, global progress, 3-retry).

Every API file uses the same adapter:

```ts
interface RawResponse<T> { code: number, message: string, data: T }
function toApiResponse<T>(raw: RawResponse<T>): ApiResponse<T> {
	return { code: raw.code, message: raw.message, success: raw.code === 200, result: raw.data };
}
```

`ApiResponse<T>` is a global type. Never return raw responses to the page layer.

### Router & Access Control

Routes are defined as static TypeScript modules in `src/router/routes/modules/*.ts` and auto-glob'd into `accessRoutes`. Each route's `handle` object carries `roles`, `permissions`, `hideInMenu`, `currentActiveMenu`, and `order`.

At login, `AuthGuard` (`src/router/guard/auth-guard.tsx`) calls `auth/me`, maps backend `position`/`role` → frontend roles via `src/router/permission-mapping.ts`, then calls `generateRoutesByFrontend` to filter `accessRoutes` down to what the user can see. The filtered routes are stored in `useAccessStore` and injected via `patchRoutes`.

**Role hierarchy** (`src/router/role-hierarchy.ts`): `superAdmin > admin > {annotator, dataTrainer, reviewer}`. Declaring a parent role on a route automatically grants access to all inherited children. Map backend positions to frontend roles in `permission-mapping.ts` — don't touch `role-hierarchy.ts`.

**Menu ordering** — `src/router/extra-info/order.ts` controls sidebar sort order. Increment by ~10 between entries.

**Icons** — menu icon strings (e.g. `"BankOutlined"`) must be registered in `src/icons/menu-icons.ts`. Both the import and the `menuIcons` export object must be updated.

### State Management (Zustand)

Stores in `src/store/`:

- `useAuthStore` — token only (`auth.ts`)
- `useUserStore` — flat `UserInfoType` fields directly on the store (no nested `userInfo`). Access as `useUserStore(s => s.position)`, not `s.userInfo?.position`.
- `useAccessStore` — filtered route list post-login
- `usePreferencesStore` — UI preferences (persisted)

### Page Layer Conventions

Pages use `@ant-design/pro-components` (`ProTable`, `ModalForm`, `StepsForm`). Standard pattern:

- `useQuery` for list/detail fetching with structured query keys: `["<resource>", "list", filters]`
- `useMutation` for writes; always call `queryClient.invalidateQueries` on success
- `window.$message?.success(...)` for success toasts (from `src/utils/static-antd`)

`ModalForm.onFinish` receives `Record<string, any>` — always add explicit type annotation or cast at the call site.

### i18n

`src/locales/zh-CN/common.json` and `src/locales/en-US/common.json`. Menu keys live under the `"menu"` namespace. Route handles use `$t("common.menu.xxx")` (returns the key string; resolved at render time). Add both languages when adding new keys.

开发过程中暂时不需要支持i18n,除非有明确的指令。

### Business Domain (this project)

Multi-tenant SAAS for annotation labeling. Five roles:

- `superAdmin` — platform admin, manages all companies
- `admin` — company admin, manages users and tasks
- `reviewer` — approves annotation results
- `annotator` / `dataTrainer` — upload materials, perform annotation

Key menus and their owning roles:

| Menu | Path prefix | Visible to |
|---|---|---|
| 企业管理 | `/platform` | superAdmin only |
| 人员管理 | `/system` | superAdmin, admin |
| 资料管理 | `/data-management` | all four non-super roles |
| 任务管理 | `/task-management` | all four non-super roles |
| 审批管理 | `/approval-management` | reviewer, admin |

`annotation-workbench` is under an active OpenSpec change (`openspec/changes/add-image-annotation-workbench/`) — do not modify it.

The backend has **no** "submit material for review" endpoint. The approval flow is for annotation *results* (`/annotation-results/{id}/merge-review`), not for materials.
