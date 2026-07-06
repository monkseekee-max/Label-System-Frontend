## 1. OpenSpec
- [x] 1.1 新增 `annotation-workbench` 能力变更提案与规格增量
- [x] 1.2 通过 `openspec validate add-image-annotation-workbench --strict`

## 2. Dependency
- [x] 2.1 增加 `@labelu/image-annotator-react` 依赖
- [x] 2.2 增加 `styled-components` 依赖

## 3. Frontend Implementation
- [x] 3.1 新增可复用图片标注组件，封装 labelU Annotator
- [x] 3.2 在标注工作台页面接入组件
- [x] 3.3 支持内置示例图切换
- [x] 3.4 支持实时 JSON 预览与复制

## 4. Verification
- [x] 4.1 `pnpm typecheck`
- [x] 4.2 `pnpm lint`（已执行；存在仓库既有 lint 错误，非本次改动引入）
- [x] 4.3 `pnpm build`
