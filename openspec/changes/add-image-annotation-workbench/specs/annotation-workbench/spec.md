## ADDED Requirements
### Requirement: Annotation Workbench Loads Interactive Image Annotator
系统 SHALL 在“标注工作台”页面加载可交互图片标注组件，并允许用户在页面内进行框选标注。

#### Scenario: Annotator renders and is operable
- **WHEN** 用户进入 `/data-management/annotation-workbench`
- **THEN** 页面展示可交互的图片标注画布
- **AND** 用户可以创建、移动、删除标注框

### Requirement: Workbench Supports Rectangle-Only Annotation in Demo Phase
系统 SHALL 在 Demo 阶段仅开放矩形框标注工具。

#### Scenario: Only rectangle annotation is enabled
- **WHEN** 用户使用标注工具栏
- **THEN** 系统仅提供矩形框标注能力
- **AND** 不暴露点、线、多边形等其他工具

### Requirement: Workbench Supports Built-in Sample Image Switching
系统 SHALL 提供至少两张内置示例图并支持用户在页面中切换当前标注样本。

#### Scenario: Switching sample resets canvas to selected sample
- **WHEN** 用户切换示例图
- **THEN** 画布加载所选图片
- **AND** 当前样本的标注数据与画布状态同步更新

### Requirement: Workbench Shows Exportable JSON Preview
系统 SHALL 在页面中实时展示当前标注结果 JSON，并支持一键复制。

#### Scenario: JSON preview updates with annotation changes
- **WHEN** 用户新增、编辑或删除标注
- **THEN** 页面中的 JSON 预览同步更新
- **AND** 用户可通过复制操作获取当前 JSON 文本
