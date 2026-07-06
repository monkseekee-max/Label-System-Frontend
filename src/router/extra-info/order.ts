/**
 * 完整版菜单比较多，将 sort 抽离出来，在此方便维护
 *
 * 菜单排序，越小越靠前，最好以 10 为基数递增
 *
 * 顶级业务分类按 ADR「五大类」组织: 企业 / 数据 / 标注 / 训练 / 应用
 * 各分类为 pathless 布局路由 (无 path), 仅靠 order 控制侧边栏顺序。
 */

export const home = 1;

// ① 企业 — 平台治理 (组织/人员/配置/财务/运维/基础设施)
export const enterprise = 5;
// ② 数据 — 数据资产全生命周期
export const data = 15;
// ③ 标注 — 标注生产 + 质量引擎
export const annotation = 25;
// ④ 训练 — 训练任务 + 模型仓库
export const training = 35;
// ⑤ 应用 — 模型服务化 + 业务应用
export const application = 45;

export const demo = 3;
export const access = 10;
export const routeNest = 20;
export const outside = 40;

export const exception = 90;
export const personalCenter = 110;
export const about = 120;

// legacy order 常量: 前端模块已重组为五大业务分类, 这些仅保留给后端菜单模式 (fake/*.ts) 使用
export const platform = 5;
export const llmFactory = 38;
export const system = 100;
