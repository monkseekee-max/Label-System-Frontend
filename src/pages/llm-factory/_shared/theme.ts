import { theme } from "antd";

/**
 * LLM-Factory 模块统一主题工具 (ADR 暗色系样式适配)
 *
 * 所有 llm-factory 页面通过 useLlmTokens() 获取语义化颜色 token,
 * 替换原先硬编码的浅色值 (#fff / #fafafa / #1890ff ...),
 * 使页面在亮/暗主题下都能正确跟随 antd 主题算法。
 */
export function useLlmTokens() {
	const { token } = theme.useToken();
	return token;
}

/**
 * 终端 / 日志控制台配色 (IDE 风格, 两种主题下统一深色)
 * 这是有意的设计 (类似 VS Code 终端), 不随主题切换。
 */
export const TERMINAL_THEME = {
	bg: "#0C1021",
	border: "#1E2A3A",
	text: "#B8C4D0",
	subtle: "#6B7785",
};

/**
 * 图表 / 数据可视化配色 (跨主题通用品牌色, 用于区分数据系列)
 * 在亮暗主题下保持一致以确保图表可读性。
 */
export const CHART_COLORS = {
	cyan: "#0FC6C2",
	blue: "#2F54EB",
	indigo: "#597EF7",
	purple: "#722ED1",
	neutral: "#8c8c8c",
	primary: "#1890ff",
	success: "#52c41a",
	warning: "#faad14",
	error: "#ff4d4f",
};
