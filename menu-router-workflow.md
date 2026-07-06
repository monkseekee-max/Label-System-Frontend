---
outline: [2, 4]
---

# 菜单路由工作路径与权限控制梳理

本文基于当前代码实现（`main` 现状）梳理系统中的菜单 routers 工作路径、权限控制、路由配置规则，便于排查和扩展。

## 1. 当前系统的整体结论

1. 当前默认生效的是前端路由权限模式：登录后根据用户角色过滤 `src/router/routes/modules` 中的路由，再动态注入。
2. 菜单并不是单独维护，而是由“最终可访问路由树”自动转换生成。
3. 页面权限由 `route.handle.roles` 控制，按钮权限由 `route.handle.permissions` 控制。
4. 后端路由转换能力已预留（`generateRoutesFromBackend`），但当前登录鉴权主链路未接入该分支。

## 2. 菜单 routers 工作路径（时序）

### 2.1 启动阶段：只加载基础路由

1. `src/router/index.ts`
2. 创建根路由 `"/"`，挂载 `LayoutRoot`，其 `children` 初始只包含 `baseRoutes`
3. `baseRoutes` 来源：`coreRoutes + externalRoutes`（见 `src/router/routes/index.ts`）
4. 同步执行 `useAccessStore.getState().initializeBaseRoutes(baseRoutes)`，初始化基础菜单/路由快照

此时系统还未注入业务权限路由（modules）。

### 2.2 运行阶段：AuthGuard 拉取用户并注入权限路由

核心在 `src/router/guard/auth-guard.tsx`：

1. 非白名单且已登录但未拿到用户信息时，触发 `getUserInfo()`
2. `getUserInfo` 调用 `auth/me`（`src/api/user/index.ts`），并把后端身份映射成前端角色：
   - `position/role -> ["admin"] | ["common"]`（`src/router/permission-mapping.ts`）
3. 使用 `generateRoutesByFrontend(accessRoutes, userRoles)` 过滤权限路由
4. 去重后 `setAccessStore(uniqueRoutes)`：
   - 合并基础路由 + 权限路由
   - `router.patchRoutes(ROOT_ROUTE_ID, routes)` 动态注入
   - 生成 `wholeMenus`（菜单树）和 `flatRouteList`（扁平路由）
5. `navigate(pathname + search, { replace: true })` 触发重新匹配，避免动态路由注入前误落到 404

### 2.3 菜单生成与渲染

1. `useAccessStore.wholeMenus` 由 `generateMenuItemsFromRoutes` 自动生成（`src/router/utils/generate-menu-items-from-routes.ts`）
2. 规则：
   - `handle.hideInMenu=true` 不进菜单
   - `index` 子路由不直接作为菜单节点
   - `handle.externalLink` 生成新标签外链菜单
   - `handle.icon` 支持 ReactNode 或字符串图标名
3. `src/layout/layout-menu/use-menu.ts` 根据布局模式（侧边/顶部/混合）拆分 top/side 菜单并处理跳转

### 2.4 路由访问判定（运行时）

仍由 `AuthGuard` 最终兜底：

1. 白名单（`whiteRouteNames`）直接放行，不触发用户信息请求
2. 未登录访问非登录页 -> 跳转 `/login?redirect=...`
3. 已登录访问 `/login` -> 回首页或 `redirect` 参数
4. `ignoreAccess=true` 直接放行
5. 命中“有 children 但未命中具体子路由” -> 403/404 分支兜底（当前实现走 404）
6. 路由声明了 `roles` 且用户不匹配 -> 跳转 403

## 3. 权限控制拆解

### 3.1 页面级权限（菜单可见 + 路由可达）

1. 声明位置：`route.handle.roles`
2. 生效时机：
   - 注入前：`generateRoutesByFrontend` 过滤掉无权路由
   - 注入后：`AuthGuard` 再做一次运行时校验，防止越权直链

示例（`src/router/routes/modules/system.ts`）：

```ts
handle: {
	roles: ["admin"];
}
```

### 3.2 按钮级权限（页面内控件显示）

1. 声明位置：`route.handle.permissions`
2. 判定来源：`useAccess().hasAccessByCodes()` 从“当前匹配路由的 permissions”中判断
3. 使用方式：
   - 函数式判断：`hasAccessByCodes("permission:button:add")`
   - 组件式：`<AccessControl codes={...}>...</AccessControl>`

说明：该实现是“基于当前路由元信息的按钮权限”，不是单独请求按钮权限点。

### 3.3 角色来源与映射

1. 后端 `auth/me` 返回 `role`、`position`
2. 前端在 `permission-mapping.ts` 映射为系统内部角色：
   - `ADMIN / ENGINEER / MANAGER -> admin`
   - 其他常见岗位 -> common
3. 兜底角色：`common`

## 4. 路由配置规则（落地规范）

### 4.1 路由文件组织

`src/router/routes` 目录按职责拆分：

1. `core`：登录、异常、fallback 等基础路由
2. `external`：隐私政策、服务条款等白名单路由
3. `modules`：业务权限路由（当前主链路使用）
4. `static`：代码中预留了扫描入口，但当前仓库未建立该目录

### 4.2 必要约定

1. 路由对象使用 `AppRouteRecordRaw`（`src/router/types.ts`）
2. `handle.title` 作为菜单名/标题核心字段，建议必填
3. 一级业务路由建议用 `ContainerLayout` 承载，实际页面放在子路由（常用 `index: true`）
4. `path` 应保持全路径（以 `/` 开头）并全局唯一
5. `icon` 若用字符串，必须在 `src/icons/menu-icons.ts` 注册，否则菜单显示告警

### 4.3 常用元字段语义

1. `order`：一级菜单排序，最终会统一升序
2. `roles`：页面角色权限
3. `permissions`：按钮权限码集合
4. `hideInMenu`：隐藏菜单但路由仍可访问（若权限允许）
5. `keepAlive=false`：在多标签缓存中排除该页
6. `currentActiveMenu`：当前路由激活指定菜单（详情页高亮父菜单常用）
7. `iframeLink`：以 iframe 方式内嵌外部页面
8. `externalLink`：菜单点击后新窗口打开外链
9. `ignoreAccess`：跳过权限校验

### 4.4 自动处理规则

1. 路由会自动补 `id`（默认取 `path`，index 路由使用 `parentPath + "/"`）
2. 路由注入前会做同 path 去重（开发环境会告警）
3. 菜单由路由树派生，不建议维护独立菜单配置

## 5. 当前“后端路由模式”状态说明

当前代码库中：

1. 已实现后端路由转换工具：`src/router/utils/generate-routes-from-backend.ts`
2. 已实现路由接口定义：`fetchAsyncRoutes`、`isSendRoutingRequest`
3. 但当前 `AuthGuard` 主流程仅调用 `generateRoutesByFrontend`，未切入后端动态路由分支

因此，现阶段“真实生效链路”应按本文第 2 节理解；后端路由能力属于可扩展能力，非默认运行路径。

## 6. 关键文件索引

- 路由入口：`src/router/index.ts`
- 路由聚合：`src/router/routes/index.ts`
- 鉴权守卫：`src/router/guard/auth-guard.tsx`
- 权限路由过滤：`src/router/utils/generate-routes-from-frontend.ts`
- 后端路由转换（预留）：`src/router/utils/generate-routes-from-backend.ts`
- Access 状态与动态注入：`src/store/access.ts`
- 菜单生成：`src/router/utils/generate-menu-items-from-routes.ts`
- 页面/按钮权限 Hook：`src/hooks/use-access/index.ts`
- 角色映射：`src/router/permission-mapping.ts`
