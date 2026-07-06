# Change: Add Image Annotation Workbench Demo

## Why
当前“标注工作台”页面仍为占位内容，无法进行实际图片标注与结果查看，无法支撑标注流程演示与后续后端联调。

## What Changes
- 在标注工作台引入基于 `labelU-kit` 的图片标注能力。
- 首版仅支持矩形框标注（目标检测场景）。
- 提供内置示例图切换与固定标签集（Human/Bicycle/Car）。
- 提供前端实时 JSON 结果预览与复制能力。

## Impact
- Affected specs: `annotation-workbench`（新增能力）
- Affected code:
  - `src/components/image-annotator/*`
  - `src/pages/data-management/annotation-workbench/index.tsx`
  - `package.json`
