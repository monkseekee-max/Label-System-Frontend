// data-annotation 常量 (P2-10 Phase A: 从 index.tsx 提取)

export const BUCKET_COLOR: Record<string, string> = { green: "green", orange: "orange", red: "red" };
export const BUCKET_TITLE: Record<string, string> = { green: "绿色归档", orange: "橙色关注", red: "红色必标" };
export const ASSET_TYPE_LABEL: Record<string, string> = { text: "文本内容", image: "图片内容", video: "视频内容" };
export const STATUS_LABEL: Record<string, string> = {
	ready: "就绪",
	pending_review: "待审核",
	generated: "已生成",
	// 审核通过态 (后端 QAItem 实际值)
	approved: "已通过",
	reviewed_accept: "审核通过",
	reviewed_edit: "修订通过",
	green_auto_skip: "绿色免审",
	reviewed_reject: "审核驳回",
	// 分桶待审态
	orange_pending_review: "橙色待审",
	red_required_review: "红色必审",
	parse_failed: "处理失败",
};

// ★ 统一的「已审核通过」状态集合 (修复 P0#1: 后端返回 reviewed_accept/reviewed_edit/green_auto_skip, 而非 approved)
export const REVIEWED_OK_STATUSES = new Set(["reviewed_accept", "reviewed_edit", "green_auto_skip", "approved"]);
export const PENDING_REVIEW_STATUSES = new Set(["pending_review", "orange_pending_review", "red_required_review"]);
