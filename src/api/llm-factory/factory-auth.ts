import { useAuthStore } from "#src/store/auth";

/**
 * LLM-Factory 直连请求统一鉴权头: 使用登录用户 JWT.
 *
 * 安全约束 (P0-1): 严禁读取 VITE_LLM_FACTORY_API_KEY / VITE_LLM_FACTORY_TOKEN,
 * 这些 env 变量会被打进浏览器 bundle, 任何用户可从 devtools 提取并绕过前端直调后端.
 * 登录态 JWT 来自 useAuthStore (登录后填充), 直连端点经同源 /api 代理, 后端以 JWT 鉴权.
 *
 * @param extra 需要追加的头 (如 JSON 请求的 Content-Type)
 * @throws 未登录时抛 "未认证: 请先登录"
 */
export function factoryAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
	const token = useAuthStore.getState().token;
	if (!token) {
		throw new Error("未认证: 请先登录");
	}
	return { Authorization: `Bearer ${token}`, ...extra };
}
